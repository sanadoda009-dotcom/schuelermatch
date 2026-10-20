-- Der Firmenname ist der geprüfte - im Profil und auf jeder Anzeige
-- (20.10.2026, eingespielt)
--
-- SETZT VORAUS: alter-nach-verifizierung-fest.sql
-- (ersetzt dieselbe Funktion schuetze_profil_felder und uebernimmt alle
-- ihre Zeilen)
--
-- WARUM
-- `fuer-firmen.html` sagt: "Wir pruefen von Hand, dass ein echtes
-- Unternehmen dahintersteckt." Geprueft wird dabei auch der NAME. Danach:
--
--   1) `profiles.name` einer freigegebenen Firma war frei aenderbar - der
--      Schutz-Trigger fror ihn nicht ein. Eine als "Baeckerei Mueller"
--      freigegebene Firma konnte sich danach beliebig umbenennen; die
--      oeffentliche Firmenseite (firmen_oeffentlich) zeigte den neuen Namen.
--
--   2) `jobs.firma_name` setzte nur der Browser (js/dashboard-firma.js:
--      "if (profile.name) daten.firma_name = profile.name"). Ueber die API
--      konnte eine Firma auf ihre Anzeige JEDEN Namen schreiben - den einer
--      bekannten Kette, einer Behoerde, einer Schule. Schueler und Eltern
--      lesen genau diesen Namen auf der Karte ("bei ...") und in Google
--      for Jobs (hiringOrganization).
--
-- Vierter Fall desselben Musters an einem Tag: Eine Pruefung legt etwas
-- fest, danach darf man es wieder aendern (email, job_titel, alter_jahre).
--
-- WAS DIESE DATEI AENDERT
-- 1) Der Name einer FREIGEGEBENEN Firma ist eingefroren. Vor der Freigabe
--    bleibt er aenderbar (Tippfehler). Danach aendert ihn nur der
--    Betreiber - der Trigger laesst Admins wie bisher durch.
-- 2) `jobs.firma_name` kommt immer aus dem Profil: beim Anlegen einer
--    Anzeige und jedes Mal, wenn jemand den Namen auf der Anzeige aendern
--    will. Anzeigen behalten den Namen von damals (bewusst kopiert, siehe
--    js/dashboard-firma.js), sie werden nicht nachtraeglich umbenannt.
--
-- WAS SIE NICHT ANFASST
-- Vier alte Anzeigen (Juli 2026) haben gar keinen firma_name - aus der
-- Zeit, bevor er kopiert wurde. Es sind Testdaten; sie bleiben, wie sie
-- sind. Bearbeitet die Firma eine davon, bekommt sie den Namen.

-- 1) Profil: Name nach der Freigabe fest
create or replace function public.schuetze_profil_felder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or ist_admin() then
    return new;
  end if;
  new.ist_admin    := old.ist_admin;
  new.verifiziert  := old.verifiziert;
  new.firma_status := old.firma_status;
  new.role         := old.role;
  -- 4.9.2026: Die Adresse, an die `mail-ereignis` verschickt.
  new.email        := old.email;
  -- 20.10.2026: Das geprueft Alter bleibt, was geprueft wurde.
  if old.verifiziert is true then
    new.alter_jahre := old.alter_jahre;
  end if;
  -- 20.10.2026: Der geprueft Firmenname bleibt, was geprueft wurde.
  if old.role = 'firma' and old.firma_status = 'freigegeben' then
    new.name := old.name;
  end if;
  -- 20.10.2026: Dokumente nur aus dem eigenen Ordner.
  if new.schuelerausweis_url is not null
     and split_part(new.schuelerausweis_url, '/', 1) <> new.id::text then
    new.schuelerausweis_url := old.schuelerausweis_url;
  end if;
  if new.schulbestaetigung_url is not null
     and split_part(new.schulbestaetigung_url, '/', 1) <> new.id::text then
    new.schulbestaetigung_url := old.schulbestaetigung_url;
  end if;
  return new;
end $$;

-- 2) Anzeige: Firmenname immer aus dem Profil
create or replace function public.job_firmenname_aus_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.firma_name is distinct from old.firma_name then
    select p.name into new.firma_name from public.profiles p where p.id = new.firma_id;
  end if;
  return new;
end $$;

revoke all on function public.job_firmenname_aus_profil() from public, anon, authenticated;

drop trigger if exists trg_job_firmenname on public.jobs;
create trigger trg_job_firmenname
  before insert or update on public.jobs
  for each row execute function public.job_firmenname_aus_profil();

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
-- 1) Trigger da:
--   select tgname from pg_trigger where tgrelid = 'public.jobs'::regclass and not tgisinternal;
--   Erwartet: trg_schuetze_job und trg_job_firmenname.
--
-- 2) Gegenprobe ohne Spuren (Transaktion + rollback), als freigegebene Firma:
--      update profiles set name = 'Andere Firma' where id = auth.uid();   -> Name bleibt
--      insert into jobs (..., firma_name) values (..., 'Polizei');         -> Profilname steht da
--    Siehe supabase/pruefen/regeln-live-pruefen.sql.
--
-- Rueckgaengig, falls noetig:
--   drop trigger if exists trg_job_firmenname on public.jobs;
--   drop function if exists public.job_firmenname_aus_profil();
--   dazu schuetze_profil_felder aus alter-nach-verifizierung-fest.sql wieder einspielen.
