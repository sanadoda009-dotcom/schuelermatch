// Job posten mit drei Fragen und Live-Vorschau, Firmenprofil mit Stand (24.11.2026)
//
// Festgehalten wird: Aus den drei Antworten wird EIN gegliederter Text in
// `jobs.beschreibung`; alte Anzeigen ohne Gliederung gehen beim Bearbeiten
// nicht verloren; die Vorschau ist dieselbe Karte wie in der Jobbörse.
const { test, expect, setupDashboard, defaultDb, profilZeile, FIRMA } = require('./helpers/supabase-fake')

async function posten(page, db = defaultDb({ profiles: [profilZeile(FIRMA)], jobs: [] })) {
  await setupDashboard(page.context(), { user: FIRMA, db })
  await page.goto('/dashboard-firma.html')
  await expect(page.locator('#pv-karte .job-card')).toBeVisible({ timeout: 20_000 })
  return db
}

test('die Vorschau zeigt sofort eine echte Jobkarte und folgt der Eingabe', async ({ page }) => {
  await posten(page)
  await expect(page.locator('#pv-karte .job-card h3')).toHaveText('Dein Job-Titel')
  await page.locator('#job-titel').fill('Aushilfe im Hofladen')
  await expect(page.locator('#pv-karte .job-card h3')).toHaveText('Aushilfe im Hofladen')
  await expect(page.locator('#pv-karte .job-card')).toContainText(FIRMA.name)
})

test('eine Vorlage füllt die drei Fragen, die Vorschau gliedert sie', async ({ page }) => {
  await posten(page)
  await page.locator('[data-jobvorlage="eisverkauf"]').click()
  await expect(page.locator('#job-f-aufgaben')).toHaveValue(/Eis portionieren/)
  await expect(page.locator('#job-f-mitbringen')).not.toHaveValue('')
  await expect(page.locator('#job-f-bieten')).not.toHaveValue('')
  await expect(page.locator('#pv-details h3')).toHaveText(['Das machst du', 'Das bringst du mit', 'Das bieten wir'])
  // Auf der Karte steht nur der erste Abschnitt, ohne Überschrift
  await expect(page.locator('#pv-karte .job-description')).toContainText('Eis portionieren')
  await expect(page.locator('#pv-karte .job-description')).not.toContainText('Das machst du')
})

test('veröffentlicht wird ein Text mit Zwischenüberschriften', async ({ page }) => {
  const db = await posten(page)
  await page.locator('#job-titel').fill('Aushilfe im Hofladen')
  await page.locator('[data-wz-schritt="3"]').click()
  await page.locator('#job-ort').fill('München')
  await page.locator('[data-wz-schritt="5"]').click()
  await page.locator('#job-f-aufgaben').fill('Obst sortieren\nKunden bedienen')
  await page.locator('#job-f-bieten').fill('Ein freundliches Team')
  await page.locator('[data-wz-schritt="6"]').click()
  await page.locator('#wizard-posten').click()
  await expect.poll(() => db.jobs.length).toBe(1)
  expect(db.jobs[0].beschreibung).toBe('Das machst du:\nObst sortieren\nKunden bedienen\n\nDas bieten wir:\nEin freundliches Team')
})

test('die Schritte haben Namen und zeigen, wo man ist', async ({ page }) => {
  await posten(page)
  await expect(page.locator('[data-wz-schritt="1"]')).toHaveAttribute('aria-current', 'step')
  await page.locator('[data-wz-schritt="4"]').click()
  await expect(page.locator('#wizard-zaehler')).toContainText('Schritt 4 von 6')
  await expect(page.locator('[data-wz-schritt="4"]')).toHaveAttribute('aria-current', 'step')
  await expect(page.locator('[data-wz-schritt="2"]')).toHaveClass(/fertig/)
})

test('keine Emojis mehr bei den Vorlagen und am Knopf', async ({ page }) => {
  await posten(page)
  await expect(page.locator('#view-posten')).not.toContainText(/[🍦📚🧸🌿🛒📰🐕🚀]/u)
})

