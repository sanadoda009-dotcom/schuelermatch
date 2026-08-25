// Jobs-Ansicht im Schüler-Dashboard: gleiches Filter-Layout wie die
// öffentliche Jobbörse – Filter hinter einem Knopf, Chips über den Jobs.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, warteAufDashboard } = require('./helpers/supabase-fake')

async function oeffneDashboard(page, db) {
  await setupDashboard(page.context(), { user: SCHUELER, db })
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
  await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)
}

async function oeffneFilter(page) {
  await page.locator('#filter-oeffnen').click()
  await expect(page.locator('#filter-panel')).toHaveClass(/offen/)
}

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('Filter stecken hinter einem Knopf und öffnen ein Panel', async ({ page }) => {
    await oeffneDashboard(page)

    const knopf = page.locator('#filter-oeffnen')
    await expect(knopf).toBeVisible()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)

    await knopf.click()
    await expect(page.locator('#filter-panel')).toHaveClass(/offen/)

    await page.locator('#filter-schliessen').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)
  })

  test('jeder Filter ist beschriftet', async ({ page }) => {
    await oeffneDashboard(page)
    await oeffneFilter(page)

    for (const text of ['Ort', 'Bereich', 'Stundenlohn ab', 'Wann arbeiten?']) {
      await expect(page.locator('#filter-panel label', { hasText: text }).first()).toBeVisible()
    }
  })

  test('Filter erscheinen als Chips und lassen sich einzeln entfernen', async ({ page }) => {
    await oeffneDashboard(page)

    await oeffneFilter(page)
    await page.locator('#filter-ort').fill('München')
    await page.locator('#filter-kategorie').selectOption('Nachhilfe')
    await page.locator('#filter-schliessen').click()

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
    await oeffneDashboard(page, db)

    await oeffneFilter(page)
    await page.locator('#merkliste-toggle').click()
    await page.locator('#filter-schliessen').click()

    await expect(page.locator('.filter-chip')).toContainText('Nur Gemerkte')
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(1)

    await page.locator('.filter-chip', { hasText: 'Gemerkte' }).locator('button').click()
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)
    await expect(page.locator('#merkliste-toggle')).toHaveAttribute('aria-pressed', 'false')
  })

  test('„Alle Filter zurücksetzen" leert alles und schließt das Panel', async ({ page }) => {
    await oeffneDashboard(page)

    await oeffneFilter(page)
    await page.locator('#filter-ort').fill('Augsburg')
    await page.locator('#filter-gehalt').selectOption('12')
    await expect(page.locator('.filter-chip')).toHaveCount(2)

    await page.locator('#filter-reset-alle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)
    await expect(page.locator('.filter-chip')).toHaveCount(0)
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)
  })
})

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Panel fährt von unten ein, Zähler zeigt aktive Filter', async ({ page }) => {
    await oeffneDashboard(page)

    await oeffneFilter(page)
    await page.locator('#filter-ort').fill('Augsburg')
    await expect(page.locator('#filter-anzahl')).toHaveText('1')

    await page.locator('#filter-schliessen').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/offen/)
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(1)
  })
})
