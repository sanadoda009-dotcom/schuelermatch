// Job-Alarm im Schüler-Dashboard (26.8.).
//
// Die Karte sitzt UNTER der Jobliste — dort kommt an, wer nichts
// Passendes gefunden hat. Genau dann ist der Alarm etwas wert, und
// genau dann stehen die Filter schon richtig: Der Alarm übernimmt sie.
//
// Der wichtigste Test hier ist der letzte: Solange die Tabelle in der
// Datenbank fehlt, muss die Karte STUMM verschwinden. Ein Schüler soll
// nichts von einer halbfertigen Baustelle mitbekommen — und genau
// dieser Zustand herrscht gerade, weil die Datenbank-Änderung noch
// aussteht.
const { test, expect, setupDashboard, SCHUELER, defaultDb, warteAufDashboard } = require('./helpers/supabase-fake')

// Die Geokodierung geht sonst wirklich ins Netz und macht den Test
// langsam und wackelig.
async function geoMocken(page, treffer = { lat: 48.137, lon: 11.575 }) {
  await page.route('**/geocoding-api.open-meteo.com/**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ results: treffer ? [{ latitude: treffer.lat, longitude: treffer.lon }] : [] }),
    }))
}

async function oeffneDashboard(page) {
  await setupDashboard(page.context(), { user: SCHUELER })
  await geoMocken(page)
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
}

const karte = page => page.locator('#alarm-karte')

// Ein Schüler-Profil ohne Wohnort.
function ohneWohnort() {
  const db = defaultDb()
  db.profiles = db.profiles.map(p => (p.id === SCHUELER.id ? { ...p, ort: null, lat: null, lon: null } : p))
  return db
}

test('ohne Alarm bietet die Karte einen an', async ({ page }) => {
  await oeffneDashboard(page)
  await expect(karte(page)).toBeVisible()
  await expect(karte(page)).toContainText('Nichts Passendes dabei?')
  await expect(page.locator('#alarm-an')).toHaveText('Job-Alarm einrichten')
})

test('ohne Ort wird nichts gespeichert, sondern erklärt', async ({ page }) => {
  // Nur wenn WEDER Filter NOCH Profil einen Ort kennen. Steht im Profil
  // ein Wohnort, nimmt der Alarm den — das ist Absicht und wird im
  // nächsten Test geprüft.
  await setupDashboard(page.context(), { user: SCHUELER, db: ohneWohnort() })
  await geoMocken(page)
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)

  let gespeichert = false
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') gespeichert = true
    await route.fallback()
  })

  await page.fill('#filter-ort', '')
  await page.locator('#alarm-an').click()

  await expect(page.locator('.toast--fehler')).toContainText('Ort')
  expect(gespeichert, 'ohne Ort darf nichts in die Datenbank').toBe(false)
  // Die Karte bleibt im Angebots-Zustand.
  await expect(karte(page)).toContainText('Nichts Passendes dabei?')
})

test('der Alarm übernimmt die aktuellen Filter', async ({ page }) => {
  await oeffneDashboard(page)

  let gesendet = null
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') gesendet = route.request().postDataJSON()
    await route.fallback()
  })

  // So, wie ein Schüler es einstellen würde, bevor er aufgibt.
  await page.fill('#filter-ort', 'München')
  await page.selectOption('#filter-kategorie', 'Nachhilfe')
  await page.selectOption('#filter-arbeitszeit', 'Nachmittags')
  await page.selectOption('#filter-gehalt', '12')
  await page.locator('#alarm-an').click()

  await expect(karte(page)).toContainText('Job-Alarm läuft')

  const zeile = Array.isArray(gesendet) ? gesendet[0] : gesendet
  expect(zeile.ort).toBe('München')
  expect(zeile.kategorie).toBe('Nachhilfe')
  expect(zeile.arbeitszeit).toBe('Nachmittags')
  expect(Number(zeile.min_lohn)).toBe(12)
  expect(zeile.aktiv).toBe(true)
  expect(zeile.schueler_id, 'der Alarm gehört dem eingeloggten Schüler').toBe(SCHUELER.id)
  expect(zeile.lat, 'Koordinaten für die Umkreissuche').toBeCloseTo(48.137, 2)

  // Und die Karte sagt zurück, worauf sie hört.
  await expect(page.locator('.alarm-kriterien')).toContainText('Nachhilfe')
  await expect(page.locator('.alarm-kriterien')).toContainText('München')
})

