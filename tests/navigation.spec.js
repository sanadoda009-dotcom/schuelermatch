// Navigation: überall gleich, und auf dem Handy erreichbar.
//
// Anlass (25.8.): In drei Runden waren vier neue Seiten dazugekommen, und
// bei jeder hatte ich die Menüleiste ein Stück erweitert. Ergebnis: FÜNF
// verschiedene Navigationen. Wer von der Startseite auf "Jobideen" klickte,
// verlor "Für Arbeitgeber" aus dem Menü. Auf `jugendarbeitsschutz.html`
// fehlte sogar der Hamburger-Knopf – dort war das Menü auf dem Handy
// überhaupt nicht erreichbar.
//
// Ein Nebeneffekt des eigenen Wachstums. Diese Tests halten fest, dass es
// beim nächsten Ausbau nicht wieder auseinanderläuft.
const { test, expect, setupDashboard } = require('./helpers/supabase-fake')

// Alle Seiten mit vollständiger Navigation. login/register haben bewusst
// nur eine minimale Leiste (Blick soll auf dem Formular bleiben) und
// stehen deshalb nicht in dieser Liste.
const SEITEN = [
  '/index.html',
  '/jobs.html',
  '/job.html?id=aaaaaaaa-0000-4000-8000-000000000001',
  '/jobideen.html',
  '/job-finder.html',
  '/eltern.html',
  '/fuer-firmen.html',
  '/jugendarbeitsschutz.html',
  '/fairer-lohn.html',
  '/ferienjob.html',
  '/taschengeld.html',
  '/ratgeber.html',
  '/404.html',
]

// Am 26.8. um 'Ratgeber' erweitert: Ferienjob, Taschengeld und Fairer
// Lohn waren von der Startseite aus nur ueber den Footer erreichbar.
const ERWARTET = ['Jobs', 'Job-Finder', 'Jobideen', 'Ratgeber', 'Für Arbeitgeber']

async function menue(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.nav-links a')].map(a => a.textContent.trim()))
}

test.describe('gleiche Navigation auf allen Seiten', () => {
  for (const pfad of SEITEN) {
    test(`Menü stimmt: ${pfad}`, async ({ page }) => {
      await setupDashboard(page.context(), {})
      await page.goto(pfad)
      await page.waitForTimeout(600)
      expect(await menue(page)).toEqual(ERWARTET)
    })
  }
})

test.describe('Menü ist auf dem Handy erreichbar', () => {
  for (const pfad of SEITEN) {
    test(`Hamburger vorhanden: ${pfad}`, async ({ page }) => {
      // Ohne diesen Knopf sind die Links auf dem Handy unerreichbar,
      // weil sie per CSS ausgeblendet werden.
      await setupDashboard(page.context(), {})
      await page.goto(pfad)
      await page.waitForTimeout(400)
      await expect(page.locator('nav .nav-toggle')).toHaveCount(1)
    })
  }
})

test('die aktuelle Seite ist im Menü markiert', async ({ page }) => {
  // Sonst weiß man nie, wo man gerade ist.
  await setupDashboard(page.context(), {})
  for (const [pfad, erwartet] of [
    ['/jobs.html', 'Jobs'],
    ['/jobideen.html', 'Jobideen'],
    ['/fuer-firmen.html', 'Für Arbeitgeber'],
  ]) {
    await page.goto(pfad)
    await page.waitForTimeout(400)
    const aktiv = await page.evaluate(() =>
      document.querySelector('.nav-links a[aria-current="page"]')?.textContent.trim())
    expect(aktiv, `aktive Markierung auf ${pfad}`).toBe(erwartet)
  }
})

test('kein Menülink zeigt ins Leere', async ({ page }) => {
  await setupDashboard(page.context(), {})
  await page.goto('/index.html')
  await page.waitForTimeout(500)
  const ziele = await page.evaluate(() =>
    [...document.querySelectorAll('.nav-links a')].map(a => a.getAttribute('href')))

  for (const ziel of ziele) {
    // Anker auf Abschnitte gab es früher hier – die brachen, sobald man
    // auf einer anderen Seite war.
    expect(ziel, 'kein reiner Anker im Hauptmenü').not.toMatch(/^#/)
    const antwort = await page.request.get(ziel)
    expect(antwort.status(), `${ziel} erreichbar`).toBeLessThan(400)
  }
})

test('der Footer führt zu den Seiten, die nicht im Menü stehen', async ({ page }) => {
  // "Für Eltern" gehört nicht ins Hauptmenü (Eltern kommen über Suche
  // oder Link), muss aber auffindbar bleiben.
  await setupDashboard(page.context(), {})
  await page.goto('/index.html')
  await page.waitForTimeout(500)
  for (const ziel of ['eltern.html', 'jugendarbeitsschutz.html', 'impressum.html', 'datenschutz.html']) {
    await expect(page.locator(`footer a[href="${ziel}"]`), `Footer-Link ${ziel}`).toHaveCount(1)
  }
})
