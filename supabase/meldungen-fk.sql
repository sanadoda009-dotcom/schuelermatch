-- =====================================================================
-- Meldungen überleben die Löschung des Melders
-- =====================================================================
--
-- DER BEFUND (26.8.2026)
-- `meldungen.melder_id` zeigt mit ON DELETE CASCADE auf `profiles`.
-- Wird ein Konto gelöscht, verschwinden damit ALLE MELDUNGEN, DIE DIESE
-- PERSON GESTELLT HAT.
--
-- Warum das nicht bloß unschön ist:
-- Ein Schüler meldet einen Erwachsenen wegen Belästigung im Chat. Danach
-- löscht er aus Angst oder Scham sein Konto — oder die Eltern verlangen
-- die Löschung. In dem Moment ist die Meldung weg. Der Betreiber
-- verliert den Vorgang, gegen den er ermitteln sollte, und die gemeldete
-- Person bleibt unbehelligt.
--
-- Bei der GEMELDETEN Person steht der Fremdschlüssel schon richtig auf
-- SET NULL: Wird sie gelöscht, bleibt der Vorgang erhalten. Genau das
-- muss auch für den Melder gelten. Die Asymmetrie ist die Lücke.
--
-- Die Datenschutzerklärung deckt das Aufbewahren ausdrücklich ab:
-- Meldungen bleiben „bis zur Klärung und darüber hinaus so lange, wie es
-- zur Sicherheit der Plattform nötig ist (z.B. um wiederholte Verstöße
-- zu erkennen)". Nach der Anonymisierung ist kein Personenbezug mehr
-- übrig — der Vorgang bleibt, die Person ist raus.
--
-- STAND BEIM SCHREIBEN
-- `select count(*) from public.meldungen` ergab 0. Es ist also noch
-- nichts verloren gegangen, und die Umstellung trifft keine Zeile.
--
-- ANWENDUNG
-- Im Supabase-SQL-Editor ausführen. Wiederholtes Ausführen ist
-- unschädlich. Danach die Prüfabfrage am Ende laufen lassen.
-- =====================================================================

begin;

-- 1) Die Spalte muss leer sein dürfen — sonst kann SET NULL nicht
--    greifen. (Vorher: NOT NULL.)
alter table public.meldungen
  alter column melder_id drop not null;

-- 2) Fremdschlüssel von CASCADE auf SET NULL umstellen.
--    Der Name ist der von Postgres vergebene Standardname; falls er
--    abweicht, zeigt ihn die Prüfabfrage unten.
alter table public.meldungen
  drop constraint if exists meldungen_melder_id_fkey;

alter table public.meldungen
  add constraint meldungen_melder_id_fkey
  foreign key (melder_id) references public.profiles(id)
  on delete set null;

comment on column public.meldungen.melder_id is
  'Wer gemeldet hat. NULL = Konto wurde gelöscht, der Vorgang bleibt '
  'trotzdem bestehen (Sicherheit der Plattform). Bewusst SET NULL statt '
  'CASCADE - sonst nähme ein Schüler seine Meldung mit, wenn er sein '
  'Konto löscht. Siehe supabase/meldungen-fk.sql.';

commit;


-- ---------------------------------------------------------------------
-- Prüfen
-- ---------------------------------------------------------------------
-- Erwartet: delete_rule = SET NULL, is_nullable = YES.

select kcu.column_name,
       rc.delete_rule,
       (select c.is_nullable from information_schema.columns c
         where c.table_schema='public' and c.table_name='meldungen'
           and c.column_name = kcu.column_name) as is_nullable,
       tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name = 'meldungen'
  and kcu.column_name in ('melder_id', 'gemeldet_user_id');


-- ---------------------------------------------------------------------
-- HINWEIS FÜR DEN BETREIBER-BEREICH
-- ---------------------------------------------------------------------
-- Nach dieser Änderung kann `melder_id` NULL sein. admin.html zeigt in
-- dem Fall keinen Melder mehr an — das ist richtig so, sollte aber als
-- „Konto gelöscht" erkennbar sein statt als leeres Feld.
-- tests/admin-meldungen.spec.js hält das fest.
