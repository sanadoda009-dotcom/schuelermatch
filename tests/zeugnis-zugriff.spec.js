// Wer darf ein Zeugnis lesen? (4.9.2026)
//
// DER BEFUND, ausgelesen aus der laufenden Datenbank — die Regel auf
// `storage.objects`:
//
//   "Firma sieht Zeugnis von Bewerbern"  SELECT
//     bucket_id = 'zeugnisse' AND EXISTS (
//       SELECT 1 FROM bewerbungen JOIN jobs ON jobs.id = bewerbungen.job_id
//       WHERE bewerbungen.schueler_id::text = (storage.foldername(objects.name))[1]
//         AND jobs.firma_id = auth.uid())
//
// Der Pfad ist aber ZWEISTUFIG: `<schueler_id>/<job_id>/zeugnis.<endung>`.
// Geprüft wird nur der erste Ordner. Bewirbt sich ein Schüler bei Firma A
// und bei Firma B, darf Firma A auch das Zeugnis lesen, das für B
// bestimmt war — und jedes weitere, das er später hochlädt.
//
// Dasselbe gilt für den Lebenslauf: `<schueler_id>/<job_id>/lebenslauf.pdf`
// liegt in derselben Ablage. Darin stehen Anschrift, Schule, Geburtsdatum
// und Foto eines Minderjährigen.
//
// Über die Oberfläche fällt das nicht auf — das Firmen-Dashboard holt
// immer nur den Pfad aus der eigenen Bewerbung. Über die API mit dem
// öffentlichen anon-Key nicht, genau wie am 26.8. beim Bewerben ohne
// Verifizierung.
//
// WAS HIER GEPRÜFT WIRD
// Die Regel selbst liegt in der Datenbank; ändern kann sie nur Sanad
// (supabase/zeugnis-nur-eigene-anzeige.sql). Prüfbar ist aber die
// ANNAHME, auf der sie steht: dass der Pfad genau diese zwei Ordner hat.
// Ändert die jemand, wird die Regel still wirkungslos — deshalb hier
// festgenagelt.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = p => fs.readFileSync(path.join(WURZEL, p), 'utf8')

test.describe('der Pfad, auf den sich die Regel stützt', () => {
  test('hat genau zwei Ordner: Schüler und Anzeige', async ({ page }) => {
    await page.goto('/index.html')
    const pfad = await page.evaluate(async () => {
      const m = await import('/js/dokument-pfad.js')
      return m.dokumentPfad('schueler-1', 'job-9/zeugnis', 'application/pdf')
    })
    expect(pfad).toBe('schueler-1/job-9/zeugnis.pdf')
    // storage.foldername() liefert daraus {schueler-1, job-9}: [1] und [2].
    expect(pfad.split('/')).toHaveLength(3)
  })

  test('das Hochladen benutzt wirklich diese zwei Ebenen', async () => {
    // Wächter: Fiele der Anzeigen-Ordner weg, läge das Zeugnis direkt
    // unter der Schüler-Id — und die verschärfte Regel fände nie etwas.
    const quelle = lies('js/dashboard-schueler.js')
    expect(quelle).toContain('`${jobId}/zeugnis`')
    expect(quelle).toContain('`${profile.id}/${jobId}/lebenslauf.pdf`')
  })

  test('in der Zeugnis-Ablage liegt auch der Lebenslauf', async () => {
    // Der Grund, warum der Fund schwerer wiegt als „ein Zeugnis".
    const quelle = lies('js/dashboard-schueler.js')
    const zeilen = quelle.split('\n')
      .filter(z => z.includes("from('zeugnisse')"))
    expect(zeilen.length).toBeGreaterThanOrEqual(3)
    expect(quelle).toMatch(/lebenslaufPfad = `\$\{profile\.id\}\/\$\{jobId\}\/lebenslauf\.pdf`/)
  })
})

test.describe('die SQL-Datei schließt genau das', () => {
  const sql = lies('supabase/zeugnis-nur-eigene-anzeige.sql')
  // Nur der ausführbare Teil – die Erklärung oben enthält absichtlich
  // auch die ALTE Regel, sonst prüfte man hier den Kommentar mit.
  const wirksam = sql.slice(sql.indexOf('drop policy'), sql.indexOf('-- NACHHER PRUEFEN'))

  test('bindet den zweiten Ordner an die Anzeige der Bewerbung', async () => {
    expect(wirksam).toContain('(storage.foldername(objects.name))[2]')
    expect(wirksam).toMatch(/b\.job_id::text\s*=\s*\(storage\.foldername\(objects\.name\)\)\[2\]/)
  })

  test('behält die bisherigen Grenzen bei', async () => {
    // Der Schüler-Ordner und die eigene Firma müssen weiter geprüft werden –
    // sonst tauscht man eine Lücke gegen eine größere.
    expect(wirksam).toContain('(storage.foldername(objects.name))[1]')
    expect(wirksam).toContain('j.firma_id = auth.uid()')
    expect(wirksam).toContain("bucket_id = 'zeugnisse'")
  })

  test('räumt die alte Regel weg, statt eine zweite danebenzustellen', async () => {
    // PostgreSQL verknüpft mehrere erlaubende Regeln mit ODER — die
    // großzügigere gewinnt. Eine neue Regel neben der alten hätte gar
    // nichts geändert. Das ist die Falle vom 27.8.
    expect(wirksam).toContain('drop policy if exists "Firma sieht Zeugnis von Bewerbern"')
  })

  test('gibt dem Schüler das Löschen zurück', async () => {
    // Für `zeugnisse` gab es GAR KEINE Löschregel – für Avatar,
    // Lebenslaufbild und Schülerausweis schon. Wer die falsche Datei
    // erwischt hatte, wurde sie nur mit dem ganzen Konto los.
    expect(wirksam).toContain('for delete')
    expect(wirksam).toMatch(/auth\.uid\(\)::text\s*=\s*\(storage\.foldername\(name\)\)\[1\]/)
  })
})