test('ohne Koordinaten wird trotzdem gespeichert', async ({ page }) => {
  // Ein Ort, den die Geokodierung nicht kennt, darf den Alarm nicht
  // verhindern — die Funktion vergleicht dann über den Ortsnamen.
  await setupDashboard(page.context(), { user: SCHUELER })
  await geoMocken(page, null)
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)

  let zeile = null
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') {
      const d = route.request().postDataJSON()
      zeile = Array.isArray(d) ? d[0] : d
    }
    await route.fallback()
  })

  await page.fill('#filter-ort', 'Kleinkleckersdorf')
  await page.locator('#alarm-an').click()

  await expect(karte(page)).toContainText('Job-Alarm läuft')
  expect(zeile.ort).toBe('Kleinkleckersdorf')
  expect(zeile.lat, 'ohne Treffer wird die Koordinate ausdrücklich geleert').toBeNull()
  expect(zeile.lon).toBeNull()
})

test('bei gestörtem Geo-Dienst bleiben die bisherigen Koordinaten erhalten', async ({ page }) => {
  // geocode() unterscheidet „Ort gibt es nicht" von „Dienst antwortet
  // nicht". Beim zweiten Fall darf ein bereits gespeicherter Umkreis
  // nicht stillschweigend verlorengehen — solange der Ort derselbe ist.
  await oeffneDashboard(page)
  await page.fill('#filter-ort', 'München')
  await page.locator('#alarm-an').click()
  await expect(karte(page)).toContainText('Job-Alarm läuft')

  // Ab jetzt klemmt der Dienst.
  await page.route('**/geocoding-api.open-meteo.com/**', route => route.abort())

  let zeile = null
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') {
      const d = route.request().postDataJSON()
      zeile = Array.isArray(d) ? d[0] : d
    }
    await route.fallback()
  })

  await page.selectOption('#filter-kategorie', 'Nachhilfe')
  await page.locator('#alarm-neu').click()
  await expect(page.locator('.alarm-kriterien')).toContainText('Nachhilfe')

  expect(zeile.lat, 'gleicher Ort, Dienst gestört -> Koordinaten behalten').toBeCloseTo(48.137, 2)
})

test('bei gestörtem Dienst und NEUEM Ort werden die alten Koordinaten verworfen', async ({ page }) => {
  // Sie zeigten sonst auf die alte Stadt, und der Umkreis suchte am
  // falschen Fleck — schlimmer als gar keine Koordinate.
  await oeffneDashboard(page)
  await page.fill('#filter-ort', 'München')
  await page.locator('#alarm-an').click()
  await expect(karte(page)).toContainText('Job-Alarm läuft')

  await page.route('**/geocoding-api.open-meteo.com/**', route => route.abort())

  let zeile = null
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') {
      const d = route.request().postDataJSON()
      zeile = Array.isArray(d) ? d[0] : d
    }
    await route.fallback()
  })

  await page.fill('#filter-ort', 'Hamburg')
  await page.locator('#alarm-neu').click()
  await expect(page.locator('.alarm-kriterien')).toContainText('Hamburg')

  expect(zeile.lat, 'anderer Ort -> keine alten Koordinaten übernehmen').toBeNull()
})

test('ein laufender Alarm lässt sich ausschalten', async ({ page }) => {
  await oeffneDashboard(page)
  await page.fill('#filter-ort', 'München')
  await page.locator('#alarm-an').click()
  await expect(karte(page)).toContainText('Job-Alarm läuft')

  await page.locator('#alarm-aus').click()
  await expect(karte(page)).toContainText('Job-Alarm ist aus')
  await expect(page.locator('#alarm-an')).toHaveText('Wieder einschalten')
})

test('solange die Tabelle fehlt, bleibt die Karte verborgen', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER })
  await geoMocken(page)
  // Genau das, was PostgREST bei einer unbekannten Tabelle antwortet.
  await page.route('**/rest/v1/job_alarme*', route =>
    route.fulfill({
      status: 404, contentType: 'application/json',
      body: JSON.stringify({ code: '42P01', message: 'relation "public.job_alarme" does not exist' }),
    }))

  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
  await page.waitForTimeout(800)

  await expect(karte(page), 'keine halbfertige Baustelle zeigen').toBeHidden()
  // Und schon gar keine Fehlermeldung an den Schüler.
  await expect(page.locator('.toast--fehler')).toHaveCount(0)
})


test('ohne Filter-Ort nimmt der Alarm den Wohnort aus dem Profil', async ({ page }) => {
  await oeffneDashboard(page)

  let zeile = null
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') {
      const d = route.request().postDataJSON()
      zeile = Array.isArray(d) ? d[0] : d
    }
    await route.fallback()
  })

  await page.fill('#filter-ort', '')
  await page.locator('#alarm-an').click()

  await expect(karte(page)).toContainText('Job-Alarm läuft')
  expect(zeile.ort, 'Rückfall auf den Wohnort').toBeTruthy()
})
