// Landingpage (index.html): Hero-Suche, Kategorie-Kacheln, Job-Vorschau,
// FAQ-Accordion, Dark-Mode-Umschalter, wichtigste Navigations-Links.
const { test, expect } = require('./helpers/basis')

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html')
})

test('Hero-Suche führt mit Suchbegriff zur Jobbörse', async ({ page }) => {
  await page.locator('.search-hero input[name="q"]').fill('nachhilfe')
  await page.locator('.search-hero input[name="q"]').press('Enter')
  await expect(page).toHaveURL(/jobs\.html\?q=nachhilfe/)
  await expect(page.locator('#filter-suche')).toHaveValue('nachhilfe')
  await expect(page.locator('.job-card')).toHaveCount(1)
})

test('Kategorie-Kachel verlinkt vorgefiltert in die Jobbörse', async ({ page }) => {
  await page.locator('.kat-tile', { hasText: 'Tierbetreuung' }).click()
  await expect(page).toHaveURL(/kategorie=Tierbetreuung/)
  await expect(page.locator('#kategorie-pills .pill.active')).toHaveText('Tierbetreuung')
  await expect(page.locator('.job-card')).toHaveCount(1)
})

test('Job-Vorschau auf der Startseite zeigt gemockte Jobs', async ({ page }) => {
  await expect(page.locator('#preview-jobs-grid .job-card').first()).toBeVisible()
})

test('FAQ öffnet und schließt mit korrektem aria-expanded', async ({ page }) => {
  const frage = page.locator('.faq-question').first()
  await frage.scrollIntoViewIfNeeded()
  await expect(frage).toHaveAttribute('aria-expanded', 'false')
  await frage.click()
  await expect(frage).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.faq-item').first()).toHaveClass(/open/)

  // Zweite Frage öffnen schließt die erste (Accordion-Verhalten)
  await page.locator('.faq-question').nth(1).click()
  await expect(frage).toHaveAttribute('aria-expanded', 'false')
})

test('es gibt keinen Hell/Dunkel-Umschalter mehr (nur heller Modus)', async ({ page }) => {
  await expect(page.locator('#sm-theme-btn')).toHaveCount(0)
  await expect(page.locator('.theme-toggle')).toHaveCount(0)
  // Kein dunkles Theme mehr gesetzt
  const theme = await page.locator('html').getAttribute('data-theme')
  expect(theme === null || theme === 'light').toBe(true)
  // Heller Hintergrund
  const bg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)
  expect(bg).not.toBe('rgb(15, 18, 22)')
})

test('zentrale Links: Login, Registrieren, Jugendarbeitsschutz erreichbar', async ({ page }) => {
  await expect(page.locator('nav').getByRole('link', { name: 'Jetzt starten' })).toHaveAttribute('href', 'login.html')
  await expect(page.getByRole('link', { name: /Kostenlos registrieren/ }).first()).toHaveAttribute('href', 'register.html?rolle=schueler')

  await page.locator('footer').getByRole('link', { name: 'Jugendarbeitsschutz' }).click()
  await expect(page).toHaveURL(/jugendarbeitsschutz\.html/)
  await expect(page.locator('h1')).toContainText(/Jugendarbeitsschutz/i)
})
