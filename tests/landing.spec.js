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

test('Dark-Mode-Umschalter wechselt Theme und merkt es sich', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.locator('#sm-theme-btn').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // Header-Logo wechselt auf die helle Variante
  await expect(page.locator('nav .logo img')).toHaveAttribute('src', /logo-light\.png/)

  // Nach Neuladen bleibt Dark Mode aktiv (localStorage)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('zentrale Links: Login, Registrieren, Jugendarbeitsschutz erreichbar', async ({ page }) => {
  await expect(page.locator('nav').getByRole('link', { name: 'Jetzt starten' })).toHaveAttribute('href', 'login.html')
  await expect(page.getByRole('link', { name: /Kostenlos registrieren/ }).first()).toHaveAttribute('href', 'register.html?rolle=schueler')

  await page.locator('footer').getByRole('link', { name: 'Jugendarbeitsschutz' }).click()
  await expect(page).toHaveURL(/jugendarbeitsschutz\.html/)
  await expect(page.locator('h1')).toContainText(/Jugendarbeitsschutz/i)
})
