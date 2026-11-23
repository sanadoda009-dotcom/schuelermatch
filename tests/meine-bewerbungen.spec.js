// "Meine Bewerbungen" im neuen Aufbau (23.11.2026)
//
// Was hier festgehalten wird: Die Oberflaeche ist neu, die Wahrheit
// darunter nicht. Jedes Abzeichen, jede Zahl und jeder Filter kommt aus
// den echten Spalten (status, angesehen_am) - einen Zustand, den die
// Datenbank nicht kennt ("Vorstellungsgespraech"), zeigt die Seite nicht.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, warteAufDashboard } = require('./helpers/supabase-fake')

function db({ bewerbungen } = {}) {
  const d = defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true, alter_jahre: 15 })] })
  const j = d.jobs
  d.bewerbungen = bewerbungen ?? [
    { id: 'b1', job_id: j[0].id, schueler_id: SCHUELER.id, status: 'angenommen', erstellt_am: '2026-11-18T10:00:00Z',
      angesehen_am: '2026-11-19T09:00:00Z', entschieden_am: '2026-11-20T09:00:00Z', telefon: '0171 2345678',
      lebenslauf_url: 'a.pdf', motivationsschreiben: 'Ich helfe gern im Café.' },
    { id: 'b2', job_id: j[1].id, schueler_id: SCHUELER.id, status: 'ausstehend', erstellt_am: '2026-11-21T10:00:00Z',
      angesehen_am: '2026-11-22T09:00:00Z', lebenslauf_url: 'b.pdf' },
    { id: 'b3', job_id: j[2].id, schueler_id: SCHUELER.id, status: 'ausstehend', erstellt_am: '2026-11-10T10:00:00Z',
      angesehen_am: null, lebenslauf_url: 'c.pdf' },
    { id: 'b4', job_id: j[3]?.id ?? j[0].id, schueler_id: SCHUELER.id, status: 'abgelehnt', erstellt_am: '2026-11-02T10:00:00Z',
      angesehen_am: '2026-11-03T09:00:00Z', entschieden_am: '2026-11-05T09:00:00Z', lebenslauf_url: 'd.pdf' },
  ]
  return d
}

async function oeffne(page, datenbank = db()) {
  await setupDashboard(page.context(), { db: datenbank, user: SCHUELER })
  await page.goto('/dashboard-schueler.html?ansicht=bewerbungen')
  await warteAufDashboard(page)
  await expect(page.locator('.mb-karte').first()).toBeVisible({ timeout: 20_000 })
  return datenbank
}

const titel = page => page.locator('.mb-karte .mb-titel').allInnerTexts()

test('die drei Zahlen kommen aus den echten Bewerbungen', async ({ page }) => {
  await oeffne(page)
  const zahlen = await page.locator('.mb-stat-zahl').allInnerTexts()
  expect(zahlen).toEqual(['4', '2', '1'])            // gesamt, offen, Zusagen
  await expect(page.locator('.mb-stat--offen')).toContainText('1 davon angesehen')
  await expect(page.locator('.mb-stat-balken')).toHaveAttribute('aria-label', /25 Prozent/)
})

test('jedes Abzeichen zeigt den echten Stand', async ({ page }) => {
  await oeffne(page)
  const abzeichen = await page.locator('.mb-karte .mb-status').allInnerTexts()
  expect(abzeichen.map(a => a.trim()).sort()).toEqual(['Absage', 'Angesehen', 'Gesendet', 'Zusage'])
  // Nichts, was die Datenbank nicht kennt.
  await expect(page.locator('#view-bewerbungen')).not.toContainText(/Vorstellungsgespr/)
})

test('Filter zeigen ihre Anzahl und filtern', async ({ page }) => {
  await oeffne(page)
  const knopf = f => page.locator(`.mb-filter-knopf[data-mb-filter="${f}"]`)
  await expect(knopf('alle')).toHaveAttribute('aria-pressed', 'true')
  await expect(knopf('offen').locator('.mb-filter-zahl')).toHaveText('2')
  await knopf('offen').click()
  await expect(page.locator('.mb-karte')).toHaveCount(2)
  await expect(page.locator('.mb-karte .mb-status')).not.toContainText(['Zusage'])
  await knopf('zusagen').click()
  await expect(page.locator('.mb-karte')).toHaveCount(1)
  await expect(page.locator('.mb-karte .mb-status')).toHaveText(/Zusage/)
  await expect(knopf('zusagen')).toHaveAttribute('aria-pressed', 'true')
  await expect(knopf('alle')).toHaveAttribute('aria-pressed', 'false')
})

