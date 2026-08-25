// Filter-Layout der Jobbörse: Die Filter stecken hinter einem Knopf und öffnen
// ein Panel – auf jedem Gerät. Aktive Filter erscheinen als entfernbare Chips.
const { test, expect } = require('./helpers/basis')

// Filter setzen heißt: Panel öffnen, Werte eintragen.
async function oeffneFilter(page) {
  await page.locator('#filter-oeffnen').click()
  await expect(page.locator('#filter-panel')).toHaveClass(/offen/)
}

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('Filter stecken hinter einem Knopf und öffnen ein Panel', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)

    const knopf = page.locator('#filter-oeffnen')
    await expect(knopf).toBeVisible()
    await expect(knopf).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)

    await knopf.click()
    await expect(page.locator('#filter-panel')).toHaveClass(/offen/)
    await expect(knopf).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#filter-hintergrund')).toHaveClass(/offen/)

    await page.locator('#filter-schliessen').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)
  })

  test('Klick daneben und Escape schließen das Panel ebenfalls', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)

    await oeffneFilter(page)
    // Rechts danebenklicken – das Panel selbst liegt links am Rand
    await page.mouse.click(1000, 400)
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)

    await oeffneFilter(page)
    await page.keyboard.press('Escape')
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)
  })

  test('jeder Filter im Panel hat eine sichtbare Beschriftung', async ({ page }) => {
    await page.goto('/jobs.html')
    await oeffneFilter(page)

    await expect(page.locator('.filter-gruppe label')).toHaveCount(4)
    for (const text of ['Ort', 'Dein Alter', 'Stundenlohn ab', 'Wann arbeiten?']) {
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
    // Vor dem Umbau: 525px. Ohne Filterblock davor deutlich weniger.
    expect(oben).toBeLessThan(400)
  })
})

test.describe('Aktive Filter als Chips', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('gesetzte Filter erscheinen als Chips mit Zähler', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)
    await expect(page.locator('.filter-chip')).toHaveCount(0)

    await page.locator('#kategorie-pills .pill', { hasText: 'Nachhilfe' }).click()
    await oeffneFilter(page)
    await page.locator('#filter-ort').fill('München')
    await page.locator('#filter-alter').selectOption('16')

    await expect(page.locator('.filter-chip')).toHaveCount(3)
    await expect(page.locator('.aktive-filter')).toContainText('Nachhilfe')
    await expect(page.locator('.aktive-filter')).toContainText('Ort: München')
    await expect(page.locator('.aktive-filter')).toContainText('16 Jahre')
    await expect(page.locator('#filter-anzahl')).toHaveText('3')
  })

  test('Chips bleiben sichtbar, wenn das Panel wieder zu ist', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)

    await oeffneFilter(page)
    await page.locator('#filter-ort').fill('Augsburg')
    await page.locator('#filter-schliessen').click()

    // Auch bei geschlossenem Panel sieht man, wonach gefiltert wird
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)
    await expect(page.locator('.filter-chip')).toHaveCount(1)
    await expect(page.locator('.aktive-filter')).toContainText('Ort: Augsburg')
  })

  test('Chip entfernen setzt genau diesen Filter zurück', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)

    await oeffneFilter(page)
    await page.locator('#filter-ort').fill('Augsburg')
    await page.locator('#filter-gehalt').selectOption('12')
    await page.locator('#filter-schliessen').click()
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
    await oeffneFilter(page)
    await page.locator('#filter-ort').fill('Augsburg')
    await expect(page.locator('.filter-chip')).toHaveCount(2)

    await page.locator('#filter-reset-alle').click()
    await expect(page.locator('.filter-chip')).toHaveCount(0)
    await expect(page.locator('.job-card')).toHaveCount(4)
    await expect(page.locator('#kategorie-pills .pill.active')).toHaveText('Alle')
  })
})

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Panel fährt von unten ein und filtert', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card')).toHaveCount(4)

    await oeffneFilter(page)
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
    // Jetzt rund 440px, also gut ein Drittel weniger Vorlauf.
    expect(oben).toBeLessThan(470)
  })
})
