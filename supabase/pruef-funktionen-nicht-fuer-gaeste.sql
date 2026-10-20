-- Pruef-Funktionen ueber fremde Konten nicht fuer Gaeste (20.10.2026,
-- eingespielt)
--
-- WARUM
-- Die Supabase-Sicherheitspruefung meldet SECURITY-DEFINER-Funktionen,
-- die ohne Anmeldung ueber /rest/v1/rpc/... aufrufbar sind. Die meisten
-- davon braucht die Seite fuer Gaeste (firma_freigegeben fuer die
-- oeffentliche Jobboerse, job_alarm_abmelden fuer den Abmeldelink in der
-- Mail, job_aufruf_zaehlen fuer den Zaehler). Zwei nicht:
--
--   ist_verifiziert(u)      verraet zu JEDER Konto-Id, ob der Schueler
--                           verifiziert ist
--   ist_gesperrte_firma(u)  verraet zu jeder Id, ob die Firma gesperrt ist
--
-- Beide stecken nur in Regeln, die fuer angemeldete Nutzer gelten (am
-- 20.10. aus pg_policies ausgelesen): "Gesperrte Firma: ..." ist
-- `to authenticated`, und "Schueler bewirbt sich" (INSERT) kann ein Gast
-- ohnehin nicht erfuellen - ohne Anmeldung gibt es kein auth.uid().
--
-- WAS DIESE DATEI AENDERT
-- Gaeste (anon) duerfen die beiden Funktionen nicht mehr aufrufen.
-- Angemeldete Nutzer weiter - ihre Regeln brauchen sie.

revoke all on function public.ist_verifiziert(uuid) from public, anon;
grant execute on function public.ist_verifiziert(uuid) to authenticated;

revoke all on function public.ist_gesperrte_firma(uuid) from public, anon;
grant execute on function public.ist_gesperrte_firma(uuid) to authenticated;

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
--   select has_function_privilege('anon', 'public.ist_verifiziert(uuid)', 'execute'),
--          has_function_privilege('anon', 'public.ist_gesperrte_firma(uuid)', 'execute'),
--          has_function_privilege('authenticated', 'public.ist_verifiziert(uuid)', 'execute');
--
--   Erwartet: false, false, true.
--
-- Dazu die Jobboerse ohne Anmeldung oeffnen: Anzeigen muessen erscheinen
-- (die braucht firma_freigegeben, und die bleibt unberuehrt).
--
-- Rueckgaengig, falls noetig:
--   grant execute on function public.ist_verifiziert(uuid) to anon;
--   grant execute on function public.ist_gesperrte_firma(uuid) to anon;
