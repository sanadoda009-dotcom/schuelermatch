// Die drei Job-Karten auf der Startseite (4.9.2026).
//
// DER BEFUND, gemessen: `js/jobs-preview.js` rief `jobKarteHtml(job)`
// OHNE Optionen auf. Die Karte trug trotzdem `job-card--clickable` und
// damit `cursor: pointer` —
//
//   Klassen:      job-card job-card--clickable
//   cursor:       pointer
//   role:         null       tabindex: null
//   data-detail:  aaaaaaaa-…       (gesetzt, aber niemand lauscht)
//   Klick:        URL vorher == URL nachher
//
// Also: Sie SAHEN klickbar aus, waren es aber nicht. Drei tote Karten
// direkt unter der Kopfzeile der Startseite — das Erste, was ein Schüler
// sieht. Er klickt, nichts passiert, und lernt daraus, dass die Seite
// nicht funktioniert.
//
// Für die Tastatur und für Screenreader existierten sie gar nicht: ohne
// `tabindex` kein Fokus, ohne `role` keine Ansage.
//
// Gefunden mit dem Suchmuster „welche Datei kommt in keinem Test vor?" —
// `js/jobs-preview.js`, 48 Zeilen, null Tests. Dasselbe Muster wie bei
// `js/notifications.js` (die Glocke) und `js/sicher.js`.

const { test, expect } = require('./helpers/basis')

const ERSTE_ID = 'aaaaaaaa-0000-4000-8000-000000000001'

test.describe('die Vorschaukarten führen irgendwohin', () => {
  test('ein Klick öffnet die Anzeige', async ({ page }) => {
    await page.goto('/index.html')
    const karte = page.locator('#preview-jobs-grid .job-card').first()
    await expect(karte).toBeVisible({ timeout: 20_000 })
    await karte.click()
    await expect(page).toHaveURL(new RegExp(`job\\.html\\?id=${ERSTE_ID}`))
  })

  test('die Tastatur kommt auch hin', async ({ page }) => {
    // Ohne tabindex war die Karte für die Tastatur gar nicht vorhanden.
    await page.goto('/index.html')
    const karte = page.locator('#preview-jobs-grid .job-card').first()
    await expect(karte).toBeVisible({ timeout: 20_000 })
    await expect(karte).toHaveAttribute('tabindex', '0')
    await karte.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/job\.html\?id=/)
  })

  test('die Leertaste tut dasselbe und scrollt nicht weg', async ({ page }) => {
    await page.goto('/index.html')
    const karte = page.locator('#preview-jobs-grid .job-card').first()
    await expect(karte).toBeVisible({ timeout: 20_000 })
    await karte.focus()
    await page.keyboard.press(' ')
    await expect(page).toHaveURL(/job\.html\?id=/)
  })

  test('ein Screenreader erfährt, dass es ein Knopf ist', async ({ page }) => {
    await page.goto('/index.html')
    const karte = page.locator('#preview-jobs-grid .job-card').first()
    await expect(karte).toBeVisible({ timeout: 20_000 })
    await expect(karte).toHaveAttribute('role', 'button')
    await expect(karte).toHaveAttribute('aria-label', /Details zu /)
  })
})

test.describe('was sich sonst nicht ändern darf', () => {
  test('es bleiben höchstens drei Karten', async ({ page }) => {
    // `.limit(3)` – sonst wächst die Startseite mit dem Angebot.
    await page.goto('/index.html')
    await expect(page.locator('#preview-jobs-grid .job-card').first())
      .toBeVisible({ timeout: 20_000 })
    const anzahl = await page.locator('#preview-jobs-grid .job-card').count()
    expect(anzahl).toBeGreaterThan(0)
    expect(anzahl).toBeLessThanOrEqual(3)
  })

  test('ohne Anzeigen steht da, warum – und nicht nichts', async ({ page }) => {
    await page.route('**/rest/v1/jobs*', route => route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: '[]',
    }))
    await page.goto('/index.html')
    await expect(page.locator('#preview-jobs-grid')).toContainText('keine Anzeige online', { timeout: 20_000 })
  })

  test('bei einer Störung kommt kein leeres Feld, sondern ein Weg zurück', async ({ page }) => {
    // Störung und Leere sind zwei verschiedene Dinge (js/zustand.js).
    await page.route('**/rest/v1/jobs*', route => route.fulfill({ status: 500, body: 'kaputt' }))
    await page.goto('/index.html')
    await expect(page.locator('#preview-jobs-grid')).toContainText('konnte gerade nicht', { timeout: 20_000 })
  })
})
