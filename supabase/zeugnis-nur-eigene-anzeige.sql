-- Ein Zeugnis gehoert zu EINER Bewerbung, nicht zum Schueler (4.9.2026)
--
-- WARUM
-- Ausgelesen aus der laufenden Datenbank, Regel auf `storage.objects`:
--
--   "Firma sieht Zeugnis von Bewerbern"  SELECT
--     bucket_id = 'zeugnisse' AND EXISTS (
--       SELECT 1 FROM bewerbungen JOIN jobs ON jobs.id = bewerbungen.job_id
--       WHERE bewerbungen.schueler_id::text = (storage.foldername(objects.name))[1]
--         AND jobs.firma_id = auth.uid())
--
-- Der Pfad eines Zeugnisses ist aber ZWEISTUFIG (js/dokument-pfad.js,
-- Aufruf in js/dashboard-schueler.js):
--
--   <schueler_id>/<job_id>/zeugnis.<endung>
--
-- Geprueft wird nur der ERSTE Ordner - die Schueler-Id. Der zweite, die
-- Anzeige, kommt in der Regel gar nicht vor.
--
-- FOLGE
-- Bewirbt sich ein Schueler bei Firma A und bei Firma B und haengt jedes
-- Mal ein Zeugnis an, darf Firma A auch das Zeugnis lesen, das fuer
-- Firma B bestimmt war. Es genuegt EINE Bewerbung bei A, danach ist der
-- ganze Ordner des Schuelers offen - auch fuer Zeugnisse, die er spaeter
-- fuer andere Firmen hochlaedt.
--
-- Ueber die Oberflaeche faellt das nicht auf: Das Firmen-Dashboard holt
-- immer nur den Pfad aus der eigenen Bewerbung. Ueber die API mit dem
-- oeffentlichen anon-Key liest die Firma den Ordner aber auf, genau wie
-- am 26.8. beim Bewerben ohne Verifizierung.
--
-- BETRIFFT NICHT NUR ZEUGNISSE
-- In derselben Ablage liegt unter demselben zweistufigen Pfad auch der
-- LEBENSLAUF zur Bewerbung:
--
--   <schueler_id>/<job_id>/lebenslauf.pdf
--
-- Also gilt dasselbe fuer ihn. Ein Lebenslauf enthaelt Anschrift, Schule,
-- Geburtsdatum und Foto.
--
-- Das sind Zeugnisse und Lebenslaeufe von Minderjaehrigen, weitergereicht
-- an einen Arbeitgeber, dem der Schueler sie nie gegeben hat.
--
-- WAS DIESE DATEI AENDERT
-- 1) Die Regel prueft zusaetzlich den ZWEITEN Ordner gegen die Anzeige,
--    zu der die Bewerbung gehoert. Firma A sieht dann genau die
--    Zeugnisse, die zu ihren eigenen Anzeigen gehoeren.
-- 2) Der Schueler darf sein Zeugnis loeschen. Bisher gab es fuer
--    `zeugnisse` GAR KEINE Loeschregel - fuer Avatar, Lebenslaufbild und
--    Schuelerausweis schon. Wer die falsche Datei erwischt hatte, wurde
--    sie nur los, indem er sein ganzes Konto loeschte.

-- ------------------------------------------------------------
-- 1) Nur die Zeugnisse zur eigenen Anzeige
-- ------------------------------------------------------------
drop policy if exists "Firma sieht Zeugnis von Bewerbern" on storage.objects;

create policy "Firma sieht Zeugnis von Bewerbern"
  on storage.objects for select
  using (
    bucket_id = 'zeugnisse'
    and exists (
      select 1
        from public.bewerbungen b
        join public.jobs j on j.id = b.job_id
       where b.schueler_id::text = (storage.foldername(objects.name))[1]
         and b.job_id::text      = (storage.foldername(objects.name))[2]
         and j.firma_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 2) Der Schueler darf sein eigenes Zeugnis loeschen
-- ------------------------------------------------------------
drop policy if exists "Zeugnis eigenes loeschen" on storage.objects;

create policy "Zeugnis eigenes loeschen"
  on storage.objects for delete
  using (
    bucket_id = 'zeugnisse'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
-- 1) Beide Regeln stehen da, und die SELECT-Regel nennt den zweiten Ordner:
--
--   select policyname, cmd, qual from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--     and policyname in ('Firma sieht Zeugnis von Bewerbern',
--                        'Zeugnis eigenes loeschen');
--
--   Erwartet: im `qual` der SELECT-Regel steht `[2]` UND `b.job_id`.
--
-- 2) PostgreSQL verknuepft mehrere erlaubende Regeln mit ODER - die
--    grosszuegigere gewinnt. Also nachsehen, dass es fuer `zeugnisse`
--    nur DIESE eine Firmen-Regel gibt:
--
--   select policyname from pg_policies
--   where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
--     and qual like '%zeugnisse%';
--
--   Erwartet: genau zwei - "Zeugnis eigenes lesen" (der Schueler selbst)
--   und "Firma sieht Zeugnis von Bewerbern".
--
-- 3) Gegenprobe mit TESTKONTEN (nie mit echten):
--    Ein Testschueler bewirbt sich bei zwei Testfirmen, je mit Zeugnis.
--    Als Firma A angemeldet:
--      select name from storage.objects where bucket_id = 'zeugnisse';
--    Erwartet: nur der Pfad mit der eigenen job_id.
--
-- Rueckgaengig, falls noetig: die alte Regel wieder anlegen -
--   drop policy if exists "Firma sieht Zeugnis von Bewerbern" on storage.objects;
--   create policy "Firma sieht Zeugnis von Bewerbern"
--     on storage.objects for select using (
--       bucket_id = 'zeugnisse' and exists (
--         select 1 from public.bewerbungen b join public.jobs j on j.id = b.job_id
--         where b.schueler_id::text = (storage.foldername(objects.name))[1]
--           and j.firma_id = auth.uid()));
-- Die Loeschregel kann dabei stehen bleiben.
