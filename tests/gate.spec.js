// Zugangssperre (js/gate.js): Overlay erscheint, falsches Passwort wird
// abgewiesen, richtiges Passwort schaltet frei und merkt sich das pro Session.
// Diese Tests nutzen bewusst NICHT den Gate-Bypass der gemeinsamen Basis.
const { test: basisTest, expect } = require('@playwright/test')
const { standardAntworten, installiereSupabaseMock } = require('./helpers/basis')

const test = basisTest.extend({
  context: async ({ context }, use) => {
    await installiereSupabaseMock(context, standardAntworten())
    await use(context)
  },
})

const GATE_PASSWORT = 'schuelermatch2026'

test('Gate blockiert die Seite ohne Passwort', async ({ page }) => {
  await page.goto('/jobs.html')
  await expect(page.locator('#sm-gate')).toBeVisible()
  await expect(page.locator('#sm-gate')).toContainText('im Aufbau')
  // Seiteninhalt ist unsichtbar, solange das Gate steht
  await expect(page.locator('body')).toHaveCSS('visibility', 'hidden')
})

test('Falsches Passwort zeigt Fehlermeldung', async ({ page }) => {
  await page.goto('/jobs.html')
  await page.locator('#sm-gate-pw').fill('falsch123')
  await page.locator('#sm-gate-btn').click()
  await expect(page.locator('#sm-gate-err')).toHaveText('Falsches Passwort.')
  await expect(page.locator('#sm-gate')).toBeVisible()
})

test('Richtiges Passwort schaltet frei (auch per Enter) und hält die Session', async ({ page }) => {
  await page.goto('/jobs.html')
  await page.locator('#sm-gate-pw').fill(GATE_PASSWORT)
  await page.locator('#sm-gate-pw').press('Enter')
  await expect(page.locator('#sm-gate')).toHaveCount(0)
  await expect(page.locator('h1')).toContainText('Minijobs für Schüler')

  // Navigiert man weiter, bleibt die Freischaltung bestehen (sessionStorage)
  await page.goto('/index.html')
  await expect(page.locator('#sm-gate')).toHaveCount(0)
})
