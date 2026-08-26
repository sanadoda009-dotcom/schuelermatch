-- ============================================================
-- JOB-ALARM: „Neuer Job in deiner Nähe"
--
-- Angelegt am 26.8.2026. In OFFENE-PUNKTE.md stand er als
-- „stärkster Wachstums-Hebel": Wer heute nichts Passendes findet,
-- geht sonst und kommt nicht wieder.
--
-- AUFBAU
-- Ein Schüler hinterlegt EINEN Alarm: Ort, Umkreis und optional
-- Kategorie, Arbeitszeit und Mindestlohn. Einmal täglich prüft die
-- Edge Function `mail-job-alarm`, ob seitdem passende Jobs dazugekommen
-- sind, und schickt EINE Sammel-Mail.
--
-- WARUM NUR EINER PRO SCHÜLER
-- Mehrere Alarme bedeuten mehrere Mails und viel Verwaltung in der
-- Oberfläche. Wer die Kategorie leer lässt, bekommt ohnehin alles aus
-- seiner Gegend. Das deckt den Bedarf ab und hält die Postfächer ruhig —
-- bei Minderjährigen ein Argument für sich.
--
-- WARUM TÄGLICH STATT SOFORT
-- Dieselbe Überlegung wie bei `mail-digest` für Arbeitgeber: eine Mail
-- pro Tag statt einer pro Anzeige.
--
-- ANWENDEN: Im Supabase-SQL-Editor einfügen und ausführen.
-- Wiederholbar (if not exists / create or replace).
-- ============================================================

create table if not exists public.job_alarme (
  id               uuid primary key default gen_random_uuid(),
  -- Ein Alarm je Schüler; verschwindet mit dem Konto.
  schueler_id      uuid not null unique references public.profiles(id) on delete cascade,

  -- Wo gesucht wird. lat/lon kommen aus derselben Geokodierung wie die
  -- Umkreissuche; ohne sie wird nur der Ortsname verglichen.
  ort              text,
  lat              double precision,
  lon              double precision,
  umkreis_km       integer not null default 25,

  -- Optionale Einengung. NULL heißt „egal".
  kategorie        text,
  arbeitszeit      text,
  min_lohn         numeric,

  aktiv            boolean not null default true,

  -- Für den Abmelde-Link in der Mail. Ein Klick soll reichen, ohne
  -- Anmeldung — sonst meldet sich niemand ab und markiert stattdessen
  -- als Spam.
  abmelde_token    uuid not null default gen_random_uuid(),

  -- Ab wann gesucht wird. Beim Anlegen = jetzt, damit nicht sofort
  -- alle alten Anzeigen als „neu" verschickt werden.
  zuletzt_gesendet timestamptz not null default now(),
  erstellt_am      timestamptz not null default now(),

  constraint umkreis_sinnvoll check (umkreis_km between 1 and 200)
);

create index if not exists job_alarme_aktiv_idx on public.job_alarme (aktiv) where aktiv;
create unique index if not exists job_alarme_token_idx on public.job_alarme (abmelde_token);

alter table public.job_alarme enable row level security;


-- ------------------------------------------------------------
-- Zugriffsregeln: ausschließlich die eigene Zeile.
-- ------------------------------------------------------------
drop policy if exists "Eigenen Job-Alarm lesen" on public.job_alarme;
create policy "Eigenen Job-Alarm lesen" on public.job_alarme
  for select to authenticated using (schueler_id = auth.uid());

drop policy if exists "Job-Alarm anlegen" on public.job_alarme;
create policy "Job-Alarm anlegen" on public.job_alarme
  for insert to authenticated with check (schueler_id = auth.uid());

drop policy if exists "Eigenen Job-Alarm aendern" on public.job_alarme;
create policy "Eigenen Job-Alarm aendern" on public.job_alarme
  for update to authenticated using (schueler_id = auth.uid());

drop policy if exists "Eigenen Job-Alarm loeschen" on public.job_alarme;
create policy "Eigenen Job-Alarm loeschen" on public.job_alarme
  for delete to authenticated using (schueler_id = auth.uid());


-- ------------------------------------------------------------
-- Spalten-Trigger — dieselbe Lehre wie bei `jobs` am 26.8.:
-- Die UPDATE-Policy oben hat kein WITH CHECK, also muss ein Trigger
-- die Spalten festhalten, die niemand ändern darf.
--
-- `zuletzt_gesendet` gehört dazu: Wer den Wert zurückdrehen könnte,
-- bekäme alte Anzeigen erneut zugeschickt. `abmelde_token` ebenfalls —
-- er ist der Schlüssel zum Abmelden.
--
-- auth.uid() ist NULL, wenn die Edge Function mit dem Service-Role-
-- Schlüssel arbeitet. Genau dann DARF `zuletzt_gesendet` fortgeschrieben
-- werden, und genau dann greift dieser Block nicht.
-- ------------------------------------------------------------
create or replace function public.schuetze_job_alarm_felder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  new.id               := old.id;
  new.schueler_id      := old.schueler_id;
  new.abmelde_token    := old.abmelde_token;
  new.zuletzt_gesendet := old.zuletzt_gesendet;
  new.erstellt_am      := old.erstellt_am;
  return new;
end $$;

drop trigger if exists trg_schuetze_job_alarm on public.job_alarme;
create trigger trg_schuetze_job_alarm
  before update on public.job_alarme
  for each row execute function public.schuetze_job_alarm_felder();

revoke execute on function public.schuetze_job_alarm_felder() from public;


-- ------------------------------------------------------------
-- Abmelden per Token, ohne Anmeldung.
--
-- SECURITY DEFINER, weil der Aufrufer nicht eingeloggt ist und damit
-- an der RLS scheitern würde. Die Funktion kann NUR abschalten — sie
-- liest nichts aus und gibt nichts zurück, was ein Angreifer zum
-- Durchprobieren von Token nutzen könnte.
-- ------------------------------------------------------------
create or replace function public.job_alarm_abmelden(p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.job_alarme set aktiv = false where abmelde_token = p_token;
$$;

-- Bewusst für anon freigegeben: Der Abmelde-Link in der Mail muss ohne
-- Anmeldung funktionieren.
grant execute on function public.job_alarm_abmelden(uuid) to anon, authenticated;


-- ============================================================
-- PROBE NACH DEM ANWENDEN
--
--   select count(*) from public.job_alarme;                  -- 0
--   select tgname, tgenabled from pg_trigger
--   where tgrelid = 'public.job_alarme'::regclass and not tgisinternal;
--
-- Fachliche Probe siehe `pruefung-job-alarm.sql`.
-- ============================================================
