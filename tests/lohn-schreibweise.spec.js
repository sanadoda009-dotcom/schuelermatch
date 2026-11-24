// Der Lohn in deutscher Schreibweise (23.11.2026)
//
// Befund: Aus 13.5 wurde auf der Jobboerse und in der Anzeige "13.5 €/Std" -
// mit Punkt und ohne zweite Nachkommastelle. Fiel beim Aufnehmen des
// Werbespots auf. Jetzt laeuft jede Anzeige des Lohns ueber lohnText().
const { test, expect, setupDashboard, defaultDb } = require('./helpers/supabase-fake')

function db() {
  const d = defaultDb()
  d.jobs[0].stundenlohn = 13.5
  d.jobs[1].stundenlohn = 16
  return d
}

test('Jobboerse: Komma und zwei Stellen, ganze Betraege bleiben ganz', async ({ page }) => {
  await setupDashboard(page.context(), { db: db() })
  await page.goto('/jobs.html')
  const karten = page.locator('.job-card')
  await expect(karten.first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('#jobs-container, main').first()).toContainText('13,50 €/Std')
  await expect(page.locator('#jobs-container, main').first()).toContainText('16 €/Std')
  await expect(page.locator('main')).not.toContainText('13.5 €')
})

test('Anzeige: auch die Eckdaten', async ({ page }) => {
  const d = db()
  await setupDashboard(page.context(), { db: d })
  await page.goto(`/job.html?id=${d.jobs[0].id}`)
  await expect(page.locator('.job-eckdaten')).toContainText('13,50 €/Std', { timeout: 20_000 })
})

test('lohnText selbst', async ({ page }) => {
  // job-karte.js ist ein Browser-Modul, deshalb im Browser pruefen.
  await setupDashboard(page.context(), {})
  await page.goto('/jobs.html')
  const werte = await page.evaluate(async () => {
    const m = await import('/js/job-karte.js')
    return [m.lohnText(13.5), m.lohnText(14), m.lohnText('12.25'), m.lohnText(9.9)]
  })
  expect(werte).toEqual(['13,50', '14', '12,25', '9,90'])
})
