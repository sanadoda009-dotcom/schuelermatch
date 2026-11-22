-- Datenbank-Pflege nach der Supabase-Pruefung (22.11.2026, eingespielt)
--
-- WARUM
-- Die Supabase-Pruefung (Advisors) vom 22.11. meldete zwei Dinge, die
-- noch nicht erledigt waren:
--
-- 1) `schuetze_job_alarm_felder()` war als einzige Trigger-Funktion von
--    aussen aufrufbar (/rest/v1/rpc/..., auch fuer Gaeste). Alle anderen
--    Schutz-Trigger sind es nicht. Ein Aufruf haette nur einen Fehler
--    geworfen ("trigger functions can only be called as triggers") - ein
--    Loch war es nicht, aber eine unnoetige Tuer. Der Trigger selbst
--    feuert weiter: Postgres prueft das Ausfuehrungsrecht beim Feuern
--    eines Triggers nicht.
--
-- 2) Sieben Fremdschluessel ohne Index. Bei wenigen Zeilen egal, bei
--    vielen Bewerbungen wird z.B. "alle Bewerbungen dieses Schuelers"
--    langsam - und Konto-Loeschen muss jede verweisende Tabelle
--    durchsuchen. Ein Index kostet bei dieser Groesse nichts.
--    (nachrichten.absender_id bekommt keinen - die Tabelle ist seit
--    chat-abschaffen.sql leer und zu.)
--
-- BEWUSST NICHT GEAENDERT (siehe OFFENE-PUNKTE.md)
--   - "Security Definer View" firmen_oeffentlich: Absicht.
--   - firma_freigegeben, job_alarm_abmelden, job_aufruf_zaehlen fuer
--     Gaeste: braucht die oeffentliche Seite.
--   - "RLS ohne Regel" auf nachrichten: Absicht, der Chat ist zu.
--   - Schutz gegen geleakte Passwoerter: nur im Pro-Plan schaltbar.
--   - 25 Regeln mit auth.uid() statt (select auth.uid()): nur bei sehr
--     vielen Zeilen spuerbar; alle Sicherheitsregeln dafuer neu zu
--     schreiben, waere das groessere Risiko.

-- 1) Trigger-Funktion zu
revoke all on function public.schuetze_job_alarm_felder() from public, anon, authenticated;

-- 2) Indizes fuer Fremdschluessel
create index if not exists bewerbungen_schueler_id_idx   on public.bewerbungen (schueler_id);
create index if not exists bewertungen_schueler_id_idx   on public.bewertungen (schueler_id);
create index if not exists gemerkte_jobs_job_id_idx      on public.gemerkte_jobs (job_id);
create index if not exists jobs_firma_id_idx             on public.jobs (firma_id);
create index if not exists meldungen_gemeldet_user_id_idx on public.meldungen (gemeldet_user_id);
create index if not exists meldungen_job_id_idx          on public.meldungen (job_id);
create index if not exists meldungen_nachricht_id_idx    on public.meldungen (nachricht_id);

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--   select proacl from pg_proc where proname = 'schuetze_job_alarm_felder';
--     -> nur postgres und service_role
--   select indexname from pg_indexes where indexname like '%\_idx' and schemaname = 'public';
--     -> die sieben neuen
--
-- Rueckgaengig, falls noetig:
--   grant execute on function public.schuetze_job_alarm_felder() to anon, authenticated;
--   drop index if exists public.bewerbungen_schueler_id_idx;   (je Index)
-- Beides ist unnoetig: Die Funktion braucht von aussen niemand, die
-- Indizes kosten nichts.