test.describe('Bearbeiten', () => {
  function dbMit(beschreibung) {
    return defaultDb({ profiles: [profilZeile(FIRMA)], jobs: [{
      id: 'e1', firma_id: FIRMA.id, titel: 'Eisverkauf', ort: 'München', lat: 48.1, lon: 11.5, mindestalter: 15,
      aktiv: true, aufrufe: 1, erstellt_am: '2026-11-20T10:00:00Z', beschreibung }] })
  }
  async function bearbeite(page, db) {
    await setupDashboard(page.context(), { user: FIRMA, db })
    await page.goto('/dashboard-firma.html?ansicht=jobs')
    await page.locator('[data-edit="e1"]').click({ timeout: 20_000 })
  }

  test('ein gegliederter Text kommt zurück in die drei Felder', async ({ page }) => {
    await bearbeite(page, dbMit('Das machst du:\nEis verkaufen\n\nDas bringst du mit:\nLaune\n\nDas bieten wir:\nEis'))
    await expect(page.locator('#job-f-aufgaben')).toHaveValue('Eis verkaufen')
    await expect(page.locator('#job-f-mitbringen')).toHaveValue('Laune')
    await expect(page.locator('#job-f-bieten')).toHaveValue('Eis')
  })

  test('eine alte Anzeige ohne Gliederung verliert nichts', async ({ page }) => {
    await bearbeite(page, dbMit('Eis verkaufen, kassieren.\nWir zeigen dir alles.'))
    await expect(page.locator('#job-f-aufgaben')).toHaveValue('Eis verkaufen, kassieren.\nWir zeigen dir alles.')
    await expect(page.locator('#job-f-mitbringen')).toHaveValue('')
  })
})

test('auf der Anzeigenseite stehen die Abschnitte als Überschriften', async ({ page }) => {
  const db = defaultDb()
  db.jobs[0].beschreibung = 'Das machst du:\nEis verkaufen\nKassieren\n\nDas bieten wir:\nGute Laune'
  await setupDashboard(page.context(), { db })
  await page.goto(`/job.html?id=${db.jobs[0].id}`)
  await expect(page.locator('.job-abschnitt h3')).toHaveText(['Das machst du', 'Das bieten wir'], { timeout: 20_000 })
  await expect(page.locator('.job-abschnitt').first().locator('li')).toHaveCount(2)
})

test.describe('Firmenprofil', () => {
  test('sagt, was noch fehlt', async ({ page }) => {
    await setupDashboard(page.context(), { user: FIRMA, db: defaultDb({ profiles: [profilZeile(FIRMA, { ort: 'München' })] }) })
    await page.goto('/dashboard-firma.html?ansicht=profil')
    await expect(page.locator('#profil-stand-zahl')).toHaveText('2 von 4', { timeout: 20_000 })
    await expect(page.locator('#profil-stand-liste li.fertig')).toHaveText(['Name geprüft', 'Standort'])
    await expect(page.locator('#profil-oeffentlich')).toHaveAttribute('href', `firma.html?id=${encodeURIComponent(FIRMA.id)}`)
  })

  test('nach dem Speichern zählt „Wer ihr seid“ mit', async ({ page }) => {
    await setupDashboard(page.context(), { user: FIRMA, db: defaultDb({ profiles: [profilZeile(FIRMA, { ort: 'München' })] }) })
    await page.goto('/dashboard-firma.html?ansicht=profil')
    await expect(page.locator('#profil-stand-zahl')).toHaveText('2 von 4', { timeout: 20_000 })
    await page.locator('#profile-ueber-uns').fill('Familienbetrieb seit 1998.')
    await page.locator('#profile-form button[type=submit]').click()
    await expect(page.locator('#profil-stand-zahl')).toHaveText('3 von 4')
  })

  test('eine neue Firma sieht noch keinen Link zur öffentlichen Seite', async ({ page }) => {
    await setupDashboard(page.context(), { user: FIRMA, db: defaultDb({ profiles: [profilZeile(FIRMA, { firma_status: 'neu' })] }) })
    await page.goto('/dashboard-firma.html?ansicht=profil')
    await expect(page.locator('#profil-stand-zahl')).toHaveText('0 von 4', { timeout: 20_000 })
    await expect(page.locator('#profil-oeffentlich')).toBeHidden()
  })
})
