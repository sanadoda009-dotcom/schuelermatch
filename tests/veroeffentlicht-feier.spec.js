// Der "Match-Moment" nach dem Veroeffentlichen (24.11.2026, js/feier.js)
//
// Vorher: ein schwarzer Hinweis oben rechts, nach drei Sekunden weg.
// Festgehalten wird: Nach einer NEUEN Anzeige erscheint ein Dialog mit
// Logo und Titel, der ehrlich sagt, ob die Anzeige schon online ist; er
// ist mit Tastatur bedienbar; beim Bearbeiten bleibt es beim Hinweis.
const { test, expect, setupDashboard, defaultDb, profilZeile, FIRMA } = require('./helpers/supabase-fake')

async function veroeffentliche(page, firma = {}) {
  const db = defaultDb({ profiles: [profilZeile(FIRMA, firma)], jobs: [] })
  await setupDashboard(page.context(), { user: FIRMA, db })
  await page.goto('/dashboard-firma.html')
  await page.locator('[data-jobvorlage="eisverkauf"]').click({ timeout: 20_000 })
  await page.locator('#job-ort').fill('München')
  await page.locator('[data-wz-schritt="6"]').click()
  await page.locator('#wizard-posten').click()
  await expect.poll(() => db.jobs.length).toBe(1)
  return db
}

test('nach dem Posten kommt der Match-Moment mit Logo und Titel', async ({ page }) => {
  await veroeffentliche(page)
  const feier = page.locator('#feier')
  await expect(feier).toBeVisible()
  await expect(feier).toHaveAttribute('role', 'dialog')
  await expect(feier.locator('h2')).toHaveText('Deine Anzeige ist online!')
  await expect(feier).toContainText('Eisverkäufer/in (Sa/So)')
  await expect(feier.locator('.feier-logo img')).toHaveAttribute('src', 'assets/favicon.png')
  // Der Fokus steht auf dem Hauptknopf
  await expect(feier.locator('.feier-haupt')).toBeFocused()
})

test('eine noch nicht freigegebene Firma liest, dass die Anzeige noch nicht online ist', async ({ page }) => {
  await veroeffentliche(page, { firma_status: 'neu' })
  await expect(page.locator('#feier h2')).toHaveText('Anzeige gespeichert')
  await expect(page.locator('#feier')).not.toContainText('ist online')
  await expect(page.locator('#feier')).toContainText('freigeschaltet')
})

test('"Zu meinen Anzeigen" schließt und zeigt die Liste', async ({ page }) => {
  await veroeffentliche(page)
  await page.locator('#feier .feier-haupt').click()
  await expect(page.locator('#feier')).toHaveCount(0)
  await expect(page.locator('#view-jobs')).toHaveClass(/active/)
})

test('"Noch einen Job posten" führt zurück zum Assistenten', async ({ page }) => {
  await veroeffentliche(page)
  await page.locator('#feier .feier-noch').click()
  await expect(page.locator('#feier')).toHaveCount(0)
  await expect(page.locator('#view-posten')).toHaveClass(/active/)
  await expect(page.locator('#wizard-zaehler')).toContainText('Schritt 1 von 6')
})

test('Escape schließt den Dialog', async ({ page }) => {
  await veroeffentliche(page)
  await expect(page.locator('#feier')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#feier')).toHaveCount(0)
})

test('mit "weniger Bewegung" steht sofort das fertige Bild da', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await veroeffentliche(page)
  const name = await page.locator('#feier .feier-logo').evaluate(el => getComputedStyle(el).animationName)
  expect(name).toBe('none')
  await expect(page.locator('#feier .feier-logo')).toBeVisible()
})

test('beim Bearbeiten bleibt es beim kurzen Hinweis', async ({ page }) => {
  const db = defaultDb({ profiles: [profilZeile(FIRMA)], jobs: [{
    id: 'e1', firma_id: FIRMA.id, titel: 'Eisverkauf', ort: 'München', lat: 48.1, lon: 11.5, mindestalter: 15,
    aktiv: true, aufrufe: 1, erstellt_am: '2026-11-20T10:00:00Z', beschreibung: 'x' }] })
  await setupDashboard(page.context(), { user: FIRMA, db })
  await page.goto('/dashboard-firma.html?ansicht=jobs')
  await page.locator('[data-edit="e1"]').click({ timeout: 20_000 })
  await page.locator('[data-wz-schritt="6"]').click()
  await page.locator('#wizard-posten').click()
  await expect(page.locator('.toast', { hasText: 'aktualisiert' })).toBeVisible()
  await expect(page.locator('#feier')).toHaveCount(0)
})
