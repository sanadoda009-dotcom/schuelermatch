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

    // Umgebaut am 2.9.2026: Die Bewerber standen INNERHALB der
    // Anzeigenliste, die Ansicht hiess "Meine Jobs & Bewerber". Zwei
    // Aufgaben in einer Ansicht - mit mehreren Anzeigen eine Wand. Jetzt
    // haben sie eine eigene Ansicht, nach Anzeige gruppiert.
    await navigate(page, 'jobs')
    await expect(page.locator('#meine-jobs .job-card', { hasText: 'Eisverkäufer' }))
      .toContainText('1 Bewerbung ansehen')

    await navigate(page, 'bewerbungen')
    const gruppe = page.locator('.bew-gruppe', { hasText: 'Eisverkäufer' })
    await expect(gruppe.locator('.bewerber-item')).toHaveCount(1)
    await expect(gruppe.locator('.bewerber-item')).toContainText('Lena')
    await expect(gruppe.locator('.ampel')).toContainText('Top-Match') // verifiziert + Alter passt + CV
    await expect(gruppe.getByRole('button', { name: 'Annehmen' })).toBeVisible()
    await expect(gruppe.getByRole('button', { name: 'Ablehnen' })).toBeVisible()
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

    await navigate(page, 'bewerbungen')
    await page.locator('.bew-gruppe', { hasText: 'Eisverkäufer' })
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

// ---------------------------------------------------------------------
// Jugendarbeitsschutz im Anzeigenformular (26.8.)
//
// Das Formular bot als Mindestalter 10, 11 und 12 an, und geprüft wurde
// der Wert nirgends — eine Anzeige „ab 10 Jahren" ging sofort live.
// Nach § 5 JArbSchG ist Arbeiten unter 13 nicht erlaubt. Die Regeln
// stehen jetzt in js/jugendschutz.js, verbindlich wird die Grenze mit
// supabase/mindestalter-grenze.sql in der Datenbank.
test.describe('Mindestalter im Anzeigenformular', () => {
  // Die Alterswahl steht auf Schritt 4 des Assistenten. Die Vorlage
  // springt auf Schritt 3, von dort ein Klick weiter.
  async function zurAlterswahl(page, db) {
    await setupDashboard(page.context(), { user: FIRMA, db: db || defaultDb({ profiles: [profilZeile(FIRMA)], jobs: [] }) })
    await page.goto('/dashboard-firma.html')
    await page.locator('[data-jobvorlage="eisverkauf"]').click()
    await page.locator('#job-ort').fill('München')
    await page.locator('#job-lohn').fill('12')
    await page.locator('#wizard-weiter').click()          // 3 -> 4
    await expect(page.locator('#job-mindestalter')).toBeVisible()
  }

  test('unter 13 steht gar nicht zur Wahl', async ({ page }) => {
    await setupDashboard(page.context(), { user: FIRMA, db: defaultDb({ profiles: [profilZeile(FIRMA)], jobs: [] }) })
    await page.goto('/dashboard-firma.html')

    const werte = await page.locator('#job-mindestalter option').evaluateAll(
      opts => opts.map(o => Number(o.value)))
    expect(Math.min(...werte), 'niedrigste Wahlmöglichkeit').toBe(13)
    expect(werte).not.toContain(12)
  })

  test('bei 13 erscheint der Hinweis auf die engen Grenzen', async ({ page }) => {
    // Die wenigsten Arbeitgeber wissen, was für 13-Jährige gilt — und im
    // ganzen Ablauf stand es bisher nirgends.
    await zurAlterswahl(page)
    await page.locator('#job-mindestalter').selectOption('13')
    const hinweis = page.locator('#alter-hinweis')
    await expect(hinweis).toBeVisible()
    await expect(hinweis).toContainText('2 Stunden')
    await expect(hinweis).toContainText('Eltern')
  })

  test('bei 18 verschwindet der Hinweis wieder', async ({ page }) => {
    await zurAlterswahl(page)
    await page.locator('#job-mindestalter').selectOption('13')
    await expect(page.locator('#alter-hinweis')).toBeVisible()
    await page.locator('#job-mindestalter').selectOption('18')
    await expect(page.locator('#alter-hinweis')).toBeHidden()
  })

  test('ein von aussen gesetztes Alter unter 13 wird beim Absenden abgefangen', async ({ page }) => {
    // Die Auswahlliste ist kein Schutz: Wer die Seite manipuliert oder
    // die API direkt anspricht, umgeht sie. Deshalb die zweite Prüfung
    // im Absendeweg — und verbindlich die Regel in der Datenbank.
    const db = defaultDb({ profiles: [profilZeile(FIRMA)], jobs: [] })
    await zurAlterswahl(page, db)

    // Wert einschmuggeln, wie es die Auswahlliste nicht zuliesse.
    await page.locator('#job-mindestalter').evaluate(el => {
      el.insertAdjacentHTML('beforeend', '<option value="10">10</option>')
      el.value = '10'
    })

    await page.locator('#wizard-weiter').click()   // 4 -> 5
    await page.locator('#wizard-weiter').click()   // 5 -> 6
    await page.locator('#wizard-posten').click()

    await expect(page.locator('.toast', { hasText: /13/ })).toBeVisible()
    expect(db.jobs.length, 'die Anzeige darf nicht angelegt werden').toBe(0)
  })
})
