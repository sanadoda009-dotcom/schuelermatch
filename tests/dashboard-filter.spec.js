// Jobs-Ansicht im Schüler-Dashboard: gleiches Filter-Layout wie die
// öffentliche Jobbörse (Filterspalte, Chips, Handy-Panel).
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, warteAufDashboard } = require('./helpers/supabase-fake')

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('Filterspalte steht neben den Jobs, Filter-Knopf ausgeblendet', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)

    await expect(page.locator('#filter-panel')).toBeVisible()
    await expect(page.locator('#filter-oeffnen')).toBeHidden()
    await expect(page.locator('#filter-panel')).toHaveCSS('position', 'sticky')

    const spalten = await page.locator('#view-jobs .jobs-layout').evaluate(el => getComputedStyle(el).gridTemplateColumns)
    expect(spalten.split(' ').length).toBe(2)
  })

  test('jeder Filter ist beschriftet', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)

    for (const text of ['Ort', 'Bereich', 'Mindestlohn', 'Wann arbeiten?']) {
      await expect(page.locator('#filter-panel label', { hasText: text }).first()).toBeVisible()
    }
  })

  test('Filter erscheinen als Chips und lassen sich einzeln entfernen', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)

    await page.locator('#filter-ort').fill('München')
    await page.locator('#filter-kategorie').selectOption('Nachhilfe')
    await expect(page.locator('.filter-chip')).toHaveCount(2)
    await expect(page.locator('#aktive-filter')).toContainText('Ort: München')
    await expect(page.locator('#aktive-filter')).toContainText('Nachhilfe')

    await page.locator('.filter-chip', { hasText: 'Ort:' }).locator('button').click()
    await expect(page.locator('#filter-ort')).toHaveValue('')
    await expect(page.locator('.filter-chip')).toHaveCount(1)
  })

  test('Merkliste-Filter erscheint ebenfalls als Chip', async ({ page }) => {
    const db = defaultDb({ profiles: [profilZeile(SCHUELER)] })
    db.gemerkte_jobs = [{ id: 'g1', schueler_id: SCHUELER.id, job_id: db.jobs[0].id }]
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)

    await page.locator('#merkliste-toggle').click()
    await expect(page.locator('.filter-chip')).toContainText('Nur Gemerkte')
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(1)

    await page.locator('.filter-chip', { hasText: 'Gemerkte' }).locator('button').click()
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)
    await expect(page.locator('#merkliste-toggle')).toHaveAttribute('aria-pressed', 'false')
  })

  test('„Alle Filter zurücksetzen" leert alles', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)

    await page.locator('#filter-ort').fill('Augsburg')
    await page.locator('#filter-gehalt').selectOption('12')
    await expect(page.locator('.filter-chip')).toHaveCount(2)

    await page.locator('#filter-reset-alle').click()
    await expect(page.locator('.filter-chip')).toHaveCount(0)
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)
  })
})

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Filter stecken hinter einem Knopf mit Zähler', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)

    const knopf = page.locator('#filter-oeffnen')
    await expect(knopf).toBeVisible()
    await knopf.click()
    await expect(page.locator('#filter-panel')).toHaveClass(/offen/)

    await page.locator('#filter-ort').fill('Augsburg')
    await expect(page.locator('#filter-anzahl')).toHaveText('1')

    await page.locator('#filter-schliessen').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(1)
  })
})
