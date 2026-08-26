-- =====================================================================
-- Kein Konto unter 13 Jahren
-- =====================================================================
--
-- DER BEFUND (26.8.2026)
-- Die Registrierung bot als Alter **10, 11 und 12** an, und die Regel
-- `chk_alter_jahre` liess ab 10 zu. Ein Zehnjähriger konnte sich also
-- ein Konto anlegen — auf einer Plattform, die überall „ab 13" sagt und
-- deren Zweck die Vermittlung von Arbeit ist.
--
-- Das ist die Schülerseite desselben Fehlers, der in
-- `supabase/mindestalter-grenze.sql` für die Anzeigen behoben wird:
-- § 5 Abs. 1 JArbSchG verbietet die Beschäftigung von Kindern, ab 13
-- sind leichte Tätigkeiten mit Einwilligung der Eltern erlaubt.
--
-- STAND BEIM SCHREIBEN
-- Jüngstes Profil: 15 (dazu eines ohne Altersangabe). Die Regel trifft
-- keine bestehende Zeile.
--
-- ANWENDUNG
-- Im Supabase-SQL-Editor ausführen. Wiederholt ausführbar.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Vorher prüfen (nur lesen)
-- ---------------------------------------------------------------------
-- Muss leer sein.

select id, name, role, alter_jahre, email, erstellt_am
from public.profiles
where alter_jahre is not null and alter_jahre < 13
order by erstellt_am;


-- ---------------------------------------------------------------------
-- Die Regel
-- ---------------------------------------------------------------------
-- `chk_alter_jahre` gibt es schon (ab 10). Sie wird ERSETZT, nicht
-- ergänzt — zwei Regeln nebeneinander sind für jeden späteren Leser
-- eine Stolperfalle.
--
-- NULL bleibt erlaubt: Firmenkonten haben kein Alter, und ein Profil
-- ohne Altersangabe ist unvollständig, aber nicht rechtswidrig.

alter table public.profiles
  drop constraint if exists chk_alter_jahre;

alter table public.profiles
  add constraint chk_alter_jahre
  check (alter_jahre is null or (alter_jahre >= 13 and alter_jahre <= 20));

comment on constraint chk_alter_jahre on public.profiles is
  'Ab 13: Unter 13 ist Arbeiten in Deutschland nicht erlaubt '
  '(§ 5 Abs. 1 JArbSchG). NULL fuer Firmenkonten. '
  'Siehe supabase/alter-grenze.sql und js/jugendschutz.js.';


-- ---------------------------------------------------------------------
-- Prüfen
-- ---------------------------------------------------------------------
-- Erwartet: >= 13 in der Definition.

select conname as regel, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'chk_alter_jahre';


-- ---------------------------------------------------------------------
-- DAZU: die Einwilligung der Eltern (Art. 7 Abs. 1 DSGVO)
-- ---------------------------------------------------------------------
-- Bei der Registrierung wird das Häkchen „Ich habe die Erlaubnis meiner
-- Eltern" abgefragt — und war bis zum 26.8. **weggeworfen**. Art. 7
-- Abs. 1 DSGVO verlangt aber, dass der Verantwortliche *nachweisen kann*,
-- dass eingewilligt wurde.
--
-- Seit dem 26.8. wandert es als `eltern_einwilligung` samt Zeitpunkt in
-- `auth.users.raw_user_meta_data` — dafür war keine Schema-Änderung
-- nötig, `handle_new_user` ignoriert unbekannte Schlüssel einfach.
--
-- Damit ist es festgehalten. Wer es bequemer einsehen will, kann es
-- zusätzlich ins Profil ziehen (optional, NICHT nötig):
--
--   alter table public.profiles
--     add column if not exists eltern_einwilligung boolean,
--     add column if not exists eltern_einwilligung_am timestamptz;
--
--   -- und in handle_new_user() ergänzen:
--   --   (new.raw_user_meta_data->>'eltern_einwilligung')::boolean,
--   --   (new.raw_user_meta_data->>'eltern_einwilligung_am')::timestamptz
--
-- ACHTUNG, falls das gemacht wird: Der Trigger `trg_schuetze_profil`
-- muss die beiden Spalten einfrieren, sonst könnte ein Nutzer die
-- eigene Einwilligung nachträglich setzen — und der Nachweis wäre
-- wertlos.

-- So lässt sich der Nachweis heute schon abfragen:
select u.id,
       u.email,
       u.created_at as angemeldet_am,
       u.raw_user_meta_data->>'alter_jahre'            as alter_jahre,
       u.raw_user_meta_data->>'eltern_einwilligung'    as einwilligung,
       u.raw_user_meta_data->>'eltern_einwilligung_am' as einwilligung_am
from auth.users u
order by u.created_at desc;
