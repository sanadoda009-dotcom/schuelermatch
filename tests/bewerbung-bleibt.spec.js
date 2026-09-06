// Eine Bewerbung gehört dem Schüler — auch wenn die Anzeige weg ist.
//
// DER BEFUND (4.9.2026), ausgelesen aus der laufenden Datenbank:
//
//   bewerbungen.job_id        -> jobs         ON DELETE CASCADE
//   nachrichten.bewerbung_id  -> bewerbungen  ON DELETE CASCADE
//
// Auf `jobs` steht die Löschregel `auth.uid() = firma_id` — eine Firma
// darf ihre eigene Anzeige jederzeit löschen. Zusammen heißt das: EIN
// Klick der Firma löscht jede Bewerbung auf diese Anzeige und über die
// zweite Kaskade den kompletten Chat dazu.
//
// Das sind Daten des SCHÜLERS: seine Bewerbung, seine Nachrichten, sein
// Nachweis, dass er angenommen wurde. Auf dem Knopf stand nur „Wirklich
// löschen?" — wer zweimal klickt, kann nicht ahnen, was mitgeht.
//
// Dasselbe Muster wie am 27.8. bei `meldungen.melder_id` und am 2.9. bei
// `meldungen.job_id`: eine Kaskade, die der Gegenseite Macht über fremde
// Daten gibt. Gefunden mit demselben Suchmuster — Fremdschlüssel und
// Löschregeln auslesen, nicht den Anwendungscode fragen.
//
// Hier geprüft wird der Teil, der ohne Datenbankänderung geht: dass die
// Seite sagt, was passiert. Der eigentliche Fix ist
// `supabase/bewerbung-bleibt.sql` und wartet auf Sanad — der letzte
// Block prüft, dass die Datei das Richtige tut.

const { test, expect, setupDashboard, warteAufDashboard, FIRMA, SCHUELER, defaultDb } = require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

const EIGENER_JOB = {
  id: 'eigen-1', firma_id: FIRMA.id, firma_name: FIRMA.name,
  titel: 'Aushilfe Eistheke', beschreibung: 'Eis verkaufen.', ort: 'München',
  stundenlohn: 13, mindestalter: 15, kategorie: 'Gastronomie',
  arbeitszeit: 'Wochenende', aktiv: true, aufrufe: 3,
  erstellt_am: '2026-09-01T10:00:00Z', lat: null, lon: null, verfuegbarkeit: null,
}

function db(mitBewerbungen) {
  const d = defaultDb()
  d.jobs = [{ ...EIGENER_JOB }]
  d.bewerbungen = mitBewerbungen
    ? [
        { id: 'bw-1', job_id: 'eigen-1', schueler_id: SCHUELER.id, status: 'ausstehend',
          erstellt_am: '2026-09-02T10:00:00Z', motivationsschreiben: 'Hallo.' },
        { id: 'bw-2', job_id: 'eigen-1', schueler_id: SCHUELER.id, status: 'angenommen',
          erstellt_am: '2026-09-02T11:00:00Z', motivationsschreiben: 'Hallo.' },
      ]
    : []
  return d
}

async function zurAnzeigenliste(page) {
  await page.goto('/dashboard-firma.html')
  await warteAufDashboard(page)
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="jobs"]').click()
  await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
}

test.describe('Löschen mit Bewerbungen', () => {
  test('der erste Klick sagt, wie viele Bewerbungen mitgehen', async ({ page }) => {
    await setupDashboard(page.context(), { db: db(true), user: FIRMA })
    await zurAnzeigenliste(page)
    await page.locator('[data-delete]').click()

    const meldung = page.locator('.toast, #toast')
    await expect(meldung).toContainText('2 Bewerbungen', { timeout: 20_000 })
  })

  test('und dass der Chat mit verschwindet', async ({ page }) => {
    // Über `nachrichten.bewerbung_id -> bewerbungen CASCADE` hängt der
    // ganze Chat daran. Das ist der Teil, den niemand erwartet.
    await setupDashboard(page.context(), { db: db(true), user: FIRMA })
    await zurAnzeigenliste(page)
    await page.locator('[data-delete]').click()
    await expect(page.locator('.toast, #toast')).toContainText('Chat', { timeout: 20_000 })
  })

  test('und nennt den sanfteren Weg', async ({ page }) => {
    // „Weg vom Schwarzen Brett" ist fast immer gemeint, nicht „weg für alle".
    await setupDashboard(page.context(), { db: db(true), user: FIRMA })
    await zurAnzeigenliste(page)
    await page.locator('[data-delete]').click()
    await expect(page.locator('.toast, #toast')).toContainText('Pausieren', { timeout: 20_000 })
  })

  test('der Knopf selbst warnt auch', async ({ page }) => {
    await setupDashboard(page.context(), { db: db(true), user: FIRMA })
    await zurAnzeigenliste(page)
    const knopf = page.locator('[data-delete]')
    await knopf.click()
    await expect(knopf).toHaveText('Trotzdem löschen?')
  })
})

test.describe('Löschen ohne Bewerbungen', () => {
  test('bleibt kurz — hier geht nichts fremdes verloren', async ({ page }) => {
    // Eine Warnung, die immer kommt, liest bald niemand mehr.
    await setupDashboard(page.context(), { db: db(false), user: FIRMA })
    await zurAnzeigenliste(page)
    const knopf = page.locator('[data-delete]')
    await knopf.click()
    await expect(knopf).toHaveText('Wirklich löschen?')
    // Gar kein Toast — das Element wird erst beim Anzeigen erzeugt.
    // `not.toContainText` waere hier die falsche Zusicherung: Sie
    // scheitert an einem fehlenden Element, statt es gutzuheissen.
    await expect(page.locator('.toast, #toast')).toHaveCount(0)
  })
})

test.describe('die SQL-Datei tut das Richtige', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'bewerbung-bleibt.sql'), 'utf8')

  test('löst die Kaskade auf job_id auf', async () => {
    expect(sql).toContain('references public.jobs(id) on delete set null')
    expect(sql).toContain('drop constraint if exists bewerbungen_job_id_fkey')
    // Ohne das schlägt SET NULL an der NOT-NULL-Bedingung fehl.
    expect(sql).toContain('alter column job_id drop not null')
  })

  test('rettet den Titel, sonst bleibt eine leere Hülle', async () => {
    expect(sql).toContain('add column if not exists job_titel')
    expect(sql).toMatch(/update public\.bewerbungen/)
    expect(sql).toContain('before insert on public.bewerbungen')
  })

  test('lässt schueler_id in Ruhe', async () => {
    // Mit dem eigenen Konto SOLL die eigene Bewerbung verschwinden —
    // das ist kein Fehler, sondern Datenschutz.
    expect(sql).not.toMatch(/schueler_id.*on delete set null/)
    expect(sql).toContain('schueler_id bleibt CASCADE')
  })
})
