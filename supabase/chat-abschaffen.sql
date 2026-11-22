-- Den Chat abschaffen - die Firma meldet sich per Telefon oder E-Mail
-- (22.11.2026, eingespielt)
--
-- SETZT VORAUS: bewerbung-bleibt.sql, bewerbung-stand.sql, bewerbung-titel-festnageln.sql, meldungen-bleiben.sql
-- (ersetzt dieselbe Schutzfunktion; die Meldungen behalten beim Loeschen
-- der Nachrichten ihren Wortlaut, weil nachricht_id auf SET NULL steht)
--
-- WARUM
-- Sanads Entscheidung am 22.11.2026: Ein Chat, in dem ein Erwachsener
-- einem Kind frei formuliert schreibt, kann zu Skandalen fuehren - auch
-- mit Warnhinweisen und Meldeknopf. SchuelerMatch macht es jetzt wie die
-- grossen Jobboersen: Nach einer Zusage meldet sich die Firma beim
-- Bewerber, per Telefon oder E-Mail.
--
-- WAS DIESE DATEI AENDERT
-- 1) Alle Chat-Nachrichten werden ENDGUELTIG geloescht (am 22.11.: zwei,
--    beides Testdaten). Sanad hat das ausdruecklich so gewaehlt. Eine
--    offene Meldung ueber eine Nachricht bleibt bestehen - mit dem
--    gespeicherten Wortlaut (`zitat`), nur ohne Verweis.
-- 2) Niemand kann mehr Nachrichten lesen oder schreiben: Alle Regeln auf
--    `nachrichten` fallen weg, RLS bleibt an - ohne Regel ist nichts
--    erlaubt. Die Tabelle selbst bleibt (meldungen.nachricht_id verweist
--    darauf), ist aber leer und zu.
-- 3) Neue Spalte `bewerbungen.telefon`: freiwillig, beim Bewerben
--    angegeben ("deine oder die deiner Eltern"), sichtbar nur fuer die
--    Firma dieser Anzeige (die bestehende Leseregel auf bewerbungen).
--    Nur Ziffern und + ( ) / - Leerzeichen, 6 bis 25 Zeichen. Nach dem
--    Absenden eingefroren wie der Rest der Bewerbung.

-- 1) Nachrichten loeschen
delete from public.nachrichten;

-- 2) Chat schliessen
drop policy if exists "Nachricht senden" on public.nachrichten;
drop policy if exists "Nachrichten lesen" on public.nachrichten;
drop policy if exists "Nachricht als gelesen markieren" on public.nachrichten;
drop policy if exists "Gesperrte Firma: keine Nachrichten" on public.nachrichten;
alter table public.nachrichten enable row level security;
revoke insert, update, delete on public.nachrichten from anon, authenticated;

-- 3) Telefonnummer fuer die Rueckmeldung
alter table public.bewerbungen
  add column if not exists telefon text;
alter table public.bewerbungen
  drop constraint if exists bewerbungen_telefon_check;
alter table public.bewerbungen
  add constraint bewerbungen_telefon_check
  check (telefon is null or telefon ~ '^[0-9 +()/-]{6,25}$');

create or replace function public.schuetze_bewerbung_felder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  new.id                   := old.id;
  new.job_id               := old.job_id;
  new.schueler_id          := old.schueler_id;
  new.motivationsschreiben := old.motivationsschreiben;
  new.zeugnis_url          := old.zeugnis_url;
  new.lebenslauf_url       := old.lebenslauf_url;
  new.erstellt_am          := old.erstellt_am;
  -- 20.10.2026
  new.job_titel            := old.job_titel;
  new.angesehen_am         := coalesce(old.angesehen_am, new.angesehen_am);
  -- 22.11.2026: Die Rueckrufnummer gehoert zur Bewerbung des Schuelers
  new.telefon              := old.telefon;
  return new;
end $$;

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
--   select count(*) from public.nachrichten;                          -- 0
--   select count(*) from pg_policies where tablename = 'nachrichten'; -- 0
--   select column_name from information_schema.columns
--    where table_name = 'bewerbungen' and column_name = 'telefon';    -- 1 Zeile
--
-- Gegenprobe ohne Spuren (Transaktion + rollback): als Schueler mit Zusage
--   insert into nachrichten (...)  -> abgelehnt (42501)
--
-- Rueckgaengig, falls noetig: Die geloeschten Nachrichten kommen nicht
-- zurueck. Die Regeln stehen in chat-erst-nach-zusage.sql und
-- firma-gesperrt-kein-kontakt.sql; die Spalte telefon kann bleiben.
