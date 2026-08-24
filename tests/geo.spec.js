// Umkreissuche: Ortsdaten dürfen bei einer Störung nicht verloren gehen.
//
// Anlass (Durchsicht am 24.8.): `geocode()` gab bei JEDEM Problem `null`
// zurück – egal ob der Ort nicht existierte oder der Dienst gerade nicht
// antwortete. Die Aufrufer schrieben daraufhin `lat = null` in die
// Datenbank. Wer also nur seinen Namen änderte, während der Geo-Dienst
// klemmte, verlor seine gespeicherten Koordinaten und tauchte in der
// Umkreissuche nicht mehr auf – ohne jeden Hinweis.
//
// Dazu fehlte ein Zeitlimit: Antwortete der Dienst gar nicht, hing das
// Speichern des Profils unbegrenzt.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, warteAufDashboard } = require('./helpers/supabase-fake')

const GEO = 'https://geocoding-api.open-meteo.com/**'

// Ein Profil, das bereits gültige Koordinaten hat.
function dbMitKoordinaten() {
  return defaultDb({
    profiles: [profilZeile(SCHUELER, { verifiziert: true, ort: 'München', lat: 48.137, lon: 11.575 })],
  })
}

test.describe('geocode unterscheidet drei Fälle', () => {
  async function frage(page, ort) {
    return page.evaluate(async (o) => {
      const { geocode } = await import('./js/geo.js')
      return geocode(o)
    }, ort)
  }

  test('Ort gefunden', async ({ page }) => {
    await setupDashboard(page.context(), {})
    await page.route(GEO, r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ results: [{ latitude: 48.1, longitude: 11.5 }] }) }))
    await page.goto('/index.html')
    expect(await frage(page, 'München')).toEqual({ status: 'ok', lat: 48.1, lon: 11.5 })
  })

  test('Ort gibt es nicht', async ({ page }) => {
    await setupDashboard(page.context(), {})
    await page.route(GEO, r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({}) }))
    await page.goto('/index.html')
    expect(await frage(page, 'Xyzstadt')).toEqual({ status: 'unbekannt' })
  })

  test('Dienst gestört', async ({ page }) => {
    await setupDashboard(page.context(), {})
    await page.route(GEO, r => r.fulfill({ status: 503, body: '' }))
    await page.goto('/index.html')
    expect(await frage(page, 'München')).toEqual({ status: 'gestoert' })
  })

  test('kein Netz', async ({ page }) => {
    await setupDashboard(page.context(), {})
    await page.route(GEO, r => r.abort('failed'))
    await page.goto('/index.html')
    expect(await frage(page, 'München')).toEqual({ status: 'gestoert' })
  })
})

test('Störung löscht vorhandene Koordinaten NICHT', async ({ page }) => {
  // Der Kern des Ganzen: Ein Schüler ändert nur seinen Namen, während
  // der Geo-Dienst klemmt. Seine Koordinaten müssen erhalten bleiben.
  const db = dbMitKoordinaten()
  await setupDashboard(page.context(), { user: SCHUELER, db })
  await page.route(GEO, r => r.fulfill({ status: 503, body: '' }))
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)

  await page.click('#sidebar-toggle')
  await page.click('.sidebar-item[data-view="profil"]')
  await page.fill('#profile-name', 'Neuer Name')
  await page.click('#profil-speichern, button[type=submit]')

  await expect.poll(() => db.profiles[0].name, { timeout: 15_000 }).toBe('Neuer Name')
  expect(db.profiles[0].lat, 'Koordinaten blieben erhalten').toBe(48.137)
  expect(db.profiles[0].lon).toBe(11.575)
})

test('unbekannter Ort löscht die Koordinaten und sagt es', async ({ page }) => {
  // Anders als bei einer Störung: Hier ist das Löschen richtig, denn der
  // alte Ort stimmt ja nicht mehr. Aber der Nutzer muss es erfahren.
  const db = dbMitKoordinaten()
  await setupDashboard(page.context(), { user: SCHUELER, db })
  await page.route(GEO, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({}) }))
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)

  await page.click('#sidebar-toggle')
  await page.click('.sidebar-item[data-view="profil"]')
  await page.fill('#profile-ort', 'Gibtesnichtstadt')
  await page.click('#profil-speichern, button[type=submit]')

  await expect(page.locator('.toast').filter({ hasText: /Ort/i }).first())
    .toBeVisible({ timeout: 15_000 })
  await expect.poll(() => db.profiles[0].lat, { timeout: 10_000 })
    .toBeNull()
})

test('hängender Dienst blockiert das Speichern nicht ewig', async ({ page }) => {
  // Ohne Zeitlimit wartet fetch unbegrenzt - und mit ihm das Speichern.
  await setupDashboard(page.context(), {})
  await page.route(GEO, () => { /* nie antworten */ })
  await page.goto('/index.html')

  const start = Date.now()
  const ergebnis = await page.evaluate(async () => {
    const { geocode } = await import('./js/geo.js')
    return geocode('München')
  })
  const dauer = Date.now() - start

  expect(ergebnis).toEqual({ status: 'gestoert' })
  // Das eingebaute Zeitlimit liegt bei 8 Sekunden.
  expect(dauer, 'gibt nach dem Zeitlimit auf').toBeLessThan(15_000)
})
