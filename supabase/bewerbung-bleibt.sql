-- Eine Bewerbung gehoert dem Schueler - auch wenn die Anzeige weg ist
-- (4.9.2026)
--
-- WARUM
-- Ausgelesen aus der laufenden Datenbank:
--
--   bewerbungen.job_id        -> jobs         ON DELETE CASCADE
--   nachrichten.bewerbung_id  -> bewerbungen  ON DELETE CASCADE
--
-- Und auf `jobs` steht die Loeschregel "auth.uid() = firma_id": Eine
-- Firma darf ihre eigene Anzeige jederzeit loeschen.
--
-- Zusammen heisst das: EIN Klick der Firma loescht
--   * jede Bewerbung auf diese Anzeige,
--   * und ueber die zweite Kaskade den kompletten Chat dazu.
--
-- Das sind Daten, die zum SCHUELER gehoeren - seine Bewerbung, seine
-- Nachrichten, sein Nachweis, dass er angenommen wurde. Geloescht von
-- der Gegenseite, ohne Rueckfrage und ohne Nachricht. Im Dashboard des
-- Schuelers verschwindet der Eintrag einfach.
--
-- Es ist dasselbe Muster wie am 27.8. bei `meldungen.melder_id` und am
-- 2.9. bei `meldungen.job_id`: eine Kaskade, die der Gegenseite Macht
-- ueber fremde Daten gibt. Nur wiegt es hier schwerer, weil die Firma
-- damit auch belegen kann, dass es die Bewerbung nie gab.
--
-- WAS DIESE DATEI AENDERT
-- 1) job_id wird auf ON DELETE SET NULL gestellt und darf NULL sein.
--    Die Bewerbung bleibt dann stehen, nur ohne Anzeige daran.
-- 2) Damit die Bewerbung danach noch lesbar ist, bekommt sie eine Kopie
--    des Anzeigentitels: `job_titel`. Ohne die staende beim Schueler nur
--    "Anzeige nicht mehr verfuegbar" - richtig, aber wertlos.
--    Ein Trigger fuellt sie beim Anlegen; bestehende Zeilen werden
--    einmalig nachgetragen.
--
-- WAS SIE NICHT AENDERT
-- Die Firma darf ihre Anzeige weiter loeschen. Das ist ihr gutes Recht -
-- sie soll nur nicht die Bewerbungen anderer Leute mitloeschen.

-- ------------------------------------------------------------
-- 1) Titel-Kopie
-- ------------------------------------------------------------
alter table public.bewerbungen
  add column if not exists job_titel text;

-- Bestehende Bewerbungen einmalig nachtragen.
update public.bewerbungen b
   set job_titel = j.titel
  from public.jobs j
 where b.job_id = j.id
   and b.job_titel is null;

-- Beim Anlegen automatisch mitschreiben, damit niemand daran denken muss.
create or replace function public.bewerbung_job_titel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.job_titel is null and new.job_id is not null then
    select titel into new.job_titel from public.jobs where id = new.job_id;
  end if;
  return new;
end;
$$;

drop trigger if exists bewerbung_job_titel_trg on public.bewerbungen;
create trigger bewerbung_job_titel_trg
  before insert on public.bewerbungen
  for each row execute function public.bewerbung_job_titel();

-- ------------------------------------------------------------
-- 2) Die Kaskade aufloesen
-- ------------------------------------------------------------
alter table public.bewerbungen
  alter column job_id drop not null;

alter table public.bewerbungen
  drop constraint if exists bewerbungen_job_id_fkey;

alter table public.bewerbungen
  add constraint bewerbungen_job_id_fkey
  foreign key (job_id) references public.jobs(id) on delete set null;

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
-- 1) Die Regel steht jetzt auf SET NULL:
--
--   select tc.table_name, kcu.column_name, rc.delete_rule
--   from information_schema.table_constraints tc
--   join information_schema.key_column_usage kcu
--     on kcu.constraint_name = tc.constraint_name
--   join information_schema.referential_constraints rc
--     on rc.constraint_name = tc.constraint_name
--   where tc.constraint_type = 'FOREIGN KEY'
--     and tc.table_name = 'bewerbungen';
--
--   Erwartet: job_id ... SET NULL   (schueler_id bleibt CASCADE - mit dem
--   eigenen Konto SOLL die eigene Bewerbung verschwinden.)
--
-- 2) Jede Bewerbung hat einen Titel:
--
--   select count(*) from public.bewerbungen where job_titel is null;
--   Erwartet: 0
--
-- 3) Gegenprobe im Browser: Eine Testanzeige mit einer Testbewerbung
--    loeschen. Im Schueler-Dashboard muss die Bewerbung STEHENBLEIBEN,
--    mit dem Titel und dem Zusatz "Anzeige wurde entfernt".
--    ACHTUNG: nur mit Testdaten, nie mit echten Konten.
--
-- Rueckgaengig, falls noetig:
--   alter table public.bewerbungen drop constraint bewerbungen_job_id_fkey;
--   alter table public.bewerbungen add constraint bewerbungen_job_id_fkey
--     foreign key (job_id) references public.jobs(id) on delete cascade;
--   drop trigger if exists bewerbung_job_titel_trg on public.bewerbungen;
--   drop function if exists public.bewerbung_job_titel();
--   -- job_titel bewusst stehen lassen; sie schadet nicht.
