// Die Einstiege auf der Startseite.
//
// Anlass (25.8.): Nach vier neuen Seiten war die Startseite noch auf dem
// alten Stand – Job-Finder, Jobideen, Eltern- und Arbeitgeber-Seite waren
// dort nur kleine Textlinks. Der Vergleich mit studentjob.de zeigte das
// Prinzip: mehrere Einstiege nebeneinander, für verschiedene Absichten.
// Wer mit einer anderen Frage kommt, soll trotzdem seinen Weg finden.
const { test, expect, setupDashboard } = require('./helpers/supabase-fake')

test.beforeEach(async ({ page }) => {
  await setupDashboard(page.context(), {})
  await page.goto('/index.html')
  await page.waitForTimeout(900)
})

test('es gibt vier verschiedene Einstiege', async ({ page }) => {
  await expect(page.locator('.weg-karte')).toHaveCount(4)
})

test('jeder Einstieg führt zu seiner Seite', async ({ page }) => {
  const ziele = await page.evaluate(() =>
    [...document.querySelectorAll('.weg-karte')].map(a => a.getAttribute('href')))
  expect(ziele).toEqual(['job-finder.html', 'jobideen.html', 'jobs.html', 'eltern.html'])

  for (const ziel of ziele) {
    const antwort = await page.request.get(ziel)
    expect(antwort.status(), `${ziel} erreichbar`).toBeLessThan(400)
  }
})

test('der Einstieg für Unentschlossene steht an erster Stelle', async ({ page }) => {
  // Wer schon weiß, was er sucht, findet die Jobbörse ohnehin über das
  // Menü. Die Hilfe für alle anderen gehört nach vorn.
  const erste = page.locator('.weg-karte').first()
  await expect(erste).toHaveAttribute('href', 'job-finder.html')
  await expect(erste).toContainText(/weiß noch nicht/i)
})

test('der Weg vom Einstieg zum Test funktioniert wirklich', async ({ page }) => {
  await page.locator('.weg-karte').first().click()
  await expect(page).toHaveURL(/job-finder\.html/)
  await expect(page.locator('.finder-antwort').first()).toBeVisible({ timeout: 15_000 })
})

test('auf dem Weg zur Jobbörse geht nichts verloren', async ({ page }) => {
  await page.locator('.weg-karte[href="jobs.html"]').click()
  await expect(page).toHaveURL(/jobs\.html/)
  await expect(page.locator('#jobs-grid')).toBeVisible()
})
