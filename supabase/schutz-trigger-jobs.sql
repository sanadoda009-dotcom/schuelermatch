-- ============================================================
-- SCHUTZ-TRIGGER FÜR `jobs` — NACHTRAG
--
-- Gefunden am 26.8.2026 beim Sichern der Zugriffsregeln.
-- ANGEWENDET am 26.8.2026 (Migration `schutz_trigger_jobs`), verifiziert.
-- Diese Datei ist ab jetzt die Sicherungskopie davon.
--
-- DER BEFUND
-- Für fünf Tabellen (profiles, bewerbungen, nachrichten, bewertungen,
-- meldungen) friert je ein BEFORE-UPDATE-Trigger die Spalten ein, die
-- niemand ändern darf. Für `jobs` gibt es keinen — die Tabelle wurde
-- beim Security-Audit vom 26.7. übersehen.
--
-- Drei Dinge treffen dort zusammen:
--   1. Die Policy "Firma bearbeitet eigene Jobs" hat kein WITH CHECK.
--      Sie prüft nur, welche Zeile angefasst werden darf — nicht, wie
--      die Zeile HINTERHER aussieht.
--   2. `authenticated` hat UPDATE-Recht auf ALLE Spalten von `jobs`,
--      `firma_id` eingeschlossen.
--   3. Kein Trigger fängt es ab.
--
-- WAS DARAUS FOLGT
-- Eine freigegebene Firma kann an ihrem EIGENEN Job `firma_id` auf eine
-- beliebige fremde Kennung setzen. Der Job wandert damit zu diesem
-- Konto — und mit ihm der Zugriff auf alles, was an ihm hängt:
--
--   * die Bewerbungen        (Policy "Firma sieht Bewerbungen auf eigene Jobs")
--   * die Bewerberprofile    (Policy "Firma sieht Profil von Bewerbern")
--     -> Name, Alter, Schule, Ort, E-Mail und Foto von Minderjährigen
--   * die Zeugnisse          (Policy "Firma sieht Zeugnis von Bewerbern")
--   * die Chatverläufe       (Policy "Nachrichten lesen")
--
-- FREMDE Jobs übernehmen kann man dadurch NICHT — das USING der Policy
-- verhindert es. Aber eigene weggeben schon, an ein Konto, das mit den
-- Bewerbern nie etwas zu tun hatte.
--
-- Eine Grenze gibt es: `jobs_firma_id_fkey` verlangt, dass die neue
-- Kennung in `profiles` existiert. Das Ziel muss also ein echtes Konto
-- der Plattform sein — beliebige Fantasiewerte gehen nicht. Das macht
-- den Befund kleiner, aber nicht harmlos: Jedes Schüler- oder
-- Firmenkonto taugt als Ziel, und Kennungen tauchen im Frontend auf.
--
-- Nebenbei behoben: `erstellt_am` war ebenfalls frei änderbar. Davon
-- hängen das „NEU"-Abzeichen und die Altersangabe der Anzeige ab — eine
-- Firma hätte ihre Anzeige beliebig oft wieder auf „neu" stellen können.
--
-- BEWUSST NICHT EINGEFROREN: `aufrufe`. Der Zähler wird von
-- `job_aufruf_zaehlen()` hochgesetzt, und zwar auch für eingeloggte
-- Besucher. Würde der Trigger die Spalte festhalten, zählte er deren
-- Aufrufe nicht mehr mit. Ein geschönter Zähler ist Eitelkeit, kein
-- Datenschutzproblem.
--
-- ANWENDEN: Im Supabase-SQL-Editor einfügen und ausführen.
-- Wiederholbar (drop ... if exists / create or replace).
-- ============================================================

create or replace function public.schuetze_job_felder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() ist NULL beim Zugriff über den Service-Role-Schlüssel
  -- oder direkt im SQL-Editor. Dann soll der Betreiber alles dürfen —
  -- genau wie bei den anderen Schutz-Triggern.
  if auth.uid() is null then return new; end if;

  new.id          := old.id;
  new.firma_id    := old.firma_id;
  new.erstellt_am := old.erstellt_am;
  return new;
end $$;

drop trigger if exists trg_schuetze_job on public.jobs;
create trigger trg_schuetze_job
  before update on public.jobs
  for each row execute function public.schuetze_job_felder();


-- ============================================================
-- PROBE NACH DEM ANWENDEN
--
-- Als eingeloggte Firma im Browser (Konsole des Firmen-Dashboards):
--
--   const { data } = await supabase.from('jobs')
--     .update({ firma_id: '00000000-0000-0000-0000-000000000000' })
--     .eq('id', '<eigene Job-Id>').select()
--   console.log(data[0].firma_id)   // muss die EIGENE Kennung sein
--
-- Der Aufruf schlägt nicht fehl — der Trigger setzt den Wert still
-- zurück. Genau so verhalten sich die anderen Schutz-Trigger auch.
--
-- Dass der Trigger läuft:
--   select tgname, tgenabled from pg_trigger
--   where tgrelid = 'public.jobs'::regclass and not tgisinternal;
-- ============================================================
