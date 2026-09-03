-- Die oeffentliche Firmenseite (2.9.2026)
--
-- WARUM
-- Ein Schueler sieht von einer Firma bisher nur einen Namen auf der
-- Anzeige. Nachsehen, WER das ist, kann er nirgends. Bei einer Plattform,
-- auf der sich Minderjaehrige bewerben, ist das die falsche Reihenfolge.
--
-- Ein Firmenprofil darf heute aber niemand lesen ausser der Firma selbst:
--
--   "Eigenes Profil lesen"            using (auth.uid() = id)
--   "Firma sieht Profil von Bewerbern"  ... nur die eigenen Bewerber
--   "Admin liest alle Profile"          ... ist_admin()
--
-- Eine Regel "alle duerfen Firmenprofile lesen" waere der falsche Weg:
-- RLS wirkt auf ZEILEN, nicht auf Spalten. Wer die Zeile lesen darf, liest
-- sie ganz - bei einer Firma also auch `email` und `benachrichtigung`.
-- Eine oeffentlich abgreifbare Firmen-E-Mail ist eine Einladung fuer
-- Spam, und in derselben Tabelle stehen die Schuelerprofile.
--
-- Deshalb eine SICHT mit genau den Spalten, die oeffentlich sein sollen.
-- Eine Sicht laeuft mit den Rechten ihres Besitzers, umgeht also RLS auf
-- `profiles` - und zeigt trotzdem nur, was hier drinsteht.
--
-- Aufgenommen werden nur FREIGEGEBENE Firmen. Wer noch in Pruefung ist,
-- hat keine oeffentliche Seite - genau wie seine Anzeigen noch nicht
-- sichtbar sind.

create or replace view public.firmen_oeffentlich as
  select
    p.id,
    p.name,
    p.ort,
    p.foto_url,
    p.ueber_mich,
    p.erstellt_am
  from public.profiles p
  where p.role = 'firma'
    and p.firma_status = 'freigegeben';

grant select on public.firmen_oeffentlich to anon, authenticated;

-- NACHHER PRUEFEN
--
-- 1) Die Sicht gibt es und sie zeigt NUR die sechs Spalten:
--
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'firmen_oeffentlich'
--   order by ordinal_position;
--
--   Erwartet: id, name, ort, foto_url, ueber_mich, erstellt_am
--   Insbesondere KEIN email, KEIN benachrichtigung, KEIN role.
--
-- 2) Nur freigegebene Firmen, keine Schueler:
--
--   select count(*) from public.firmen_oeffentlich;
--   select count(*) from public.profiles
--   where role = 'firma' and firma_status = 'freigegeben';
--
--   Beide Zahlen muessen gleich sein.
--
-- 3) Gegenprobe ohne Anmeldung (im Browser, abgemeldet, auf der Seite):
--   Die Firmenseite muss "Wer wir sind" und das Logo zeigen. Vorher
--   stand dort nur der Name aus der Anzeige.
--
-- Rueckgaengig, falls noetig:
--   drop view if exists public.firmen_oeffentlich;
