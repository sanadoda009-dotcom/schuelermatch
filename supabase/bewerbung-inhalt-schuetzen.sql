-- Eine Firma darf den Stand aendern, nicht den Inhalt (2.9.2026)
--
-- WARUM
-- Die UPDATE-Regel auf `bewerbungen` heisst "Firma aendert Status eigener
-- Bewerbungen" - sie schraenkt aber keine SPALTEN ein:
--
--   using (exists (select 1 from jobs
--                  where jobs.id = bewerbungen.job_id
--                    and jobs.firma_id = auth.uid()))
--
-- RLS wirkt nur auf Zeilen, nie auf Spalten. Eine Firma darf damit die
-- GANZE Zeile aendern - auch `motivationsschreiben`, also den Text, den
-- der Schueler geschrieben hat, und die Verweise auf seinen Lebenslauf und
-- sein Zeugnis. Sie koennte eine Bewerbung auch einem anderen Job oder
-- einem anderen Schueler zuordnen.
--
-- Aufgefallen beim Einbau des Bewerbungsstands: Fuer `angesehen_am`,
-- `entschieden_am` und `absage_grund` musste geprueft werden, ob die Firma
-- diese Spalten ueberhaupt schreiben darf. Sie darf - und alles andere
-- eben auch.
--
-- Spaltenrechte kann Postgres per GRANT vergeben, das greift hier aber
-- nicht: Alle Zugriffe laufen ueber dieselbe Rolle `authenticated`, und
-- der Schueler braucht dieselben Spalten zum Anlegen. Deshalb ein Trigger:
-- Er laesst die Entscheidungsspalten durch und weist alles andere ab.
--
-- VORHER PRUEFEN - die Regel ohne Spaltengrenze:
--   select policyname, cmd, qual
--   from pg_policies
--   where schemaname = 'public' and tablename = 'bewerbungen' and cmd = 'UPDATE';

create or replace function public.bewerbung_nur_stand_aendern()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ohne angemeldeten Nutzer laeuft der Zugriff ueber den Dienstschluessel
  -- (Edge Functions, Wartung). Der soll weiter alles duerfen - RLS haelt
  -- normale Besucher davor ohnehin auf.
  if auth.uid() is null then
    return new;
  end if;

  if new.id                   is distinct from old.id
     or new.job_id            is distinct from old.job_id
     or new.schueler_id       is distinct from old.schueler_id
     or new.erstellt_am       is distinct from old.erstellt_am
     or new.motivationsschreiben is distinct from old.motivationsschreiben
     or new.lebenslauf_url    is distinct from old.lebenslauf_url
     or new.zeugnis_url       is distinct from old.zeugnis_url
  then
    raise exception
      'An einer Bewerbung darf nur der Stand geaendert werden (status, angesehen_am, entschieden_am, absage_grund) - nicht ihr Inhalt.'
      using errcode = '42501';
  end if;

  return new;
end
$$;

drop trigger if exists trg_bewerbung_nur_stand on public.bewerbungen;

create trigger trg_bewerbung_nur_stand
  before update on public.bewerbungen
  for each row
  execute function public.bewerbung_nur_stand_aendern();

-- NACHHER PRUEFEN - muss GENAU EINE Zeile liefern:
--
--   select tgname, tgenabled
--   from pg_trigger
--   where tgrelid = 'public.bewerbungen'::regclass
--     and tgname = 'trg_bewerbung_nur_stand';
--
-- GEGENPROBE (als Firma, im Browser der Firma auf ihrer eigenen Anzeige):
-- Annehmen und Ablehnen muessen weiter gehen. Ein Versuch, das
-- Anschreiben zu aendern, muss mit der Meldung oben scheitern.
--
-- HINWEIS ZUR REIHENFOLGE
-- Diese Datei setzt voraus, dass supabase/bewerbung-stand.sql schon
-- eingespielt ist - sonst gibt es die Spalten `angesehen_am`,
-- `entschieden_am` und `absage_grund` noch nicht. Der Trigger selbst
-- nennt sie nicht, er wuerde also auch vorher laufen; die Reihenfolge ist
-- nur der Klarheit halber wichtig.
--
-- Rueckgaengig, falls noetig:
--   drop trigger if exists trg_bewerbung_nur_stand on public.bewerbungen;
--   drop function if exists public.bewerbung_nur_stand_aendern();
