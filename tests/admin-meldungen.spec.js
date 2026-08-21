// Admin-Bereich, Reiter "Meldungen" (admin.html + js/admin.js).
// Session + Supabase gefälscht – keine echte DB.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, ADMIN } = require('./helpers/supabase-fake')

function adminDb(meldungen = []) {
  const db = defaultDb({
    profiles: [
      profilZeile(ADMIN, { ist_admin: true }),
      profilZeile(SCHUELER),
      profilZeile(FIRMA),
    ],
  })
  db.meldungen = meldungen
  return db
}

const MELDUNG_JOB = {
  id: 'meld-1',
  melder_id: SCHUELER.id,
  gemeldet_user_id: FIRMA.id,
  typ: 'job',
  job_id: 'aaaaaaaa-0000-4000-8000-000000000001',
  grund: 'betrug',
  beschreibung: 'Verlangt Vorkasse per Überweisung.',
  zitat: 'Service-Aushilfe im Café Sonnenschein\n\nBitte 50 € Kaution vorab überweisen.',
  status: 'offen',
  erstellt_am: '2026-08-20T10:00:00Z',
}

test('Nicht-Admins sehen den Bereich nicht', async ({ page }) => {
  const db = adminDb()
  await setupDashboard(page.context(), { user: SCHUELER, db }) // kein ist_admin
  await page.goto('/admin.html')
  await expect(page.locator('main')).toContainText('nur für Administratoren')
})

test.describe('als Admin', () => {
  test('zeigt drei Reiter inkl. Meldungen', async ({ page }) => {
    await setupDashboard(page.context(), { user: ADMIN, db: adminDb() })
    await page.goto('/admin.html')
    await expect(page.locator('.admin-tab')).toHaveCount(3)
    await expect(page.locator('.admin-tab[data-tab="meldungen"]')).toBeVisible()
  })

  test('gemeldeter Job erscheint mit Zitat, Grund und Melder', async ({ page }) => {
    await setupDashboard(page.context(), { user: ADMIN, db: adminDb([MELDUNG_JOB]) })
    await page.goto('/admin.html')

    await page.locator('.admin-tab[data-tab="meldungen"]').click()
    await expect(page.locator('#panel-meldungen')).toHaveClass(/active/)

    const karte = page.locator('.meldung-card')
    await expect(karte).toHaveCount(1)
    await expect(karte).toContainText('Job-Anzeige')
    await expect(karte).toContainText('Betrug')
    await expect(karte).toContainText('Lena')                  // Melder
    await expect(karte).toContainText('Eiscafé Dolce')          // Gemeldete Firma
    await expect(karte.locator('.meldung-zitat')).toContainText('Kaution vorab')
    await expect(karte).toContainText('Vorkasse')               // Anmerkung des Melders
    // Badge am Reiter zeigt die offene Meldung
    await expect(page.locator('#tab-badge-meldungen')).toHaveText('1')
  })

  test('„Erledigt" ändert den Status in der Datenbank', async ({ page }) => {
    const db = adminDb([{ ...MELDUNG_JOB }])
    await setupDashboard(page.context(), { user: ADMIN, db })
    await page.goto('/admin.html')

    await page.locator('.admin-tab[data-tab="meldungen"]').click()
    await page.locator('.meldung-card').getByRole('button', { name: /Erledigt/ }).click()

    await expect(page.locator('.toast')).toContainText('erledigt')
    await expect.poll(() => db.meldungen[0].status).toBe('erledigt')
  })

  test('Filter „Offen" blendet erledigte Meldungen aus', async ({ page }) => {
    const db = adminDb([
      { ...MELDUNG_JOB },
      { ...MELDUNG_JOB, id: 'meld-2', status: 'erledigt', zitat: 'Alte Sache' },
    ])
    await setupDashboard(page.context(), { user: ADMIN, db })
    await page.goto('/admin.html')
    await page.locator('.admin-tab[data-tab="meldungen"]').click()

    await expect(page.locator('.meldung-card')).toHaveCount(1)   // Standardfilter = offen
    await page.locator('#meldung-filter .pill', { hasText: 'Alle' }).click()
    await expect(page.locator('.meldung-card')).toHaveCount(2)
  })

  test('gemeldete Chat-Nachricht zeigt den Wortlaut', async ({ page }) => {
    const db = adminDb([{
      id: 'meld-3',
      melder_id: SCHUELER.id,
      gemeldet_user_id: FIRMA.id,
      typ: 'nachricht',
      nachricht_id: 'n-1',
      grund: 'kontaktdaten',
      zitat: 'Schreib mir privat auf WhatsApp: 0170...',
      status: 'offen',
      erstellt_am: '2026-08-21T10:00:00Z',
    }])
    await setupDashboard(page.context(), { user: ADMIN, db })
    await page.goto('/admin.html')
    await page.locator('.admin-tab[data-tab="meldungen"]').click()

    const karte = page.locator('.meldung-card')
    await expect(karte).toContainText('Chat-Nachricht')
    await expect(karte).toContainText('Kontakt außerhalb')
    await expect(karte.locator('.meldung-zitat')).toContainText('WhatsApp')
  })
})
