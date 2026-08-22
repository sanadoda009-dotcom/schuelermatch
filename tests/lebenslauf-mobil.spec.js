// Lebenslauf-Editor auf dem Handy – bewusst mit ECHTER Touch-Emulation
// (Pixel 7), weil die (pointer: coarse)-Regeln sonst nicht greifen.
//
// Hintergrund: Gemessen waren die Eingabefelder nur 128px breit, im
// Sprachen-Block sogar 8px, und die Karten-Knöpfe (hoch/runter/löschen)
// nur 19x24px – auf einem Handy praktisch nicht treffbar.
const base = require('@playwright/test')
const { setupDashboard, defaultDb, profilZeile, SCHUELER } = require('./helpers/supabase-fake')

const test = base.test.extend({})
const expect = base.expect
test.use({ ...base.devices['Pixel 7'] })

const MIN_TIPPZIEL = 40   // Faustregel für Touch

function profilMitBloecken() {
  return profilZeile(SCHUELER, {
    verifiziert: true, schule: 'Gymnasium München-Nord', klasse: '10. Klasse',
    lebenslauf_bloecke: [
      { id: 'b1', typ: 'text', titel: 'Über mich', inhalt: 'Ich bin zuverlässig.' },
      { id: 'b2', typ: 'sprachen', titel: 'Sprachen', sprachen: [{ name: 'Deutsch', niveau: 'Muttersprache' }] },
      { id: 'b3', typ: 'skillbar', titel: 'Fähigkeiten', skills: [{ name: 'Teamfähigkeit', wert: 70 }] },
    ],
  })
}

async function oeffneEditor(page) {
  const db = defaultDb({ profiles: [profilMitBloecken()] })
  await setupDashboard(page.context(), { user: SCHUELER, db })
  await page.goto('/lebenslauf.html')
  await expect(page.locator('.ll-karte').first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.querySelectorAll('.ll-karte').forEach(d => { d.open = true }))
  return db
}

test('Touch wird erkannt und die Seite scrollt nicht seitlich', async ({ page }) => {
  await oeffneEditor(page)
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
  const scrollt = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(scrollt).toBe(false)
})

test('Schule und Klasse stehen untereinander statt in zwei engen Spalten', async ({ page }) => {
  await oeffneEditor(page)
  const spalten = await page.locator('.ll-zwei').first().evaluate(el => getComputedStyle(el).gridTemplateColumns)
  expect(spalten.split(' ').length).toBe(1)   // eine Spalte

  const breite = await page.locator('#ll-schule').evaluate(el => Math.round(el.getBoundingClientRect().width))
  expect(breite).toBeGreaterThan(200)          // vorher: 128px
})

test('kein Eingabefeld ist unbrauchbar schmal', async ({ page }) => {
  await oeffneEditor(page)
  const schmale = await page.evaluate(() => {
    const raus = []
    document.querySelectorAll('input[type=text], select, textarea').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.width < 150) raus.push(`${Math.round(r.width)}px ${el.className || el.id}`)
    })
    return raus
  })
  // Vorher steckte hier ein 8px breites Feld im Sprachen-Block
  expect(schmale).toEqual([])
})

test('Bedienknöpfe sind groß genug für Finger', async ({ page }) => {
  await oeffneEditor(page)
  const zuKlein = await page.evaluate((min) => {
    const raus = []
    const pruefen = ['.ll-karte-tools button', '.zeile-weg', '.ll-mobil-toggle button', '.tipp-btn', '.block-add-btn']
    pruefen.forEach(sel => document.querySelectorAll(sel).forEach(el => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return
      const r = el.getBoundingClientRect()
      if (r.width === 0) return
      if (r.height < min || r.width < min) raus.push(`${sel}: ${Math.round(r.width)}x${Math.round(r.height)}`)
    }), min)
    return raus
  }, MIN_TIPPZIEL)
  expect(zuKlein).toEqual([])
})

test('Tippen in ein Feld funktioniert und wird gespeichert', async ({ page }) => {
  const db = await oeffneEditor(page)

  await page.locator('#ll-schule').fill('Realschule Nord')
  await page.locator('#ll-klasse').selectOption({ index: 3 }).catch(() => {})
  // Autosave läuft verzögert -> abwarten, bis es in der Fake-DB steht
  await expect.poll(() => db.profiles[0].schule, { timeout: 15_000 }).toBe('Realschule Nord')
})

test('Umschalter zeigt die Vorschau und wieder zurück', async ({ page }) => {
  await oeffneEditor(page)

  const knoepfe = page.locator('.ll-mobil-toggle button')
  await expect(knoepfe).toHaveCount(2)
  await expect(page.locator('#ll-editor')).toBeVisible()

  await knoepfe.nth(1).click()                       // "Vorschau"
  await expect(page.locator('#ll-vorschau')).toBeVisible()
  await expect(page.locator('#ll-editor')).toBeHidden()

  await knoepfe.nth(0).click()                       // zurück zu "Bearbeiten"
  await expect(page.locator('#ll-editor')).toBeVisible()
})

test('neuen Abschnitt hinzufügen funktioniert per Fingertipp', async ({ page }) => {
  await oeffneEditor(page)
  const vorher = await page.locator('.ll-karte').count()

  await page.locator('.block-add-btn[data-titel="Verfügbarkeit"]').click()
  await expect(page.locator('.ll-karte')).toHaveCount(vorher + 1)
  await expect(page.locator('.ll-karte').last()).toContainText('Verfügbarkeit')
})
