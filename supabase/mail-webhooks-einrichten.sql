-- ============================================================
-- E-MAIL-BENACHRICHTIGUNGEN AKTIVIEREN
-- Einmalig im Supabase SQL-Editor ausführen (Copy-Paste + Run).
--
-- Was das tut:
--  1. Aktiviert pg_net (HTTP-Aufrufe aus der DB) + pg_cron (Zeitpläne)
--  2. Trigger: neue Bewerbung / Statuswechsel -> ruft Edge Function
--     "mail-ereignis" auf (schickt die Mails)
--  3. Zeitplan: täglich 16:00 UTC (17/18 Uhr DE) -> "mail-digest"
--     (Sammel-Mail an Firmen mit Einstellung "taeglich")
--
-- Der lange "Bearer eyJ..."-Schlüssel ist der ÖFFENTLICHE anon-Key
-- (steht sowieso im Frontend) - kein Geheimnis.
-- ============================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.mail_ereignis_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://blufrvuskqiloslyxjkx.supabase.co/functions/v1/mail-ereignis',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsdWZydnVza3FpbG9zbHl4amt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODY3NzcsImV4cCI6MjA5ODQ2Mjc3N30.J1PPJupOyAT942Cnyqh700Pfn-LTzOuLJ2WCPn910pY'
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', to_jsonb(NEW),
      'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
    )
  );
  return NEW;
end;
$$;

drop trigger if exists bewerbung_mail_insert on public.bewerbungen;
create trigger bewerbung_mail_insert
  after insert on public.bewerbungen
  for each row execute function public.mail_ereignis_webhook();

drop trigger if exists bewerbung_mail_update on public.bewerbungen;
create trigger bewerbung_mail_update
  after update of status on public.bewerbungen
  for each row execute function public.mail_ereignis_webhook();

-- Täglicher Digest um 16:00 UTC
select cron.unschedule('mail-digest-taeglich')
where exists (select 1 from cron.job where jobname = 'mail-digest-taeglich');

select cron.schedule(
  'mail-digest-taeglich',
  '0 16 * * *',
  $cron$
  select net.http_post(
    url := 'https://blufrvuskqiloslyxjkx.supabase.co/functions/v1/mail-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsdWZydnVza3FpbG9zbHl4amt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODY3NzcsImV4cCI6MjA5ODQ2Mjc3N30.J1PPJupOyAT942Cnyqh700Pfn-LTzOuLJ2WCPn910pY'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
