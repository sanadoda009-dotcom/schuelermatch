// Admin-Bereich, Reiter "Meldungen" (admin.html + js/admin.js).
// Session + Supabase gefälscht – keine echte DB.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, ADMIN, warteAufAdmin } = require('./helpers/supabase-fake')

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
  test('zeigt vier Reiter inkl. Meldungen', async ({ page }) => {
    await setupDashboard(page.context(), { user: ADMIN, db: adminDb() })
    await page.goto('/admin.html')
    await warteAufAdmin(page)
    await expect(page.locator('.admin-tab')).toHaveCount(4)
    await expect(page.locator('.admin-tab[data-tab="meldungen"]')).toBeVisible()
  })

  test('gemeldeter Job erscheint mit Zitat, Grund und Melder', async ({ page }) => {
    await setupDashboard(page.context(), { user: ADMIN, db: adminDb([MELDUNG_JOB]) })
    await page.goto('/admin.html')

    await warteAufAdmin(page)
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

    await warteAufAdmin(page)
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
    await warteAufAdmin(page)
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
    await warteAufAdmin(page)
    await page.locator('.admin-tab[data-tab="meldungen"]').click()

    const karte = page.locator('.meldung-card')
    await expect(karte).toContainText('Chat-Nachricht')
    await expect(karte).toContainText('Kontakt außerhalb')
    await expect(karte.locator('.meldung-zitat')).toContainText('WhatsApp')
  })
})

// ---------------------------------------------------------------------
// Gelöschte Konten (26.8.)
//
// `meldungen.melder_id` zeigte mit ON DELETE CASCADE auf `profiles`:
// Löschte ein Schüler, der jemanden gemeldet hatte, sein Konto, war die
// MELDUNG MIT WEG. Ein Schüler, der Belästigung meldet und danach aus
// Scham sein Konto löscht, nähme den Vorgang mit — genau den, gegen den
// der Betreiber ermitteln müsste.
//
// Bei der gemeldeten Person stand der Fremdschlüssel schon richtig auf
// SET NULL. Die Asymmetrie war die Lücke.
// supabase/meldungen-fk.sql stellt sie um.
//
// Danach kann `melder_id` NULL sein — die Karte muss das benennen statt
// ein vages „Unbekannt" zu zeigen.
test.describe('als Admin: Konto der beteiligten Person gelöscht', () => {
  async function karteMit(page, meldung) {
    await setupDashboard(page.context(), { user: ADMIN, db: adminDb([meldung]) })
    await page.goto('/admin.html')
    await warteAufAdmin(page)
    await page.locator('.admin-tab[data-tab="meldungen"]').click()
    return page.locator('.meldung-card')
  }

  test('die Meldung bleibt sichtbar, wenn der Melder gelöscht wurde', async ({ page }) => {
    // Der Kern: Der Vorgang darf nicht verschwinden.
    const karte = await karteMit(page, { ...MELDUNG_JOB, melder_id: null })
    await expect(karte).toHaveCount(1)
    await expect(karte.locator('.meldung-zitat')).toContainText('Kaution vorab')
    await expect(karte).toContainText('Betrug')
  })

  test('statt eines Namens steht „Konto gelöscht"', async ({ page }) => {
    const karte = await karteMit(page, { ...MELDUNG_JOB, melder_id: null })
    await expect(karte).toContainText('Konto gelöscht')
    await expect(karte, 'vages „Unbekannt" verschleiert den Grund')
      .not.toContainText('Unbekannt')
  })

  test('auch wenn die gemeldete Person gelöscht wurde', async ({ page }) => {
    const karte = await karteMit(page, { ...MELDUNG_JOB, gemeldet_user_id: null })
    await expect(karte).toHaveCount(1)
    await expect(karte).toContainText('Konto gelöscht')
    await expect(karte).toContainText('Lena')   // der Melder steht noch
  })

  test('und wenn beide Konten weg sind', async ({ page }) => {
    const karte = await karteMit(page, { ...MELDUNG_JOB, melder_id: null, gemeldet_user_id: null })
    await expect(karte).toHaveCount(1)
    await expect(karte.locator('.meldung-zitat')).toContainText('Kaution vorab')
    // Zweimal, einmal je Seite.
    expect((await karte.innerHTML()).match(/Konto gelöscht/g)).toHaveLength(2)
  })

  test('die Meldung lässt sich weiterhin auf erledigt setzen', async ({ page }) => {
    // Ein Vorgang ohne Melder muss trotzdem abschliessbar sein — sonst
    // bliebe er für immer im Reiter stehen.
    const db = adminDb([{ ...MELDUNG_JOB, melder_id: null }])
    await setupDashboard(page.context(), { user: ADMIN, db })
    await page.goto('/admin.html')
    await warteAufAdmin(page)
    await page.locator('.admin-tab[data-tab="meldungen"]').click()
    await page.locator('.meldung-card button', { hasText: /erledigt/i }).first().click()
    await expect.poll(() => db.meldungen[0].status).toBe('erledigt')
  })
})
