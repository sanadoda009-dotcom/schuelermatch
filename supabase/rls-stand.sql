-- ============================================================
-- ZUGRIFFSREGELN DER DATENBANK — SICHERUNGSKOPIE
--
-- Stand: 26. August 2026, ausgelesen aus dem laufenden Projekt
-- blufrvuskqiloslyxjkx.
--
-- WARUM ES DIESE DATEI GIBT
-- `schutz-trigger.sql` sichert seit dem 25.8. die Spalten-Trigger. Die
-- RLS-Policies selbst — also die Regeln, WER welche Zeile überhaupt
-- sehen und ändern darf — standen weiter nur an einer einzigen Stelle:
-- im Supabase-Dashboard. Kein Verlauf, keine Referenz, keine
-- Möglichkeit festzustellen, ob sich etwas geändert hat.
--
-- Bei einer Datenbank mit Ausweisdokumenten und Zeugnissen von
-- Minderjährigen ist das die riskanteste verbliebene Lücke gewesen:
-- Ein versehentlich gelöschter oder aufgeweichter Policy-Eintrag fällt
-- niemandem auf, bis Daten offen liegen.
--
-- WAS DIESE DATEI IST
-- Ein vollständiger, wiederholbar ausführbarer Stand. Zusammen mit
-- `schutz-trigger.sql` lässt sich die Zugriffskonfiguration nach einem
-- Umzug, einer Wiederherstellung oder einer Projektpause komplett neu
-- aufbauen.
--
-- WAS SIE NICHT IST
-- Keine Migration im Sinne einer Änderung. Sie schreibt den Stand fest,
-- der ohnehin gilt. Vor dem Ausführen auf einer BESTEHENDEN Datenbank
-- also erst vergleichen (siehe ganz unten).
--
-- ANWENDEN: Im Supabase-SQL-Editor einfügen und ausführen.
-- ============================================================


-- ============================================================
-- 1. ZEILENSCHUTZ EINSCHALTEN
-- Ohne diese Zeilen greift keine einzige Policy — die Tabelle wäre
-- für jeden mit dem öffentlichen Schlüssel komplett lesbar.
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.jobs          enable row level security;
alter table public.bewerbungen   enable row level security;
alter table public.nachrichten   enable row level security;
alter table public.bewertungen   enable row level security;
alter table public.gemerkte_jobs enable row level security;
alter table public.meldungen     enable row level security;


-- ============================================================
-- 2. HILFSFUNKTIONEN, DIE POLICIES BENUTZEN
--
-- Beide sind SECURITY DEFINER: Sie müssen in `profiles` nachsehen
-- dürfen, ohne selbst an der RLS von `profiles` zu scheitern.
-- `ist_admin()` steht bereits in schutz-trigger.sql und fehlt hier
-- absichtlich, damit es nur eine Quelle dafür gibt.
-- ============================================================

-- Ist diese Firma vom Betreiber freigegeben? Steuert, ob ihre Jobs
-- öffentlich sichtbar sind.
-- Ist dieses Profil als Schueler verifiziert? Fuer die Bewerbungs-Regel
-- weiter unten. SECURITY DEFINER wie die anderen: Die Regel muss
-- `verifiziert` auch dann lesen koennen, wenn die Zugriffsregeln auf
-- `profiles` das im jeweiligen Zusammenhang nicht hergaeben.
create or replace function public.ist_verifiziert(u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select verifiziert from public.profiles where id = u), false);
$$;

create or replace function public.firma_freigegeben(f uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select firma_status = 'freigegeben' from public.profiles where id = f), false);
$$;

