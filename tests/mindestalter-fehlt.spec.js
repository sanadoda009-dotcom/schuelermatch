// Anzeigen ohne Mindestalter (1.9.2026).
//
// ANLASS: Die Spalte `jobs.mindestalter` ist in der Datenbank NULLABLE.
// Das Formular im Firmen-Dashboard setzt zwar `parseInt(...) || 15`, aber
// das ist wieder nur eine Zusage im Browser – über die API lässt sich eine
// Anzeige ohne Altersangabe anlegen. Die CHECK-Regel `mindestalter >= 13`
// greift dabei nicht: In SQL ist `NULL >= 13` weder wahr noch falsch,
// und die Regel gilt als erfüllt.
//
// Was dabei herauskam (gemessen):
//   Startseite:  "A ab null J. Aushilfe ohne Altersangabe ..."
//   Jobbörse:    "NEU T ab null J. ..."
// Und schlimmer als der Anzeigefehler: `null > alter` ist in JavaScript
// falsch, die Anzeige rutschte also durch JEDEN Altersfilter – ein
// Dreizehnjähriger bekam sie zu sehen, egal was sie verlangt.
//
// Behoben an allen sechs Stellen, die das Alter ausgeben, und im Filter.
// Die Datenbankseite (`mindestalter` auf NOT NULL) liegt als
// `supabase/mindestalter-pflicht.sql` bereit.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const OHNE_ALTER = {
  id: 'j-ohne-alter', titel: 'Aushilfe ohne Altersangabe', beschreibung: 'Text.',
  ort: 'München', stundenlohn: 12, mindestalter: null, kategorie: 'Verkauf',
  arbeitszeit: 'Flexibel', verfuegbarkeit: 'Nach Absprache', aktiv: true,
  aufrufe: 1, erstellt_am: '2026-08-30T10:00:00Z', firma_id: 'f1',
  firma_name: 'Testfirma', firma_logo_url: null, lat: null, lon: null,
}
const MIT_ALTER = { ...OHNE_ALTER, id: 'j-mit-alter', titel: 'Aushilfe ab 16', mindestalter: 16 }

async function jobsLiefern(page, jobs) {
  await page.route('**/rest/v1/jobs*', route => {
    // Die Detailseite fragt mit .single() – PostgREST liefert dann ein
    // Objekt statt einer Liste. Wer das ignoriert, bekommt eine leere
    // Seite und sucht den Fehler an der falschen Stelle.
    const einzeln = (route.request().headers()['accept'] || '')
      .includes('vnd.pgrst.object')
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify(einzeln ? jobs[0] : jobs),
    })
  })
}

test('die Startseite schreibt nicht "ab null J."', async ({ page }) => {
  await jobsLiefern(page, [OHNE_ALTER])
  await page.goto('/index.html')
  const grid = page.locator('#preview-jobs-grid')
  await expect(grid).toContainText('Aushilfe ohne Altersangabe')
  await expect(grid).not.toContainText('null')
  await expect(grid).toContainText('Alter auf Anfrage')
})

test('die Jobbörse schreibt nicht "ab null J."', async ({ page }) => {
  await jobsLiefern(page, [OHNE_ALTER])
  await page.goto('/jobs.html')
  const grid = page.locator('#jobs-grid')
  await expect(grid).toContainText('Aushilfe ohne Altersangabe')
  await expect(grid).not.toContainText('null')
})

test('ohne Altersangabe rutscht die Anzeige nicht durch den Altersfilter', async ({ page }) => {
  // Der eigentliche Grund für diese Runde. `null > 13` ist falsch, die
  // Anzeige blieb also stehen, egal welches Alter eingestellt war.
  await jobsLiefern(page, [OHNE_ALTER, MIT_ALTER])
  await page.goto('/jobs.html')
  await expect(page.locator('.job-card')).toHaveCount(2)

  await page.locator('#filter-alter').selectOption('13')
  await expect(page.locator('#jobs-grid')).not.toContainText('Aushilfe ohne Altersangabe')
  await expect(page.locator('#jobs-grid')).not.toContainText('Aushilfe ab 16')
})

test('die Beschreibung der Detailseite enthält kein "null"', async ({ page }) => {
  // Sie landet in Suchmaschinen und in der Teilen-Vorschau – da fällt so
  // etwas dauerhaft auf.
  await jobsLiefern(page, [OHNE_ALTER])
  await page.goto('/job.html?id=j-ohne-alter')
  await expect(page.locator('h1')).toContainText('Aushilfe ohne Altersangabe', { timeout: 15000 })

  const beschreibung = await page.locator('meta[name="description"]').getAttribute('content')
  expect(beschreibung, 'Meta-Beschreibung mit "null"').not.toContain('null')
  expect(beschreibung).toContain('Aushilfe ohne Altersangabe')
})

test('kein Modul gibt das Mindestalter ungeprüft aus', async () => {
  // Billiger Wächter für neuen Code: Wer `ab ${job.mindestalter}` schreibt,
  // ohne vorher auf "nicht gesetzt" zu prüfen, baut den Fehler neu ein.
  const ordner = path.join(__dirname, '..', 'js')
  const treffer = []
  for (const datei of fs.readdirSync(ordner).filter(f => f.endsWith('.js'))) {
    const zeilen = fs.readFileSync(path.join(ordner, datei), 'utf8').split(/\r?\n/)
    zeilen.forEach((zeile, i) => {
      if (!zeile.includes('${job.mindestalter}')) return
      if (zeile.includes('== null') || zeile.includes('job.mindestalter ?')) return
      if (/if \(job\.mindestalter\)/.test(zeile)) return
      treffer.push(`js/${datei}:${i + 1}`)
    })
  }
  expect(treffer, 'Mindestalter ohne Prüfung auf "nicht gesetzt"').toEqual([])
})
