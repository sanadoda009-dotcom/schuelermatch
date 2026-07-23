// Eingeloggtes Firmen-Dashboard (dashboard-firma.html + js/dashboard-firma.js).
// Session + Supabase gefälscht – keine echte DB, keine echten Jobs/Bewerber.
const { test, expect, setupDashboard, defaultDb, profilZeile, FIRMA, SCHUELER } = require('./helpers/supabase-fake')

// Off-Canvas-Sidebar: erst per Hamburger öffnen, dann Menüpunkt klicken.
async function navigate(page, view) {
  await page.locator('#sidebar-toggle').click()
  await page.locator(`.sidebar-item[data-view="${view}"]`).click()
}

// Zwei eigene Jobs der Test-Firma (firma_id = FIRMA.id, sonst tauchen sie nicht auf).
function eigeneJobs() {
  return [
    { id: 'job-firma-1', titel: 'Eisverkäufer/in (Sa/So)', beschreibung: 'Eis verkaufen.', ort: 'München', stundenlohn: 12, mindestalter: 15, kategorie: 'Verkauf', arbeitszeit: 'Wochenende', aktiv: true, aufrufe: 25, erstellt_am: '2026-07-15T10:00:00Z', firma_id: FIRMA.id },
    { id: 'job-firma-2', titel: 'Aushilfe Lager', beschreibung: 'Kartons sortieren.', ort: 'München', stundenlohn: 13, mindestalter: 16, kategorie: 'Sonstiges', arbeitszeit: 'Nachmittags', aktiv: false, aufrufe: 4, erstellt_am: '2026-07-01T10:00:00Z', firma_id: FIRMA.id },
  ]
}

test('ohne Session wird die Firma auf den Login umgeleitet', async ({ page }) => {
  await setupDashboard(page.context(), { user: null })
  await page.goto('/dashboard-firma.html')
  await expect(page).toHaveURL(/login\.html/)
})

test.describe('eingeloggt (freigegebene Firma)', () => {
  test('zeigt Name und startet im Job-Assistenten', async ({ page }) => {
    await setupDashboard(page.context(), { user: FIRMA })
    await page.goto('/dashboard-firma.html')
    await expect(page.locator('#user-name')).toHaveText('Eiscafé Dolce')
    await expect(page.locator('#view-posten')).toHaveClass(/active/)
    await expect(page.locator('#wizard-zaehler')).toContainText('Schritt 1 von 6')
    // Freigegebene Firma sieht kein Prüf-Banner
    await expect(page.locator('#firma-status-banner')).toBeHidden()
  })

  test('„Meine Jobs" listet eigene Jobs mit Statistik und Aufrufen', async ({ page }) => {
    const db = defaultDb({ profiles: [profilZeile(FIRMA)], jobs: eigeneJobs() })
    await setupDashboard(page.context(), { user: FIRMA, db })
    await page.goto('/dashboard-firma.html')

    await navigate(page, 'jobs')
    await expect(page.locator('#view-jobs')).toHaveClass(/active/)
    await expect(page.locator('#meine-jobs .job-card')).toHaveCount(2)
    await expect(page.locator('#stats-row')).toContainText('2')
    await expect(page.locator('#meine-jobs .job-card').first()).toContainText('25')          // Aufrufe
    // Pausierter Job trägt das Badge
    await expect(page.locator('#meine-jobs .job-card', { hasText: 'Aushilfe Lager' })).toContainText('Pausiert')
  })

  test('Bewerber erscheint unter dem Job mit Ampel und Annehmen/Ablehnen', async ({ page }) => {
    const db = defaultDb({
      profiles: [profilZeile(FIRMA), profilZeile(SCHUELER, { verifiziert: true, alter_jahre: 16, lebenslauf_bloecke: [{ typ: 'text', inhalt: 'Motiviert.' }] })],
      jobs: eigeneJobs(),
    })
    db.bewerbungen = [
      { id: 'bw-1', job_id: 'job-firma-1', schueler_id: SCHUELER.id, status: 'ausstehend', motivationsschreiben: 'Ich mag Eis.', erstellt_am: '2026-07-16T10:00:00Z' },
    ]
    await setupDashboard(page.context(), { user: FIRMA, db })
    await page.goto('/dashboard-firma.html')

    await navigate(page, 'jobs')
    const jobKarte = page.locator('#meine-jobs .job-card', { hasText: 'Eisverkäufer' })
    await expect(jobKarte.locator('.bewerber-item')).toHaveCount(1)
    await expect(jobKarte.locator('.bewerber-item')).toContainText('Lena')
    await expect(jobKarte.locator('.ampel')).toContainText('Top-Match') // verifiziert + Alter passt + CV
    await expect(jobKarte.getByRole('button', { name: 'Annehmen' })).toBeVisible()
    await expect(jobKarte.getByRole('button', { name: 'Ablehnen' })).toBeVisible()
  })

  test('Annehmen setzt den Bewerbungsstatus in der DB auf „angenommen"', async ({ page }) => {
    const db = defaultDb({
      profiles: [profilZeile(FIRMA), profilZeile(SCHUELER, { verifiziert: true })],
      jobs: eigeneJobs(),
    })
    db.bewerbungen = [
      { id: 'bw-1', job_id: 'job-firma-1', schueler_id: SCHUELER.id, status: 'ausstehend', erstellt_am: '2026-07-16T10:00:00Z' },
    ]
    await setupDashboard(page.context(), { user: FIRMA, db })
    await page.goto('/dashboard-firma.html')

    await navigate(page, 'jobs')
    await page.locator('#meine-jobs .job-card', { hasText: 'Eisverkäufer' })
      .getByRole('button', { name: 'Annehmen' }).click()

    await expect.poll(() => db.bewerbungen[0].status).toBe('angenommen')
  })
})

