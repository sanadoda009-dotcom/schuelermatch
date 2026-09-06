-- Der Chat oeffnet erst nach einer Zusage - auch in der Datenbank
-- (4.9.2026)
--
-- WARUM
-- Die Seite sagt das an drei Stellen zu:
--
--   dashboard-schueler.html  "Chats mit Firmen, die deine Bewerbung
--                             angenommen haben."
--   datenschutz.html         "Chat-Nachrichten zwischen Schueler und
--                             Arbeitgeber NACH EINER ZUSAGE"
--   fuer-firmen.html         "Erst nach einer Zusage oeffnet sich der Chat"
--
-- Im Code steht es auch so: Der Knopf "Nachricht schreiben" erscheint im
-- Firmen-Dashboard nur bei `status === 'angenommen'`.
--
-- Die Datenbank sagt etwas anderes. Die INSERT-Regel auf `nachrichten`
-- lautet:
--
--   absender_id = auth.uid() AND EXISTS (
--     SELECT 1 FROM bewerbungen b JOIN jobs j ON j.id = b.job_id
--     WHERE b.id = nachrichten.bewerbung_id
--       AND (b.schueler_id = auth.uid() OR j.firma_id = auth.uid()))
--
-- Vom Status ist keine Rede. Ueber die API mit dem oeffentlichen anon-Key
-- kann eine Firma also jedem schreiben, der sich bei ihr beworben hat -
-- ohne Zusage, auch nach einer Absage.
--
-- Das ist die Falle, die dieses Projekt schon dreimal hatte: EINE ZUSAGE,
-- DIE NUR IM BROWSER GILT, IST KEINE ZUSAGE. (Mindestalter der Anzeige,
-- Verifizierung vor der Bewerbung, Alter bei der Registrierung.)
--
-- Hier wiegt es schwerer als dort. Der Chat ist der einzige Kanal, in dem
-- ein Erwachsener frei formulierten Text an ein Kind schicken kann.
-- Genau deshalb hat die Absage-Funktion bewusst KEIN Freitextfeld
-- (js/absage.js) - ein Freitext an einen abgelehnten Schueler waere
-- derselbe Kanal durch die Hintertuer. Ohne diese Datei steht die
-- Hintertuer offen.
--
-- WAS DIESE DATEI AENDERT
-- Die INSERT-Regel verlangt zusaetzlich `b.status = 'angenommen'`.
--
-- WAS SIE NICHT AENDERT
-- Das LESEN bleibt, wie es ist. Wird eine Bewerbung nach der Zusage doch
-- noch abgelehnt, sollen beide Seiten den bisherigen Verlauf weiter
-- sehen - und melden koennen. Wer den Verlauf loeschen wuerde, naehme
-- einer Meldung die Grundlage.

drop policy if exists "Nachricht senden" on public.nachrichten;

create policy "Nachricht senden"
  on public.nachrichten for insert
  with check (
    absender_id = auth.uid()
    and exists (
      select 1
        from public.bewerbungen b
        join public.jobs j on j.id = b.job_id
       where b.id = nachrichten.bewerbung_id
         and b.status = 'angenommen'
         and (b.schueler_id = auth.uid() or j.firma_id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
-- 1) Die Regel nennt den Status:
--
--   select policyname, cmd, with_check from pg_policies
--   where schemaname = 'public' and tablename = 'nachrichten'
--     and cmd = 'INSERT';
--
--   Erwartet: im with_check steht `b.status = 'angenommen'`.
--
-- 2) PostgreSQL verknuepft mehrere erlaubende Regeln mit ODER - die
--    grosszuegigere gewinnt. Also nachsehen, dass es nur DIESE eine
--    INSERT-Regel gibt:
--
--   select count(*) from pg_policies
--   where schemaname = 'public' and tablename = 'nachrichten' and cmd = 'INSERT';
--
--   Erwartet: 1
--
-- 3) Gegenprobe mit TESTKONTEN (nie mit echten):
--    Eine Testbewerbung auf `ausstehend` stehen lassen, als Testfirma
--    ueber die API eine Nachricht einfuegen. Erwartet: Ablehnung durch
--    die Zeilenregel (kein Treffer). Danach die Bewerbung auf
--    'angenommen' setzen - jetzt muss es gehen.
--
-- Rueckgaengig, falls noetig: dieselbe Regel ohne die Zeile
--   and b.status = 'angenommen'
