-- Ein Schuelerkonto braucht ein Alter (1.9.2026)
--
-- WARUM
-- `profiles.alter_jahre` ist NULLABLE. Die bestehende Regel
-- `chk_alter_jahre` (>= 13 und <= 20) faengt das nicht ab: In SQL ist
-- `NULL >= 13` weder wahr noch falsch, und eine CHECK-Regel gilt als
-- erfuellt, solange sie nicht falsch ist.
--
-- Was das im Browser angerichtet hat: Das Schueler-Dashboard filterte
--     if (profile.alter_jahre) query = query.lte('mindestalter', ...)
-- Fehlte das Alter, wurde der Filter also GANZ WEGGELASSEN - der Schueler
-- sah jede Anzeige, auch eine "ab 18". Im Code behoben; ohne Angabe gilt
-- jetzt die Untergrenze der Plattform (13 Jahre) plus ein sichtbarer
-- Hinweis. Diese Datei schliesst die Luecke da, wo sie herkommt.
--
-- `alter_jahre` auf NOT NULL zu setzen geht nicht: Firmenkonten haben kein
-- Alter. Deshalb eine Regel, die nur fuer Schueler greift.
--
-- VORHER PRUEFEN - welche Schuelerkonten haben kein Alter?
--   select id, email, name, erstellt_am
--   from public.profiles
--   where role = 'schueler' and alter_jahre is null;
--
-- Stand 1.9.2026: EINE Zeile. Die muss vorher versorgt werden, sonst
-- scheitert die Regel. NICHT blind einen Wert eintragen - das ist eine
-- Altersangabe, und eine falsche waere schlimmer als eine fehlende.
-- Entweder nachtragen lassen, oder als Testkonto behandeln.

alter table public.profiles
  add constraint chk_schueler_hat_alter
  check (role <> 'schueler' or alter_jahre is not null);

-- NACHHER PRUEFEN - muss GENAU EINE Zeile liefern:
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.profiles'::regclass
--     and conname = 'chk_schueler_hat_alter';
--
-- Rueckgaengig, falls noetig:
--   alter table public.profiles drop constraint chk_schueler_hat_alter;