-- Aufrufzähler für Job-Anzeigen. SECURITY DEFINER, damit auch nicht
-- eingeloggte Besucher zählen können, ohne UPDATE-Rechte auf `jobs`
-- zu haben. Zählt bewusst nur aktive Jobs.
create or replace function public.job_aufruf_zaehlen(p_job uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.jobs set aufrufe = aufrufe + 1 where id = p_job and aktiv = true;
$$;

-- Legt beim Registrieren das Profil an. Die Rolle wird hier
-- abgesichert: Was der Browser mitschickt, wird NICHT übernommen,
-- sondern auf 'schueler' oder 'firma' eingegrenzt.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_alter int;
begin
  v_role := lower(coalesce(new.raw_user_meta_data->>'role', 'schueler'));
  if v_role not in ('schueler', 'firma') then
    v_role := 'schueler';
  end if;

  -- Alter defensiv parsen (ungueltige Eingabe -> NULL statt Absturz)
  begin
    v_alter := nullif(new.raw_user_meta_data->>'alter_jahre', '')::int;
  exception when others then
    v_alter := null;
  end;

  insert into public.profiles (id, role, name, email, alter_jahre, ort)
  values (
    new.id,
    v_role,
    new.raw_user_meta_data->>'name',
    new.email,
    v_alter,
    new.raw_user_meta_data->>'ort'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kennzahlen für den Betreiber-Bereich. Prüft selbst auf Admin-Rechte,
-- weil SECURITY DEFINER die RLS umgeht.
-- (Volltext siehe Dashboard; hier nur der Wächter, der zählt.)
--   if not ist_admin() then
--     raise exception 'Nur fuer Administratoren.' using errcode = '42501';
--   end if;


-- ============================================================
-- 3. POLICIES: profiles
--
-- Die heikelste Tabelle: Name, Alter, Schule, Ort, E-Mail und Foto
-- von Minderjährigen.
-- ============================================================
drop policy if exists "Eigenes Profil lesen" on public.profiles;
create policy "Eigenes Profil lesen" on public.profiles
  for select using (auth.uid() = id);

-- Eine Firma sieht das Profil nur von Schülern, die sich bei IHR
-- beworben haben — nicht von allen.
drop policy if exists "Firma sieht Profil von Bewerbern" on public.profiles;
create policy "Firma sieht Profil von Bewerbern" on public.profiles
  for select using (exists (
    select 1 from public.bewerbungen
    join public.jobs on jobs.id = bewerbungen.job_id
    where bewerbungen.schueler_id = profiles.id and jobs.firma_id = auth.uid()));

drop policy if exists "Admin liest alle Profile" on public.profiles;
create policy "Admin liest alle Profile" on public.profiles
  for select to authenticated using (public.ist_admin());

-- Achtung: absichtlich ohne WITH CHECK. Welche SPALTEN geändert werden
-- dürfen, regelt der Trigger trg_schuetze_profil (schutz-trigger.sql) —
-- RLS kann das nicht, weil die Zeile dem Nutzer ja gehört.
drop policy if exists "Eigenes Profil bearbeiten" on public.profiles;
create policy "Eigenes Profil bearbeiten" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Admin aktualisiert Profile" on public.profiles;
create policy "Admin aktualisiert Profile" on public.profiles
  for update to authenticated using (public.ist_admin()) with check (public.ist_admin());

-- Kein INSERT: Profile entstehen ausschliesslich ueber handle_new_user().
-- Kein DELETE: Konten loescht nur der Betreiber.


-- ============================================================
-- 4. POLICIES: jobs
-- ============================================================

-- Öffentlich sichtbar sind nur aktive Jobs FREIGEGEBENER Firmen.
-- Beide Bedingungen zusammen sind die Moderation.
drop policy if exists "Jobs öffentlich lesen" on public.jobs;
create policy "Jobs öffentlich lesen" on public.jobs
  for select using (aktiv = true and public.firma_freigegeben(firma_id));

drop policy if exists "Firma liest eigene Jobs" on public.jobs;
create policy "Firma liest eigene Jobs" on public.jobs
  for select to authenticated using (auth.uid() = firma_id);

drop policy if exists "Admin liest alle Jobs" on public.jobs;
create policy "Admin liest alle Jobs" on public.jobs
  for select to authenticated using (public.ist_admin());

drop policy if exists "Firma postet Jobs" on public.jobs;
create policy "Firma postet Jobs" on public.jobs
  for insert with check (auth.uid() = firma_id);

-- Diese Policy hat bewusst kein WITH CHECK — welche SPALTEN geändert
-- werden dürfen, regelt seit dem 26.8. der Trigger trg_schuetze_job
-- (`schutz-trigger-jobs.sql`). Ohne ihn konnte eine Firma `firma_id`
-- an ihrem eigenen Job auf ein fremdes Konto setzen und damit den Job
-- samt Bewerbungen, Bewerberprofilen, Zeugnissen und Chatverläufen
-- weggeben. Diese Datei ohne den Trigger einzuspielen reisst das Loch
-- wieder auf — beide gehören zusammen.
drop policy if exists "Firma bearbeitet eigene Jobs" on public.jobs;
create policy "Firma bearbeitet eigene Jobs" on public.jobs
  for update using (auth.uid() = firma_id);

drop policy if exists "Firma loescht eigene Jobs" on public.jobs;
create policy "Firma loescht eigene Jobs" on public.jobs
  for delete using (auth.uid() = firma_id);


-- ============================================================
-- 5. POLICIES: bewerbungen
-- ============================================================
drop policy if exists "Eigene Bewerbungen" on public.bewerbungen;
create policy "Eigene Bewerbungen" on public.bewerbungen
  for select using (auth.uid() = schueler_id);

drop policy if exists "Firma sieht Bewerbungen auf eigene Jobs" on public.bewerbungen;
create policy "Firma sieht Bewerbungen auf eigene Jobs" on public.bewerbungen
  for select using (exists (
    select 1 from public.jobs
    where jobs.id = bewerbungen.job_id and jobs.firma_id = auth.uid()));

-- Bewerben nur nach der Verifizierung (seit 27.8.).
--
-- Hier hiess die Regel bis zum 27.8. schlicht "Bewerben" und verlangte
-- nur `auth.uid() = schueler_id`. `fuer-firmen.html` verspricht den
-- Arbeitgebern aber: "Wer sich bewirbt, hat einen Schuelerausweis
-- hochgeladen, den wir geprueft haben" - erzwungen war das nur im
-- Browser.
--
-- ACHTUNG BEIM WIEDEREINSPIELEN: Der alte Name wird ausdruecklich
-- mitgeloescht. Stuenden beide Regeln da, waere die Luecke wieder offen -
-- PostgreSQL verknuepft mehrere erlaubende Regeln mit ODER, und die
-- grosszuegigere gewinnt. Genau das ist am 27.8. passiert und fiel erst
-- durch die Kontrollabfrage auf.
drop policy if exists "Bewerben" on public.bewerbungen;
drop policy if exists "Schueler bewirbt sich" on public.bewerbungen;
create policy "Schueler bewirbt sich" on public.bewerbungen
  for insert with check (
    auth.uid() = schueler_id
    and public.ist_verifiziert(auth.uid())
  );

-- Ohne WITH CHECK; die Spalten friert trg_schuetze_bewerbung ein,
-- sodass die Firma faktisch nur `status` ändern kann.
drop policy if exists "Firma aendert Status eigener Bewerbungen" on public.bewerbungen;
create policy "Firma aendert Status eigener Bewerbungen" on public.bewerbungen
  for update using (exists (
    select 1 from public.jobs
    where jobs.id = bewerbungen.job_id and jobs.firma_id = auth.uid()));


-- ============================================================
-- 6. POLICIES: nachrichten
--
-- Sichtbar nur für die beiden Beteiligten einer Bewerbung. Der Chat
-- hängt an der Bewerbung, nicht an den Konten — deshalb der Umweg
-- über bewerbungen und jobs.
-- ============================================================
drop policy if exists "Nachrichten lesen" on public.nachrichten;
create policy "Nachrichten lesen" on public.nachrichten
  for select using (exists (
    select 1 from public.bewerbungen b
    join public.jobs j on j.id = b.job_id
    where b.id = nachrichten.bewerbung_id
      and (b.schueler_id = auth.uid() or j.firma_id = auth.uid())));

drop policy if exists "Nachricht senden" on public.nachrichten;
create policy "Nachricht senden" on public.nachrichten
  for insert with check (
    absender_id = auth.uid() and exists (
      select 1 from public.bewerbungen b
      join public.jobs j on j.id = b.job_id
      where b.id = nachrichten.bewerbung_id
        and (b.schueler_id = auth.uid() or j.firma_id = auth.uid())));

-- Nur zum Setzen von `gelesen` gedacht; alles andere friert
-- trg_schuetze_nachricht ein.
drop policy if exists "Nachricht als gelesen markieren" on public.nachrichten;
create policy "Nachricht als gelesen markieren" on public.nachrichten
  for update using (exists (
    select 1 from public.bewerbungen b
    join public.jobs j on j.id = b.job_id
    where b.id = nachrichten.bewerbung_id
      and (b.schueler_id = auth.uid() or j.firma_id = auth.uid())));


-- ============================================================
-- 7. POLICIES: bewertungen
-- ============================================================
drop policy if exists "Bewertungen sind oeffentlich lesbar" on public.bewertungen;
create policy "Bewertungen sind oeffentlich lesbar" on public.bewertungen
  for select using (true);

-- Bewerten darf nur, wer bei dieser Firma tatsächlich angenommen
-- wurde. Verhindert erfundene Bewertungen.
drop policy if exists "Nur angenommene Schueler bewerten" on public.bewertungen;
create policy "Nur angenommene Schueler bewerten" on public.bewertungen
  for insert to authenticated with check (
    schueler_id = auth.uid() and exists (
      select 1 from public.bewerbungen b
      join public.jobs j on j.id = b.job_id
      where b.schueler_id = auth.uid()
        and j.firma_id = bewertungen.firma_id
        and b.status = 'angenommen'));

drop policy if exists "Schueler aendert eigene Bewertung" on public.bewertungen;
create policy "Schueler aendert eigene Bewertung" on public.bewertungen
  for update to authenticated
  using (schueler_id = auth.uid()) with check (schueler_id = auth.uid());

drop policy if exists "Schueler loescht eigene Bewertung" on public.bewertungen;
create policy "Schueler loescht eigene Bewertung" on public.bewertungen
  for delete to authenticated using (schueler_id = auth.uid());


-- ============================================================
-- 8. POLICIES: gemerkte_jobs
-- ============================================================
drop policy if exists "Eigene Merkliste lesen" on public.gemerkte_jobs;
create policy "Eigene Merkliste lesen" on public.gemerkte_jobs
  for select using (auth.uid() = schueler_id);

drop policy if exists "Job merken" on public.gemerkte_jobs;
create policy "Job merken" on public.gemerkte_jobs
  for insert with check (auth.uid() = schueler_id);

drop policy if exists "Job entmerken" on public.gemerkte_jobs;
create policy "Job entmerken" on public.gemerkte_jobs
  for delete using (auth.uid() = schueler_id);


-- ============================================================
-- 9. POLICIES: meldungen
-- ============================================================
drop policy if exists "Eigene Meldungen lesen" on public.meldungen;
create policy "Eigene Meldungen lesen" on public.meldungen
  for select to authenticated using (melder_id = auth.uid() or public.ist_admin());

drop policy if exists "Eigene Meldung anlegen" on public.meldungen;
create policy "Eigene Meldung anlegen" on public.meldungen
  for insert to authenticated with check (melder_id = auth.uid());

drop policy if exists "Admin bearbeitet Meldungen" on public.meldungen;
create policy "Admin bearbeitet Meldungen" on public.meldungen
  for update to authenticated using (public.ist_admin()) with check (public.ist_admin());

drop policy if exists "Admin loescht Meldungen" on public.meldungen;
create policy "Admin loescht Meldungen" on public.meldungen
  for delete to authenticated using (public.ist_admin());


-- ============================================================
-- 10. DATEIABLAGE (storage.objects)
--
-- Der erste Ordner im Dateinamen ist immer die Nutzerkennung —
-- daher überall storage.foldername(name)[1].
-- ============================================================

-- Profilbilder
drop policy if exists "Avatar Upload eigene Datei" on storage.objects;
create policy "Avatar Upload eigene Datei" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Avatar Update eigene Datei" on storage.objects;
create policy "Avatar Update eigene Datei" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Bilder im Lebenslauf
drop policy if exists "Lebenslauf Bild Upload eigene Datei" on storage.objects;
create policy "Lebenslauf Bild Upload eigene Datei" on storage.objects
  for insert with check (bucket_id = 'lebenslauf-bilder' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Lebenslauf Bild Update eigene Datei" on storage.objects;
create policy "Lebenslauf Bild Update eigene Datei" on storage.objects
  for update using (bucket_id = 'lebenslauf-bilder' and auth.uid()::text = (storage.foldername(name))[1]);

-- Schülerausweis / Verifizierung: privat. Nur der Schüler selbst und
-- der Betreiber. Wird nach der Prüfung gelöscht.
drop policy if exists "Schuelerausweis Upload eigene Datei" on storage.objects;
create policy "Schuelerausweis Upload eigene Datei" on storage.objects
  for insert with check (bucket_id = 'verifizierung' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Schuelerausweis eigenes lesen" on storage.objects;
create policy "Schuelerausweis eigenes lesen" on storage.objects
  for select using (bucket_id = 'verifizierung' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Schuelerausweis Update eigene Datei" on storage.objects;
create policy "Schuelerausweis Update eigene Datei" on storage.objects
  for update using (bucket_id = 'verifizierung' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Schuelerausweis eigenes loeschen" on storage.objects;
create policy "Schuelerausweis eigenes loeschen" on storage.objects
  for delete using (bucket_id = 'verifizierung' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Admin liest Verifizierung" on storage.objects;
create policy "Admin liest Verifizierung" on storage.objects
  for select to authenticated using (bucket_id = 'verifizierung' and public.ist_admin());

drop policy if exists "Admin loescht Verifizierung" on storage.objects;
create policy "Admin loescht Verifizierung" on storage.objects
  for delete to authenticated using (bucket_id = 'verifizierung' and public.ist_admin());

-- Zeugnisse: privat. Der Schüler selbst — und eine Firma nur dann,
-- wenn sich der Schüler bei IHR beworben hat.
drop policy if exists "Zeugnis Upload eigene Datei" on storage.objects;
create policy "Zeugnis Upload eigene Datei" on storage.objects
  for insert with check (bucket_id = 'zeugnisse' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Zeugnis eigenes lesen" on storage.objects;
create policy "Zeugnis eigenes lesen" on storage.objects
  for select using (bucket_id = 'zeugnisse' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Zeugnis Update eigene Datei" on storage.objects;
create policy "Zeugnis Update eigene Datei" on storage.objects
  for update using (bucket_id = 'zeugnisse' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Firma sieht Zeugnis von Bewerbern" on storage.objects;
create policy "Firma sieht Zeugnis von Bewerbern" on storage.objects
  for select using (bucket_id = 'zeugnisse' and exists (
    select 1 from public.bewerbungen
    join public.jobs on jobs.id = bewerbungen.job_id
    where bewerbungen.schueler_id::text = (storage.foldername(objects.name))[1]
      and jobs.firma_id = auth.uid()));


-- ============================================================
-- 11. EIMER-EINSTELLUNGEN (storage.buckets)
--
-- Öffentlich sind nur Bilder, die ohnehin angezeigt werden. Alles mit
-- Ausweis- oder Zeugnischarakter ist privat und nur über eine
-- signierte Adresse erreichbar.
-- ============================================================
update storage.buckets set public = true,  file_size_limit = 3145728,
  allowed_mime_types = array['image/png','image/jpeg','image/jpg','image/webp','image/gif']
  where id in ('avatars','lebenslauf-bilder');

update storage.buckets set public = false, file_size_limit = 6291456,
  allowed_mime_types = array['image/png','image/jpeg','image/jpg','image/webp','image/gif','application/pdf']
  where id in ('verifizierung','zeugnisse');


-- ============================================================
-- 12. STAND VERGLEICHEN
--
-- Diese Abfrage im SQL-Editor ausführen und mit dieser Datei
-- abgleichen. Weicht etwas ab, wurde im Dashboard etwas verändert:
--
--   select schemaname, tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname in ('public','storage')
--   order by schemaname, tablename, cmd, policyname;
--
-- Ebenso prüfen, dass der Zeilenschutz überall an ist:
--
--   select c.relname, c.relrowsecurity
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r' order by 1;
--
-- Und dass die Schutz-Trigger laufen (tgenabled = 'O'):
--
--   select c.relname, t.tgname, t.tgenabled
--   from pg_trigger t join pg_class c on c.oid = t.tgrelid
--   where not t.tgisinternal and t.tgname like 'trg_schuetze%'
--   order by 1;
-- ============================================================