test('ein leerer Filter fuehrt zurueck statt in die Sackgasse', async ({ page }) => {
  const d = db()
  d.bewerbungen = d.bewerbungen.filter(b => b.status !== 'abgelehnt')
  await oeffne(page, d)
  await page.locator('.mb-filter-knopf[data-mb-filter="absagen"]').click()
  await expect(page.locator('.mb-leer--filter')).toContainText('Keine Bewerbungen')
  await page.locator('.mb-leer--filter [data-mb-filter="alle"]').click()
  await expect(page.locator('.mb-karte')).toHaveCount(3)
})

test('Sortierung nach Bewerbungsdatum', async ({ page }) => {
  await oeffne(page)
  const neu = await titel(page)
  await page.locator('#mb-sortierung').selectOption('alt')
  const alt = await titel(page)
  expect(alt).toEqual([...neu].reverse())
})

test('aufklappbar: was mitgeschickt wurde', async ({ page }) => {
  await oeffne(page)
  const zusage = page.locator('.mb-karte--zusage')
  const details = zusage.locator('.mb-details')
  await expect(details.locator('dl')).toBeHidden()
  await details.locator('summary').click()
  await expect(details).toContainText('als PDF angehängt')
  await expect(details).toContainText('0171 2345678')
  await expect(details).toContainText('Ich helfe gern im Café.')
  const ohne = page.locator('.mb-karte--gesendet .mb-details')
  await ohne.locator('summary').click()
  await expect(ohne).toContainText('ohne Anschreiben beworben')
})

test('Titel und "Zur Anzeige" fuehren zur Anzeige', async ({ page }) => {
  const d = await oeffne(page)
  const karte = page.locator('.mb-karte--zusage')
  const ziel = `job.html?id=${encodeURIComponent(d.jobs[0].id)}`
  await expect(karte.locator('.mb-titel a')).toHaveAttribute('href', ziel)
  await expect(karte.locator('.mb-zur-anzeige')).toHaveAttribute('href', ziel)
})

test('geloeschte Anzeige: kein toter Link, Titel bleibt', async ({ page }) => {
  const d = db({ bewerbungen: [] })
  d.bewerbungen = [{ id: 'bx', job_id: null, job_titel: 'Gartenhilfe', schueler_id: SCHUELER.id, status: 'ausstehend',
    erstellt_am: '2026-11-01T10:00:00Z', angesehen_am: null }]
  await oeffne(page, d)
  const karte = page.locator('.mb-karte')
  await expect(karte.locator('.mb-titel')).toHaveText('Gartenhilfe')
  await expect(karte).toContainText('Anzeige wurde entfernt')
  await expect(karte.locator('a.mb-zur-anzeige, .mb-titel a')).toHaveCount(0)
})

test('ohne Bewerbungen: freundlicher Leerzustand mit Weg zu den Jobs', async ({ page }) => {
  await setupDashboard(page.context(), { db: db({ bewerbungen: [] }), user: SCHUELER })
  await page.goto('/dashboard-schueler.html?ansicht=bewerbungen')
  await warteAufDashboard(page)
  await expect(page.locator('.mb-leer h3')).toHaveText('Noch keine Bewerbungen', { timeout: 20_000 })
  await page.locator('#bew-zu-jobs').click()
  await expect(page.locator('#view-jobs')).toHaveClass(/active/)
})

test('der Knopf im Kopf fuehrt zu den Jobs', async ({ page }) => {
  await oeffne(page)
  await page.locator('[data-mb-zu-jobs]').click()
  await expect(page.locator('#view-jobs')).toHaveClass(/active/)
})

test('auf 360px nichts breiter als der Bildschirm', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await oeffne(page)
  const zuBreit = await page.evaluate(() => {
    const max = document.documentElement.clientWidth
    return [...document.querySelectorAll('#view-bewerbungen *')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > max + 1 })
      .map(e => e.className || e.tagName).slice(0, 5)
  })
  expect(zuBreit, 'Elemente ragen ueber den Rand').toEqual([])
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(scroll).toBeLessThanOrEqual(0)
})
