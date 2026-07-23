// Mobile Checks (läuft nur im Projekt „mobil", Pixel-7-Viewport):
// Hamburger-Menü, Jobbörse benutzbar, Bewerbungs-CTA sichtbar.
const { test, expect } = require('./helpers/basis')

test('Hamburger-Menü öffnet und schließt die Navigation', async ({ page }) => {
  await page.goto('/jobs.html')
  const toggle = page.locator('.nav-toggle')
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.nav-links')).toHaveClass(/open/)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
})

test('Jobbörse ist mobil voll benutzbar (Filter + Detail-Modal)', async ({ page }) => {
  await page.goto('/jobs.html')
  await expect(page.locator('.job-card')).toHaveCount(4)

  await page.locator('#filter-suche').fill('gassi')
  await expect(page.locator('.job-card')).toHaveCount(1)

  await page.locator('.job-card').click()
  await expect(page.locator('#job-detail-overlay')).toHaveClass(/open/)
  await expect(page.locator('#detail-titel')).toBeVisible()
})

test('Registrierung: Formular mobil erreichbar, CTA sichtbar', async ({ page }) => {
  await page.goto('/register.html')
  await expect(page.getByRole('button', { name: 'Account erstellen' })).toBeVisible()
  await expect(page.locator('#tab-firma')).toBeVisible()
})
