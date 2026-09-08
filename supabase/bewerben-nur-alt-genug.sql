-- Bewerben nur, wenn man alt genug ist - auch in der Datenbank (8.9.2026)
--
-- WARUM
-- Das Schueler-Dashboard holt nur Anzeigen, fuer die man alt genug ist:
--
--   js/dashboard-schueler.js:
--     query = query.lte('mindestalter', profile.alter_jahre || MIN_ALTER)
--
-- Ein Vierzehnjaehriger SIEHT einen "ab 16"-Job dort also gar nicht.
--
-- Die Regel, die das Bewerben erlaubt, prueft davon aber nichts:
--
--   "Schueler bewirbt sich"  INSERT with check (
--      auth.uid() = schueler_id
--      and public.ist_verifiziert(auth.uid()))
--
-- Vom Alter ist keine Rede. Ueber die API mit dem oeffentlichen anon-Key
-- kann sich ein verifizierter Vierzehnjaehriger also auf eine Anzeige
-- "ab 16" bewerben - er braucht nur die Job-Id, und die steht in jedem
-- geteilten Link (job.html?id=...).
--
-- DAS IST DIE VIERTE STELLE MIT DEMSELBEN MUSTER
-- Dreimal war es dieselbe Falle, und dreimal wurde sie in der Datenbank
-- geschlossen:
--
--   26.8.  Mindestalter der Anzeige   -> CHECK jobs_mindestalter_jarbschg
--   26.8.  Bewerben ohne Verifizierung -> ist_verifiziert() in der Regel
--   26.8.  Alter bei der Registrierung -> CHECK chk_alter_jahre
--
-- Das Alter BEIM BEWERBEN blieb offen. Auf einer Plattform, deren
-- Kernversprechen der Jugendarbeitsschutz ist, ist das die Stelle, an der
-- es am meisten zaehlt: Die Altersgrenze einer Anzeige ist keine
-- Empfehlung des Arbeitgebers, sie steht dort wegen des Gesetzes.
--
-- WAS DIESE DATEI AENDERT
-- Die INSERT-Regel verlangt zusaetzlich, dass der Schueler das
-- Mindestalter der Anzeige erreicht.
--
-- ZWEI RANDFAELLE, GENAU WIE IM DASHBOARD
--   * `jobs.mindestalter IS NULL` - solche Anzeigen sind im Dashboard
--     unsichtbar (`lte` auf NULL ist nicht wahr). Hier ebenso: keine
--     Altersangabe, keine Bewerbung. supabase/mindestalter-pflicht.sql
--     macht die Spalte ohnehin zur Pflicht.
--   * `profiles.alter_jahre IS NULL` - das Dashboard rechnet dann mit
--     MIN_ALTER (13). Dieselbe Zahl steht hier, damit beide Seiten
--     dasselbe sagen. Am 4.9.2026 gab es null solcher Profile, und
--     supabase/alter-pflicht.sql schliesst den Fall dauerhaft.

-- Eine eigene Funktion, damit die Regel lesbar bleibt und die Absicht
-- einen Namen hat. SECURITY DEFINER, weil ein Schueler die Zeile der
-- Anzeige zwar lesen darf, das eigene Profil aber nur ueber RLS - in der
-- Regel selbst waere das eine Schachtelung, die schwer zu pruefen ist.
create or replace function public.ist_alt_genug(u uuid, j uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p, public.jobs job
     where p.id = u
       and job.id = j
       and job.mindestalter is not null
       and coalesce(p.alter_jahre, 13) >= job.mindestalter
  );
$$;

comment on function public.ist_alt_genug(uuid, uuid) is
  'Erreicht der Schueler das Mindestalter der Anzeige? Ohne Altersangabe '
  'der Anzeige: nein. Ohne Alter im Profil: gerechnet wird mit 13, genau '
  'wie im Schueler-Dashboard.';

-- ACHTUNG, die Falle vom 26.8.: Damals stand die neue Regel NEBEN der
-- alten, und PostgreSQL verknuepft mehrere erlaubende Regeln mit ODER -
-- die grosszuegigere gewinnt, die Pruefung war wirkungslos. Deshalb
-- ausdruecklich beide Namen wegraeumen.
drop policy if exists "Bewerben" on public.bewerbungen;
drop policy if exists "Schueler bewirbt sich" on public.bewerbungen;

create policy "Schueler bewirbt sich" on public.bewerbungen
  for insert with check (
    auth.uid() = schueler_id
    and public.ist_verifiziert(auth.uid())
    and public.ist_alt_genug(auth.uid(), job_id)
  );

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
-- 1) Es gibt GENAU EINE INSERT-Regel, und sie nennt beide Pruefungen:
--
--   select policyname, with_check from pg_policies
--   where schemaname = 'public' and tablename = 'bewerbungen'
--     and cmd = 'INSERT';
--
--   Erwartet: eine Zeile, im with_check stehen ist_verifiziert UND
--   ist_alt_genug. Zwei Zeilen waeren der Fehler vom 26.8.
--
-- 2) Die Funktion antwortet richtig (mit Testdaten):
--
--   select public.ist_alt_genug('<testschueler>', '<job ab 16>');
--
--   Erwartet: false bei einem 14-jaehrigen Testkonto, true bei 16+.
--
-- 3) Gegenprobe ueber die API mit einem TESTKONTO (nie mit einem echten):
--    Als verifizierter 14-jaehriger Testschueler eine Bewerbung auf eine
--    "ab 16"-Anzeige einfuegen. Erwartet: Ablehnung durch die Zeilenregel.
--    Auf eine "ab 13"-Anzeige muss es weiter gehen.
--
-- 4) Der normale Weg muss unveraendert laufen: Im Schueler-Dashboard auf
--    einen sichtbaren Job bewerben - das sind ohnehin nur die passenden.
--
-- Rueckgaengig, falls noetig:
--   drop policy if exists "Schueler bewirbt sich" on public.bewerbungen;
--   create policy "Schueler bewirbt sich" on public.bewerbungen
--     for insert with check (
--       auth.uid() = schueler_id and public.ist_verifiziert(auth.uid()));
--   drop function if exists public.ist_alt_genug(uuid, uuid);
