-- Grenzen fuer Bewerbungen und Freitextfelder (4.9.2026)
--
-- WARUM
-- Ich habe alle UNIQUE- und CHECK-Regeln der Datenbank ausgelesen. Fast
-- jede Tabelle hat welche:
--
--   bewertungen   UNIQUE (firma_id, schueler_id) · sterne 1-5 · kommentar <= 600
--   gemerkte_jobs UNIQUE (schueler_id, job_id)
--   job_alarme    UNIQUE (schueler_id) · umkreis_km 1-200
--   nachrichten   text nicht leer und <= 2000
--   meldungen     grund/typ/status aus fester Liste · beschreibung <= 1000
--   jobs          mindestalter 13-20 · stundenlohn 0-100 · titel nicht leer
--   profiles      role/firma_status/benachrichtigung aus fester Liste ·
--                 alter_jahre 13-20
--
-- `bewerbungen` hat als EINZIGE Tabelle GAR KEINE - weder UNIQUE noch CHECK.
--
-- WAS DARAUS FOLGT
--
-- 1) EIN SCHUELER KANN SICH BELIEBIG OFT AUF DIESELBE ANZEIGE BEWERBEN.
--    Im Browser faellt das nicht auf: `beworbenIds` blendet den Knopf
--    aus. Ueber die API mit dem oeffentlichen anon-Key nicht.
--
--    Das ist nicht nur Unordnung in der Liste der Firma. An jedem INSERT
--    haengt der Trigger `bewerbung_mail_insert` -> Edge Function
--    `mail-ereignis` -> Resend. Jede Doppelbewerbung ist also eine
--    weitere E-Mail von der verifizierten Domain. Der Resend-Freitarif
--    liegt bei 100 Mails am Tag; danach kommt gar nichts mehr an - auch
--    keine Zusage an einen Schueler, der darauf wartet.
--
-- 2) `status` DARF JEDER BELIEBIGE TEXT SEIN. Der Code kennt genau drei
--    Werte ('ausstehend', 'angenommen', 'abgelehnt'), und die
--    UPDATE-Regel laesst die Firma die Spalte setzen. Ein vierter Wert
--    laesst die Zeitleiste des Schuelers in einem Zustand stehen, den
--    keine Seite erklaeren kann. Jede andere Status-Spalte im Projekt
--    hat eine feste Liste.
--
-- 3) FREITEXT OHNE OBERGRENZE. `motivationsschreiben` hat weder in der
--    Datenbank noch im Formular eine Grenze (das <textarea> hatte kein
--    `maxlength`). Chat-Nachrichten sind auf 2000 begrenzt, Meldungen auf
--    1000, Bewertungen auf 600 - ausgerechnet das Feld, das eine fremde
--    Firma zu lesen bekommt, war offen. Dasselbe bei `jobs.beschreibung`,
--    die auf der oeffentlichen Boerse steht, und `profiles.ueber_mich`
--    (600 nur im HTML).
--
-- KEIN AUFRAEUMEN NOETIG
-- Am 4.9.2026 nachgezaehlt: 0 Doppelbewerbungen, nur die Status-Werte
-- 'angenommen' und 'abgelehnt' vorhanden, laengster Text 233 Zeichen
-- (jobs.beschreibung 118, profiles.ueber_mich 6). Alle Regeln greifen
-- also ohne eine einzige Aenderung an bestehenden Zeilen.
-- Vor dem Ausfuehren trotzdem kurz nachzaehlen - die Abfragen stehen unten.

-- ------------------------------------------------------------
-- 1) Eine Bewerbung je Anzeige und Schueler
-- ------------------------------------------------------------
-- Als INDEX statt als constraint: `if not exists` gibt es nur hier, und
-- ein zweiter Aufruf soll nicht mit einem Fehler abbrechen.
create unique index if not exists bewerbungen_job_schueler_idx
  on public.bewerbungen (job_id, schueler_id);

-- ------------------------------------------------------------
-- 2) Nur die drei Staende, die der Code kennt
-- ------------------------------------------------------------
alter table public.bewerbungen
  drop constraint if exists bewerbungen_status_check;

alter table public.bewerbungen
  add constraint bewerbungen_status_check
  check (status is null or status in ('ausstehend', 'angenommen', 'abgelehnt'));

-- ------------------------------------------------------------
-- 3) Obergrenzen fuer Freitext
-- ------------------------------------------------------------
-- 2000 wie bei den Chat-Nachrichten: Wer mehr schreiben will, soll das
-- im Gespraech tun, nicht im Formular.
alter table public.bewerbungen
  drop constraint if exists bewerbungen_motivation_check;

alter table public.bewerbungen
  add constraint bewerbungen_motivation_check
  check (motivationsschreiben is null or char_length(motivationsschreiben) <= 2000);

-- Die Beschreibung steht auf der oeffentlichen Boerse. 4000 ist reichlich
-- fuer eine Anzeige und immer noch eine Grenze.
alter table public.jobs
  drop constraint if exists jobs_beschreibung_check;

alter table public.jobs
  add constraint jobs_beschreibung_check
  check (beschreibung is null or char_length(beschreibung) <= 4000);

-- `ueber_mich` steht mit 600 im Formular (dashboard-firma.html) - hier
-- dieselbe Zahl, damit beide dasselbe sagen.
alter table public.profiles
  drop constraint if exists profiles_ueber_mich_check;

alter table public.profiles
  add constraint profiles_ueber_mich_check
  check (ueber_mich is null or char_length(ueber_mich) <= 600);

-- ------------------------------------------------------------
-- VORHER NACHZAEHLEN
-- ------------------------------------------------------------
--   select count(*) from (
--     select job_id, schueler_id from public.bewerbungen
--     group by 1,2 having count(*) > 1) x;                    -- erwartet 0
--   select distinct status from public.bewerbungen;           -- nur die drei
--   select max(char_length(motivationsschreiben)) from public.bewerbungen;
--   select max(char_length(beschreibung)) from public.jobs;
--   select max(char_length(ueber_mich)) from public.profiles;
--
-- NACHHER PRUEFEN
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.bewerbungen'::regclass;
--   select indexname from pg_indexes
--   where tablename = 'bewerbungen' and indexname = 'bewerbungen_job_schueler_idx';
--
-- Gegenprobe mit TESTKONTEN (nie mit echten): Zweimal dieselbe Bewerbung
-- einfuegen - der zweite Versuch muss abgelehnt werden.
--
-- Rueckgaengig, falls noetig:
--   drop index if exists public.bewerbungen_job_schueler_idx;
--   alter table public.bewerbungen drop constraint if exists bewerbungen_status_check;
--   alter table public.bewerbungen drop constraint if exists bewerbungen_motivation_check;
--   alter table public.jobs drop constraint if exists jobs_beschreibung_check;
--   alter table public.profiles drop constraint if exists profiles_ueber_mich_check;