test.describe('neue (nicht freigegebene) Firma', () => {
  test('sieht das „wird geprüft"-Banner', async ({ page }) => {
    const db = defaultDb({ profiles: [profilZeile(FIRMA, { firma_status: 'neu' })], jobs: eigeneJobs() })
    await setupDashboard(page.context(), { user: FIRMA, db })
    await page.goto('/dashboard-firma.html')
    await expect(page.locator('#firma-status-banner')).toBeVisible()
    await expect(page.locator('#firma-status-banner')).toContainText('wird geprüft')
  })
})

test.describe('Job posten', () => {
  test('Vorlage + Assistent durchlaufen und veröffentlichen legt Job in der DB an', async ({ page }) => {
    const db = defaultDb({ profiles: [profilZeile(FIRMA)], jobs: [] })
    await setupDashboard(page.context(), { user: FIRMA, db })
    await page.goto('/dashboard-firma.html')

    // Vorlage füllt Titel/Beschreibung/Kategorie und springt zu Schritt 3 (Ort/Lohn)
    await page.locator('[data-jobvorlage="eisverkauf"]').click()
    await expect(page.locator('#job-titel')).toHaveValue(/Eisverkäufer/)

    // Ort + Lohn ergänzen
    await page.locator('#job-ort').fill('München')
    await page.locator('#job-lohn').fill('12')

    // Bis zum letzten Schritt durchblättern und veröffentlichen
    await page.locator('#wizard-weiter').click() // 3 -> 4
    await page.locator('#wizard-weiter').click() // 4 -> 5
    await page.locator('#wizard-weiter').click() // 5 -> 6 (Zusammenfassung)
    await expect(page.locator('#wizard-posten')).toBeVisible()
    await page.locator('#wizard-posten').click()

    await expect.poll(() => db.jobs.length).toBe(1)
    expect(db.jobs[0]).toMatchObject({ titel: expect.stringContaining('Eisverkäufer'), ort: 'München', firma_id: FIRMA.id })
    await expect(page.locator('.toast', { hasText: 'veröffentlicht' })).toBeVisible()
  })
})
