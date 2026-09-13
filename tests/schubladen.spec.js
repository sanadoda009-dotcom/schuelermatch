// Geschlossen heißt weg, nicht nur verschoben (13.9.2026).
//
// Seitenmenü und Filterfeld sind Schubladen. Geschlossen waren sie nur
// aus dem Bild geschoben (`left: -280px` bzw. `translateX(-100%)`). Beim
// Durchfotografieren aller Dashboard-Ansichten gemessen:
//
//   - Im Schüler-Dashboard landete der Fokus bei 15 Tab-Drücken außerhalb
//     des Bildschirms: acht Menüpunkte, sieben Filterfelder. Wer mit der
//     Tastatur arbeitet, sah den Fokus verschwinden. Bildschirmleser
//     lasen alles vor. Im Firmen-Dashboard acht Mal.
//   - Der Schatten des geschlossenen Menüs reichte ~18px in die Seite –
//     ein grauer Streifen am linken Rand jeder Dashboard-Seite.
//
// Und ein Fund, der erst dadurch sichtbar wurde: Der Jugendschutz-Hinweis
// auf jobs.html („unter 13 darf nicht gearbeitet werden") stand IM
// Filterfeld. Wer über jobs.html?alter=12 kam, bekam ihn nie zu sehen.
// Sein Test war grün, weil Playwright die verschobene Schublade für
// sichtbar hielt.

const { test, expect, setupDashboard, warteAufDashboard, SCHUELER, FIRMA } = require('./helpers/supabase-fake')

// Liegt der Fokus je in einer GESCHLOSSENEN Schublade? Bewusst diese
// Frage und nicht „ist der Fokus im Bild": Die Seite scrollt weich
// (`scroll-behavior: smooth`), eine Messung der Position direkt nach dem
// Tab-Druck sieht deshalb auch gewöhnliche Elemente kurz „außerhalb".
async function tabStoppsInGeschlossenen(page, anzahl = 45) {
  const treffer = []
  for (let i = 0; i < anzahl; i++) {
    await page.keyboard.press('Tab')
    const was = await page.evaluate(() => {
      const a = document.activeElement
      if (!a || !a.closest('#sidebar:not(.open), #filter-panel:not(.offen)')) return null
      return (a.id || a.textContent || a.tagName).trim().slice(0, 30)
    })
    if (was) treffer.push(was)
  }
  return treffer
}

for (const [rolle, user, url] of [
  ['Schüler', SCHUELER, '/dashboard-schueler.html'],
  ['Firma', FIRMA, '/dashboard-firma.html'],
]) {
  test.describe(`${rolle}-Dashboard`, () => {
    test('die Tab-Taste führt nie in eine geschlossene Schublade', async ({ page }) => {
      await setupDashboard(page.context(), { user })
      await page.goto(url)
      await warteAufDashboard(page)
      await page.waitForTimeout(800)
      expect(await tabStoppsInGeschlossenen(page), 'Fokus in einer geschlossenen Schublade').toEqual([])
    })

    test('das geschlossene Menü wirft keinen Schatten in die Seite', async ({ page }) => {
      await setupDashboard(page.context(), { user })
      await page.goto(url)
      await warteAufDashboard(page)
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('sidebar')).visibility))
        .toBe('hidden')
    })

    test('geöffnet ist es erreichbar – und geschlossen wieder weg', async ({ page }) => {
      await setupDashboard(page.context(), { user })
      await page.goto(url)
      await warteAufDashboard(page)
      await page.locator('#sidebar-toggle').click()
      await expect(page.locator('#sidebar .sidebar-item').first()).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('#sidebar')).not.toHaveClass(/open/)
      await expect(page.locator('#sidebar .sidebar-item').first()).toBeHidden()
    })
  })
}

// Die öffentliche Jobbörse braucht die Testdaten aus helpers/basis.
const basis = require('./helpers/basis')

basis.test.describe('Filterfeld', () => {
  const expect = basis.expect
  const test = basis.test
  test('geschlossen unsichtbar, geöffnet bedienbar', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('#filter-ort')).toBeHidden()
    await page.locator('#filter-oeffnen').click()
    await expect(page.locator('#filter-ort')).toBeVisible()
    await page.locator('#filter-ort').fill('München')
    await page.locator('#filter-schliessen').click()
    await expect(page.locator('#filter-ort')).toBeHidden()
  })

  test('der Jugendschutz-Hinweis steht dort, wo man ihn sieht', async ({ page }) => {
    await page.goto('/jobs.html?alter=12')
    const hinweis = page.locator('#alter-filter-hinweis')
    await expect(hinweis).toBeVisible({ timeout: 20_000 })
    // Nicht in der Schublade: Sonst ist er beim Laden der Seite zu.
    expect(await hinweis.evaluate(el => Boolean(el.closest('#filter-panel')))).toBe(false)
    const imBild = await hinweis.evaluate(el => {
      const r = el.getBoundingClientRect()
      return r.left >= 0 && r.right <= innerWidth && r.width > 0
    })
    expect(imBild).toBe(true)
  })
})
