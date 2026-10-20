-- Die Titel-Kopie einer Bewerbung darf die Firma nicht umschreiben
-- (20.10.2026, am selben Tag eingespielt)
--
-- SETZT VORAUS: bewerbung-bleibt.sql, bewerbung-stand.sql
-- (sie legen `job_titel` und `angesehen_am` an; ohne sie scheitert die
-- Funktion beim ersten UPDATE an einer unbekannten Spalte)
--
-- WARUM
-- Mit supabase/bewerbung-bleibt.sql bekam `bewerbungen` am 20.10. die
-- Spalte `job_titel`: eine Kopie des Anzeigentitels. Sie ist das, was dem
-- Schueler bleibt, wenn die Firma ihre Anzeige loescht - der Nachweis,
-- WORAUF er sich beworben hat (und ggf. angenommen wurde).
--
-- Der Schutz-Trigger dieser Tabelle stammt vom 27.8.:
--
--   schuetze_bewerbung_felder()  friert ein:
--     id, job_id, schueler_id, motivationsschreiben, zeugnis_url,
--     lebenslauf_url, erstellt_am
--
-- `job_titel` kam spaeter und steht NICHT darin. Die UPDATE-Regel laesst
-- die Firma jede Zeile zu ihren Anzeigen aendern - also auch diese
-- Spalte. Am 20.10. aus der laufenden Datenbank ausgelesen.
--
-- Eine Firma konnte damit den Titel jeder Bewerbung nachtraeglich
-- umschreiben, etwa nachdem sie die Anzeige geloescht hat. Genau der Fall,
-- fuer den es die Kopie gibt.
--
-- DASSELBE MUSTER WIE AM 4.9. bei `profiles.email`: Eine neue Spalte
-- kommt dazu, der alte Trigger kennt sie nicht. Bei jeder neuen Spalte
-- fragen: Wer darf sie nach dem Anlegen noch aendern?
--
-- WAS DIESE DATEI AENDERT
-- 1) `job_titel` wird eingefroren wie die anderen Felder des Schuelers.
-- 2) `angesehen_am` darf nur einmal gesetzt werden. Das Dashboard schreibt
--    es ohnehin nur, wenn es noch leer ist (js/dashboard-firma.js); ein
--    spaeteres Umschreiben verfaelschte die Zeitleiste des Schuelers.
--
-- WAS SIE NICHT AENDERT
-- `status`, `entschieden_am` und `absage_grund` bleiben fuer die Firma
-- aenderbar - sie entscheidet, und eine Entscheidung darf sie korrigieren.

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
  -- Neu am 20.10.2026
  new.job_titel            := old.job_titel;
  new.angesehen_am         := coalesce(old.angesehen_am, new.angesehen_am);
  return new;
end $$;

-- Der Trigger selbst bleibt, wie er ist (trg_schuetze_bewerbung).

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
-- 1) Die Funktion nennt beide neuen Zeilen:
--
--   select pg_get_functiondef('public.schuetze_bewerbung_felder'::regproc);
--
--   Erwartet: `new.job_titel := old.job_titel` und
--   `coalesce(old.angesehen_am, new.angesehen_am)`.
--
-- 2) Gegenprobe ohne Spuren (Transaktion, am Ende rollback), als Firma:
--      update bewerbungen set job_titel = 'X' where id = '<eine bewerbung>';
--    Danach steht der alte Titel da. Siehe supabase/pruefen/regeln-live-pruefen.sql.
--
-- Rueckgaengig, falls noetig: dieselbe Funktion ohne die zwei Zeilen
-- unter "Neu am 20.10.2026".
