-- =====================================================================
-- Keine Anzeige unter 13 Jahren
-- =====================================================================
--
-- DER BEFUND (26.8.2026)
-- Das Anzeigenformular bot als Mindestalter **10, 11 und 12** an, und
-- geprüft wurde der Wert an keiner Stelle — weder im Browser noch in der
-- Datenbank. Eine freigegebene Firma konnte also eine Anzeige „ab 10
-- Jahren" veröffentlichen, und sie ging sofort live.
--
-- Nach § 5 Abs. 1 JArbSchG ist die Beschäftigung von Kindern verboten;
-- § 5 Abs. 3 erlaubt ab 13 leichte, kindgerechte Tätigkeiten mit
-- Einwilligung der Eltern. Eine Anzeige „ab 10" wirbt damit für etwas,
-- das nicht erlaubt ist — auf einer Plattform, deren Kernversprechen
-- der Jugendarbeitsschutz ist.
--
-- Die Seite widersprach sich dabei selbst: `jugendarbeitsschutz.html`
-- sagt wörtlich „Unter 13 Jahren: Arbeiten ist grundsätzlich nicht
-- erlaubt", die Startseite wirbt mit „ab 13". Nur das Formular wusste
-- nichts davon.
--
-- WARUM ES DIESE DATEI BRAUCHT
-- Die Auswahlliste im Browser ist repariert (nur noch 13–20) und
-- `js/jugendschutz.js` prüft zusätzlich vor dem Absenden. Beides ist
-- aber kein Schutz: Wer die API direkt anspricht, umgeht es. Erst diese
-- Regel macht es verbindlich.
--
-- STAND BEIM SCHREIBEN
-- Niedrigstes Mindestalter in der Datenbank: 15. Es ist also nichts
-- Rechtswidriges live, und die Regel trifft keine bestehende Zeile.
-- Die Prüfabfrage unten bestätigt das vor dem Anlegen.
--
-- ANWENDUNG
-- Im Supabase-SQL-Editor ausführen. Wiederholtes Ausführen ist
-- unschädlich.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Vorher prüfen (nur lesen)
-- ---------------------------------------------------------------------
-- Muss LEER sein. Kommt hier etwas, erst klären, was mit diesen Anzeigen
-- passieren soll — die Regel unten würde sonst gar nicht erst anlegen.

select id, titel, mindestalter, aktiv, firma_name, erstellt_am
from public.jobs
where mindestalter is not null and mindestalter < 13
order by erstellt_am;


-- ---------------------------------------------------------------------
-- Die Regel
-- ---------------------------------------------------------------------
-- NULL bleibt erlaubt: Es gibt Anzeigen ohne Altersangabe, und die sind
-- kein Rechtsverstoß, sondern nur unvollständig.

alter table public.jobs
  drop constraint if exists jobs_mindestalter_jarbschg;

alter table public.jobs
  add constraint jobs_mindestalter_jarbschg
  check (mindestalter is null or (mindestalter >= 13 and mindestalter <= 20));

comment on constraint jobs_mindestalter_jarbschg on public.jobs is
  'Unter 13 ist Arbeiten nicht erlaubt (§ 5 Abs. 1 JArbSchG); ab 13 nur '
  'leichte Taetigkeiten mit Einwilligung der Eltern (§ 5 Abs. 3). Die '
  'Obergrenze 20 entspricht der Auswahlliste im Anzeigenformular. '
  'Siehe supabase/mindestalter-grenze.sql und js/jugendschutz.js.';


-- ---------------------------------------------------------------------
-- Prüfen
-- ---------------------------------------------------------------------
-- Erwartet: eine Zeile mit der Regel.

select conname as regel, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.jobs'::regclass
  and conname = 'jobs_mindestalter_jarbschg';


-- Gegenprobe (soll FEHLSCHLAGEN — das ist der Beweis, dass die Regel
-- greift). Läuft in einer Transaktion, die zurückgerollt wird.
--
--   begin;
--   insert into public.jobs (firma_id, titel, ort, mindestalter, aktiv)
--   values ((select id from public.profiles where role='firma' limit 1),
--           'Testanzeige', 'Teststadt', 10, false);
--   rollback;
--
-- Erwartete Meldung:
--   new row for relation "jobs" violates check constraint
--   "jobs_mindestalter_jarbschg"
