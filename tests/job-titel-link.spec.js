// Der Anzeigentitel ist ein echter Link (8.9.2026).
//
// DER BEFUND: Die Jobkarte war ein `<div>` mit `role="button"`. Damit gab
// es auf der ganzen Seite KEINEN `href` auf eine einzelne Anzeige —
// geprüft über alle 30 HTML-Seiten und alle Dateien in `js/`.
//
// Was dadurch fehlte:
//
//   * Mittelklick und Strg-Klick taten nichts. Auf einem Jobbrett ist
//     „mehrere Anzeigen in Tabs öffnen" die normale Art zu suchen.
//   * „Link kopieren" fehlte im Kontextmenü.
//   * Screenreader sagten „Schaltfläche" statt „Link", obwohl das Ziel
//     eine eigene Seite ist.
//   * `js/job-detail.js` legt für jede Anzeige JobPosting-Daten für
//     Google an — aber nichts verlinkte dorthin. In `sitemap.xml` steht
//     `job.html` ebenfalls nicht, und kann dort auch nicht stehen: Ohne
//     `?id=` ist die Seite leer. Der einzige Weg zu einer Anzeige führt
//     also über einen Link, den es nicht gab.
//
// Der normale Klick öffnet weiterhin das Fenster in der Seite — das ist
// schneller als ein Seitenwechsel. Mit Strg, Cmd, Umschalt oder mittlerer
// Maustaste gehört die Entscheidung dem Nutzer.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')

test.describe('auf der Jobbörse', () => {
  test('jede Karte trägt einen Link auf ihre Anzeige', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })

    const karten = await page.locator('.job-card').count()
    const links = await page.locator('.job-card a.job-titel-link').count()
    expect(links).toBe(karten)
  })

  test('und der Link zeigt wirklich auf diese Anzeige', async ({ page }) => {
    await page.goto('/jobs.html')
    const karte = page.locator('.job-card').first()
    await expect(karte).toBeVisible({ timeout: 20_000 })
    const id = await karte.getAttribute('data-detail')
    await expect(karte.locator('a.job-titel-link'))
      .toHaveAttribute('href', `job.html?id=${id}`)
  })

  test('ein gewöhnlicher Klick öffnet weiter das Fenster in der Seite', async ({ page }) => {
    // Der Seitenwechsel wäre der langsamere Weg — deshalb bleibt es beim
    // Fenster, solange niemand ausdrücklich etwas anderes will.
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
    await page.locator('.job-card a.job-titel-link').first().click()
    await expect(page.locator('#job-detail-overlay')).toHaveClass(/open/)
    await expect(page).toHaveURL(/jobs\.html/)
  })

  test('mit Strg gehört die Entscheidung dem Nutzer', async ({ page, context }) => {
    // Der Kern des Fundes: In einem Jobbrett will man mehrere Anzeigen
    // nebeneinander legen. Vorher war das unmöglich.
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })

    const neueSeite = context.waitForEvent('page', { timeout: 15_000 })
    await page.locator('.job-card a.job-titel-link').first()
      .click({ modifiers: ['ControlOrMeta'] })
    const tab = await neueSeite
    await expect(tab).toHaveURL(/job\.html\?id=/)
    // Und das Fenster in der alten Seite ist NICHT aufgegangen.
    await expect(page.locator('#job-detail-overlay')).not.toHaveClass(/open/)
    await tab.close()
  })
})

test.describe('auf den anderen Seiten mit Karten', () => {
  test('die Startseite verlinkt ihre drei Anzeigen', async ({ page }) => {
    await page.goto('/index.html')
    await expect(page.locator('#preview-jobs-grid .job-card').first())
      .toBeVisible({ timeout: 20_000 })
    await expect(page.locator('#preview-jobs-grid a.job-titel-link').first())
      .toHaveAttribute('href', /job\.html\?id=/)
  })

  test('die Firmenseite ebenso', async ({ page }) => {
    await page.goto('/firma.html?id=ffffffff-0000-4000-8000-000000000001')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('a.job-titel-link').first())
      .toHaveAttribute('href', /job\.html\?id=/)
  })
})

test.describe('im Dashboard bleibt es beim Knopf', () => {
  test('dort öffnet der Titel ein Fenster, keine neue Seite', async () => {
    // Bewusst anders: Das Dashboard zeigt Merken- und Bewerben-Knöpfe in
    // derselben Karte. Ein <a>, das <button> enthält, wäre ungültiges
    // HTML — und das Fenster ist dort der richtige Weg.
    const quelle = fs.readFileSync(path.join(WURZEL, 'js', 'job-karte.js'), 'utf8')
    expect(quelle).toContain('data-detail-btn')
    expect(quelle).toContain('o.titelAlsKnopf')
  })
})

test.describe('warum es überhaupt zählt', () => {
  test('für jede Anzeige entstehen Google-Daten', async () => {
    // Ohne einen Link dorthin sind die Daten für niemanden sichtbar.
    const quelle = fs.readFileSync(path.join(WURZEL, 'js', 'job-detail.js'), 'utf8')
    expect(quelle).toContain('JobPosting')
  })

  test('und die Sitemap kann job.html nicht enthalten', async () => {
    // Ohne `?id=` ist die Seite leer — ein Eintrag dort wäre eine
    // Falschauskunft. Umso mehr hängt alles am Link in der Karte.
    const sm = fs.readFileSync(path.join(WURZEL, 'sitemap.xml'), 'utf8')
    expect(sm).not.toContain('/job.html')
    expect(sm).toContain('/jobs.html')
  })
})
