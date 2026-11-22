-- Admin-Rechte nur mit zweitem Faktor (22.11.2026, eingespielt)
--
-- WARUM
-- Alle Admin-Rechte laufen ueber eine Funktion: ist_admin(). Sie steckt in
-- den Regeln "Admin liest alle Profile", "Admin aktualisiert Profile",
-- "Admin liest alle Jobs", in allen Regeln auf `meldungen`, in den
-- Storage-Regeln der Ablage `verifizierung` (Ausweise!), in
-- betreiber_statistik() und in den Schutz-Triggern schuetze_profil_felder
-- und schuetze_meldung_felder (am 22.11. aus pg_policies/pg_proc gelesen).
--
-- Bisher reichte dafuer das Passwort. Den Supabase-Schutz gegen geleakte
-- Passwoerter gibt es im kostenlosen Plan nicht. Wer das Passwort eines
-- Admins kennt, saehe Ausweise Minderjaehriger.
--
-- WAS DIESE DATEI AENDERT
-- ist_admin() ist nur noch wahr, wenn die Anmeldung mit zweitem Faktor
-- bestaetigt wurde: Im Anmelde-Token steht dann `aal = aal2`. Ein
-- Admin-Konto, das nur mit Passwort angemeldet ist, ist fuer die
-- Datenbank ein ganz normales Konto. Der Betreiber-Bereich (js/admin-mfa.js)
-- fragt deshalb vor allem anderen nach dem Code bzw. richtet ihn ein.
--
-- Nicht betroffen: Der SQL-Editor (auth.uid() ist dort leer, die Trigger
-- lassen ihn ohnehin durch) und die Edge Functions mit Service-Role.
--
-- NOTFALL - Handy verloren:
--   Im SQL-Editor den Faktor des eigenen Kontos loeschen, dann richtet der
--   Betreiber-Bereich beim naechsten Besuch einen neuen ein:
--     delete from auth.mfa_factors
--      where user_id = (select id from auth.users where email = 'DEINE@ADRESSE');

create or replace function public.ist_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((select ist_admin from public.profiles where id = auth.uid()), false)
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$function$;

-- ------------------------------------------------------------
-- NACHHER PRUEFEN (Transaktion + Rollback, keine Spuren)
-- ------------------------------------------------------------
--   Admin mit aal1  -> select public.ist_admin();  -- false
--   Admin mit aal2  -> select public.ist_admin();  -- true
--   Schueler aal2   -> select public.ist_admin();  -- false
--
-- Rueckgaengig, falls noetig (dann reicht fuer Admin-Rechte wieder das
-- Passwort) - die alte Fassung aus schutz-trigger.sql:
--   create or replace function public.ist_admin() returns boolean
--   language sql stable security definer set search_path to 'public' as
--   $f$ select coalesce((select ist_admin from public.profiles where id = auth.uid()), false); $f$;
