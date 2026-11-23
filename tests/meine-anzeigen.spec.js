// "Meine Anzeigen" der Firma im neuen Aufbau (23.11.2026)
//
// Festgehalten wird: Jede Zahl kommt aus den echten Zeilen (aktiv,
// aufrufe, Bewerbungen), der Stand steht als Wort da, und die alten
// Knoepfe tun weiter genau das, was sie vorher taten.
const { test, expect, setupDashboard, defaultDb, profilZeile, FIRMA, SCHUELER } = require('./helpers/supabase-fake')

function db({ firma = {} } = {}) {
  const d = defaultDb({ profiles: [profilZeile(FIRMA, firma), profilZeile(SCHUELER, { verifiziert: true })] })
  d.jobs = [
    { id: 'j1', firma_id: FIRMA.id, titel: 'Lagermitarbeiter', ort: 'München', lat: 48.1, lon: 11.5, kategorie: 'Büro & Organisation',
      stundenlohn: 14, verfuegbarkeit: 'Samstag', mindestalter: 16, aktiv: true, aufrufe: 128, erstellt_am: '2026-11-20T10:00:00Z', beschreibung: 'x' },
    { id: 'j2', firma_id: FIRMA.id, titel: 'Aushilfe Eisdiele', ort: 'München', lat: 48.1, lon: 11.5, kategorie: 'Gastronomie',
      stundenlohn: 13.5, verfuegbarkeit: 'Wochenende', mindestalter: 15, aktiv: false, aufrufe: 41, erstellt_am: '2026-10-02T10:00:00Z', beschreibung: 'x' },
  ]
  d.bewerbungen = [
    { id: 'b1', job_id: 'j1', schueler_id: SCHUELER.id, status: 'ausstehend', erstellt_am: '2026-11-21T10:00:00Z' },
    { id: 'b2', job_id: 'j1', schueler_id: SCHUELER.id, status: 'angenommen', erstellt_am: '2026-11-21T11:00:00Z' },
  ]
  return d
}

async function oeffne(page, datenbank = db()) {
  await setupDashboard(page.context(), { db: datenbank, user: FIRMA })
  await page.goto('/dashboard-firma.html?ansicht=jobs')
  await expect(page.locator('.anz-karte').first()).toBeVisible({ timeout: 20_000 })
  return datenbank
}

const karte = (page, titel) => page.locator('.anz-karte', { hasText: titel })

test('die drei Zahlen oben zaehlen, was wirklich online ist', async ({ page }) => {
  await oeffne(page)
  await expect(page.locator('.anz-stat-zahl')).toHaveText(['1', '2', '169'])
  await expect(page.locator('.anz-stat--online')).toContainText('von 2 insgesamt')
  await expect(page.locator('.anz-stat--bewerbungen')).toContainText('1 wartet auf Antwort')
})

test('jede Karte nennt ihren Stand und ihre eigenen Zahlen', async ({ page }) => {
  await oeffne(page)
  await expect(karte(page, 'Lagermitarbeiter').locator('.anz-status')).toHaveText('Online')
  await expect(karte(page, 'Aushilfe Eisdiele').locator('.anz-status')).toHaveText('Pausiert')
  await expect(karte(page, 'Lagermitarbeiter').locator('.anz-zahl dd')).toHaveText(['128', '2', '1'])
  await expect(karte(page, 'Aushilfe Eisdiele').locator('.anz-zahl dd')).toHaveText(['41', '0', '0'])
  // Lohn in deutscher Schreibweise, keine Emojis als Symbole mehr
  await expect(karte(page, 'Aushilfe Eisdiele')).toContainText('13,50 €/Std.')
  await expect(page.locator('#meine-jobs')).not.toContainText(/[👁📨⏸⏳⧉]/u)
})

test('neue Firma: alles steht "In Prüfung", nichts zaehlt als online', async ({ page }) => {
  await oeffne(page, db({ firma: { firma_status: 'neu' } }))
  await expect(page.locator('.anz-status')).toHaveText(['In Prüfung', 'In Prüfung'])
  await expect(page.locator('.anz-stat-zahl').first()).toHaveText('0')
  await expect(page.locator('.anz-stat--online')).toContainText('nach der Freigabe')
})

test('nur eine Anzeige, die online ist, verlinkt auf die oeffentliche Seite', async ({ page }) => {
  await oeffne(page)
  await expect(karte(page, 'Lagermitarbeiter').locator('.anz-titel a')).toHaveAttribute('href', 'job.html?id=j1')
  await expect(karte(page, 'Aushilfe Eisdiele').locator('.anz-titel a')).toHaveCount(0)
})

test('Pausieren und Aktivieren schreiben weiter in die Datenbank', async ({ page }) => {
  const d = await oeffne(page)
  await karte(page, 'Aushilfe Eisdiele').locator('[data-pause]').click()
  await expect.poll(() => d.jobs.find(j => j.id === 'j2').aktiv).toBe(true)
  await expect(karte(page, 'Aushilfe Eisdiele').locator('.anz-status')).toHaveText('Online')
})

test('Duplizieren oeffnet das Formular als neue Anzeige', async ({ page }) => {
  await oeffne(page)
  await karte(page, 'Lagermitarbeiter').locator('[data-duplicate]').click()
  await expect(page.locator('#view-posten')).toHaveClass(/active/)
  await expect(page.locator('#job-titel')).toHaveValue('Lagermitarbeiter')
})

test('der Knopf im Kopf fuehrt zum Posten', async ({ page }) => {
  await oeffne(page)
  await page.locator('[data-anz-neu]').click()
  await expect(page.locator('#view-posten')).toHaveClass(/active/)
})

test('auf 360px ragt nichts ueber den Rand', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await oeffne(page)
  const zuBreit = await page.evaluate(() => {
    const max = document.documentElement.clientWidth
    return [...document.querySelectorAll('#view-jobs *')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > max + 1 })
      .map(e => e.className || e.tagName).slice(0, 5)
  })
  expect(zuBreit, 'Elemente ragen ueber den Rand').toEqual([])
})
