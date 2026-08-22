// Neues Filter-Layout der Jobbörse: Filterspalte (Desktop) bzw. ausklappbares
// Panel (Handy), aktive Filter als entfernbare Chips, Sortierung getrennt.
const { test, expect } = require('./helpers/basis')

test.describe('Desktop-Layout', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('Filterspalte steht neben den Ergebnissen, Filter-Knopf ist ausgeblendet', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)

    await expect(page.locator('#filter-panel')).toBeVisible()
    await expect(page.locator('#filter-oeffnen')).toBeHidden()

    // Zwei Spalten: Filter links, Ergebnisse rechts
    const spalten = await page.locator('.jobs-layout').evaluate(el => getComputedStyle(el).gridTemplateColumns)
    expect(spalten.split(' ').length).toBe(2)

    // Filterspalte bleibt beim Scrollen stehen
    await expect(page.locator('#filter-panel')).toHaveCSS('position', 'sticky')
  })

  test('jeder Filter hat eine sichtbare Beschriftung', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.filter-gruppe label')).toHaveCount(4)
    for (const text of ['Ort', 'Dein Alter', 'Mindestlohn', 'Wann arbeiten?']) {
      await expect(page.locator('.filter-gruppe label', { hasText: text })).toBeVisible()
    }
  })

  test('Kategorie-Pills stehen in EINER Zeile (Wischleiste statt Umbruch)', async ({ page }) => {
    await page.goto('/jobs.html')
    const zeilen = await page.locator('#kategorie-pills').evaluate(el => {
      const tops = [...el.querySelectorAll('.pill')].map(p => Math.round(p.getBoundingClientRect().top))
      return new Set(tops).size
    })
    expect(zeilen).toBe(1)
  })

  test('Jobs beginnen deutlich weiter oben als vorher', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible()
    const oben = await page.locator('.job-card').first().evaluate(el => Math.round(el.getBoundingClientRect().top + scrollY))
    // Vor dem Umbau: 525px. Jetzt soll klar weniger Platz verbraucht werden.
    expect(oben).toBeLessThan(430)
  })
})

test.describe('Aktive Filter als Chips', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('gesetzte Filter erscheinen als Chips mit Zähler', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)
    await expect(page.locator('.filter-chip')).toHaveCount(0)

    await page.locator('#kategorie-pills .pill', { hasText: 'Nachhilfe' }).click()
    await page.locator('#filter-ort').fill('München')
    await page.locator('#filter-alter').selectOption('16')

    await expect(page.locator('.filter-chip')).toHaveCount(3)
    await expect(page.locator('.aktive-filter')).toContainText('Nachhilfe')
    await expect(page.locator('.aktive-filter')).toContainText('Ort: München')
    await expect(page.locator('.aktive-filter')).toContainText('16 Jahre')
    await expect(page.locator('#filter-anzahl')).toHaveText('3')
  })

  test('Chip entfernen setzt genau diesen Filter zurück', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)

    await page.locator('#filter-ort').fill('Augsburg')
    await page.locator('#filter-gehalt').selectOption('12')
    await expect(page.locator('.filter-chip')).toHaveCount(2)
    await expect(page.locator('.job-card')).toHaveCount(1)   // nur der Augsburger Job

    // Ort-Chip entfernen -> Ortsfilter weg, Lohnfilter bleibt
    await page.locator('.filter-chip', { hasText: 'Ort:' }).locator('button').click()
    await expect(page.locator('#filter-ort')).toHaveValue('')
    await expect(page.locator('.filter-chip')).toHaveCount(1)
    await expect(page.locator('#filter-gehalt')).toHaveValue('12')
  })

  test('„Alle Filter zurücksetzen" leert alles', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)

    await page.locator('#kategorie-pills .pill', { hasText: 'Verkauf' }).click()
    await page.locator('#filter-ort').fill('Augsburg')
    await expect(page.locator('.filter-chip')).toHaveCount(2)

    await page.locator('#filter-reset-alle').click()
    await expect(page.locator('.filter-chip')).toHaveCount(0)
    await expect(page.locator('.job-card')).toHaveCount(4)
    await expect(page.locator('#kategorie-pills .pill.active')).toHaveText('Alle')
  })
})

test.describe('Handy-Layout', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Filter stecken hinter einem Knopf und öffnen ein Panel', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)

    const knopf = page.locator('#filter-oeffnen')
    await expect(knopf).toBeVisible()
    await expect(knopf).toHaveAttribute('aria-expanded', 'false')

    // Panel ist zunächst aus dem Bild geschoben
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)

    await knopf.click()
    await expect(page.locator('#filter-panel')).toHaveClass(/offen/)
    await expect(knopf).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#filter-hintergrund')).toHaveClass(/offen/)

    await page.locator('#filter-schliessen').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)
  })

  test('Filtern im Panel wirkt und zeigt den Zähler am Knopf', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)

    await page.locator('#filter-oeffnen').click()
    await page.locator('#filter-ort').fill('Augsburg')
    await expect(page.locator('#filter-anzahl')).toHaveText('1')

    await page.locator('#filter-reset-alle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)   // schließt sich
    await expect(page.locator('.job-card')).toHaveCount(4)
  })

  test('Jobs starten mobil viel früher als vorher', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible()
    const oben = await page.locator('.job-card').first().evaluate(el => Math.round(el.getBoundingClientRect().top + scrollY))
    // Vor dem Umbau: 718px - fast ein ganzer Bildschirm nur Filter.
    // Jetzt rund 420px, also gut 40% weniger Vorlauf.
    expect(oben).toBeLessThan(450)
  })
})
