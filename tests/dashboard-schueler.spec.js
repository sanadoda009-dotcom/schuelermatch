// Eingeloggtes Schüler-Dashboard (dashboard-schueler.html + js/dashboard-schueler.js).
// Session + Supabase sind komplett gefälscht (helpers/supabase-fake.js):
// keine echte DB, keine echten Accounts/Bewerbungen/Uploads.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, warteAufDashboard } = require('./helpers/supabase-fake')

// Die Sidebar ist ein Off-Canvas-Drawer (left:-280px) – erst per Hamburger öffnen,
// dann den Menüpunkt klicken. Der Klick schließt den Drawer wieder.
async function navigate(page, view) {
  await warteAufDashboard(page)            // erst wenn init() fertig ist
  await page.locator('#sidebar-toggle').click()
  await page.locator(`.sidebar-item[data-view="${view}"]`).click()
}

// Öffnet das Job-Detail-Modal. Wartet erst, bis die Karten gerendert sind –
// unter Parallel-Last laden die Dashboards mehrere CDN-Skripte und brauchen länger.
async function oeffneJobDetail(page) {
  await warteAufDashboard(page)
  await expect(page.locator('#view-jobs .job-card').first()).toBeVisible({ timeout: 30_000 })
  await page.locator('#view-jobs .job-card h3').first().click()
  await expect(page.locator('#job-detail-overlay')).toHaveClass(/open/)
}

// Ein voll bewerbungsfähiger Schüler: verifiziert + ausgefüllter Lebenslauf.
function bewerbungsfaehig() {
  return profilZeile(SCHUELER, {
    verifiziert: true,
    schule: 'Gymnasium Nord',
    lebenslauf_bloecke: [{ id: 'b1', typ: 'text', titel: 'Über mich', inhalt: 'Ich bin zuverlässig und lerne schnell.' }],
  })
}

test('ohne Session wird man auf die Login-Seite umgeleitet', async ({ page }) => {
  await setupDashboard(page.context(), { user: null }) // NICHT eingeloggt
  await page.goto('/dashboard-schueler.html')
  await expect(page).toHaveURL(/login\.html/)
})

test.describe('eingeloggt', () => {
  test('zeigt Namen, Matches und Job-Karten mit Bewerben-Button', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')

    await expect(page.locator('#user-name')).toHaveText('Lena')
    await expect(page.locator('#sidebar-name')).toHaveText('Lena')
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)
    await expect(page.locator('#view-jobs .job-card').first().getByRole('button', { name: 'Jetzt bewerben' })).toBeVisible()
  })

  test('Job-Filter im Dashboard funktioniert (Synonym-Suche)', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(4)

    await page.locator('#filter-suche').fill('kellner')
    await expect(page.locator('#view-jobs .job-card')).toHaveCount(1)
    await expect(page.locator('#view-jobs .job-card')).toContainText('Café Sonnenschein')
  })

  test('Sidebar wechselt zur Bewerbungen-Ansicht mit Status-Timeline', async ({ page }) => {
    const db = defaultDb({ profiles: [bewerbungsfaehig()] })
    db.bewerbungen = [
      { id: 'bw1', job_id: db.jobs[0].id, schueler_id: SCHUELER.id, status: 'angenommen', erstellt_am: '2026-07-10T10:00:00Z' },
      { id: 'bw2', job_id: db.jobs[1].id, schueler_id: SCHUELER.id, status: 'ausstehend', erstellt_am: '2026-07-12T10:00:00Z' },
    ]
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/dashboard-schueler.html')

    await navigate(page, 'bewerbungen')
    await expect(page.locator('#view-bewerbungen')).toHaveClass(/active/)
    await expect(page.locator('.bew-stats')).toContainText('2')       // Gesamt
    await expect(page.locator('.bew-liste')).toContainText('Service-Aushilfe im Café Sonnenschein')
  })

  test('Profil-Ansicht ist vorbefüllt und Speichern schreibt in die DB', async ({ page }) => {
    const db = defaultDb({ profiles: [profilZeile(SCHUELER, { name: 'Lena', ort: 'München', alter_jahre: 16 })] })
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/dashboard-schueler.html')

    await navigate(page, 'profil')
    await expect(page.locator('#profile-name')).toHaveValue('Lena')
    await expect(page.locator('#profile-ort')).toHaveValue('München')

    await page.locator('#profile-ort').fill('Augsburg')
    await page.locator('#profile-form button[type=submit]').click()
    // Speichern zeigt keinen Toast, sondern setzt den Button zurück und aktualisiert die DB
    await expect(page.locator('#profile-form button[type=submit]')).toHaveText('Speichern')
    await expect.poll(() => db.profiles[0].ort).toBe('Augsburg')
  })

  test('Verifizierungs-Ansicht bietet beide Upload-Wege an', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await navigate(page, 'verifizierung')
    await expect(page.locator('#view-verifizierung')).toHaveClass(/active/)
    await expect(page.getByRole('button', { name: 'Schülerausweis hochladen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Schulbestätigung hochladen' })).toBeVisible()
  })
})

test.describe('Bewerbungs-Flow', () => {
  test('unverifizierter Schüler wird zur Verifizierung geschickt statt sich zu bewerben', async ({ page }) => {
    const db = defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: false })] })
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/dashboard-schueler.html')

    await warteAufDashboard(page)
    await page.locator('#view-jobs .job-card').first().getByRole('button', { name: 'Jetzt bewerben' }).click()
    // Kein Bewerbungs-Modal, stattdessen Sprung zur Verifizierung + Hinweis-Toast
    await expect(page.locator('#bewerbung-overlay')).not.toHaveClass(/open/)
    await expect(page.locator('#view-verifizierung')).toHaveClass(/active/)
    await expect(page.locator('.toast')).toContainText('verifiziere dich zuerst')
  })

  test('verifizierter Schüler kann sich bewerben – Bewerbung landet in der DB', async ({ page }) => {
    const db = defaultDb({ profiles: [bewerbungsfaehig()] })
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/dashboard-schueler.html')

    await warteAufDashboard(page)
    const ersteKarte = page.locator('#view-jobs .job-card').first()
    await ersteKarte.getByRole('button', { name: 'Jetzt bewerben' }).click()

    const modal = page.locator('#bewerbung-overlay')
    await expect(modal).toHaveClass(/open/)
    await expect(page.locator('#bewerbung-job-titel')).toHaveText('Service-Aushilfe im Café Sonnenschein')

    await page.locator('#bewerbung-motivation').fill('Ich arbeite gern mit Menschen und bin am Wochenende flexibel.')
    // Standard: automatischer Lebenslauf ist ausgewählt
    await page.locator('#bewerbung-form button[type=submit]').click()

    await expect(page.locator('.toast')).toContainText('Bewerbung abgeschickt')
    await expect(modal).not.toHaveClass(/open/)
    // Bewerbung ist tatsächlich (gefälscht) gespeichert
    await expect.poll(() => db.bewerbungen.length).toBe(1)
    expect(db.bewerbungen[0]).toMatchObject({
      job_id: db.jobs[0].id,
      schueler_id: SCHUELER.id,
      motivationsschreiben: expect.stringContaining('flexibel'),
    })
  })

  // Hiess bis zum 27.8. „Motivations-Starthilfe füllt einen Beispieltext
  // ein". Der Knopf warf einen von drei fertigen Texten ins Feld — bei
  // fünf Bewerbern bekam der Arbeitgeber fünfmal denselben. Ersetzt
  // durch den Anschreiben-Coach: drei Fragen, und der Text entsteht aus
  // den eigenen Antworten. Ausführlich in tests/anschreiben.spec.js.
  test('der Anschreiben-Coach schreibt aus den eigenen Antworten', async ({ page }) => {
    const db = defaultDb({ profiles: [bewerbungsfaehig()] })
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/dashboard-schueler.html')

    await warteAufDashboard(page)
    await page.locator('#view-jobs .job-card').first().getByRole('button', { name: 'Jetzt bewerben' }).click()
    await expect(page.locator('#bewerbung-overlay')).toHaveClass(/open/)
    await expect(page.locator('#bewerbung-motivation')).toHaveValue('')

    await page.locator('#coach-auf').click()
    await page.locator('#coach-warum').fill('Ich will mein erstes eigenes Geld verdienen')
    await page.locator('#coach-uebernehmen').click()

    await expect(page.locator('#bewerbung-motivation')).toHaveValue(/erstes eigenes Geld/)
  })

  test('Logout meldet ab und leitet zum Login', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await expect(page.locator('#user-name')).toHaveText('Lena')
    await page.locator('#logout-btn').click()
    await expect(page).toHaveURL(/login\.html/)
  })
})

test.describe('Melden-Funktion', () => {
  test('Job-Detail hat einen Melden-Button, der den Dialog öffnet', async ({ page }) => {
    const db = defaultDb({ profiles: [bewerbungsfaehig()] })
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/dashboard-schueler.html')

    await oeffneJobDetail(page)

    const meldeBtn = page.locator('#detail-body [data-melde-job]')
    await expect(meldeBtn).toBeVisible()
    await meldeBtn.click()

    const dialog = page.locator('#melde-overlay')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Danke, dass du aufpasst')
    // Alle fünf Gründe stehen zur Auswahl
    await expect(dialog.locator('.melde-grund')).toHaveCount(5)
    // Notfall-Hinweis für Minderjährige ist da
    await expect(dialog.locator('.melde-notfall')).toContainText('110')
  })

  test('Meldung absenden schreibt sie in die Datenbank', async ({ page }) => {
    const db = defaultDb({ profiles: [bewerbungsfaehig()] })
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/dashboard-schueler.html')

    await oeffneJobDetail(page)
    await page.locator('#detail-body [data-melde-job]').click()

    await page.locator('.melde-grund', { hasText: 'Betrug' }).click()
    await page.locator('#melde-text').fill('Verlangt Vorkasse per Überweisung.')
    await page.locator('#melde-form button[type=submit]').click()

    await expect(page.locator('.toast')).toContainText('Danke')
    await expect(page.locator('#melde-overlay')).toHaveCount(0)

    await expect.poll(() => (db.meldungen || []).length).toBe(1)
    expect(db.meldungen[0]).toMatchObject({
      typ: 'job',
      grund: 'betrug',
      melder_id: SCHUELER.id,
      job_id: db.jobs[0].id,
      beschreibung: expect.stringContaining('Vorkasse')
    })
  })

  test('Dialog lässt sich ohne Meldung wieder schließen', async ({ page }) => {
    const db = defaultDb({ profiles: [bewerbungsfaehig()] })
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/dashboard-schueler.html')

    await oeffneJobDetail(page)
    await page.locator('#detail-body [data-melde-job]').click()
    await expect(page.locator('#melde-overlay')).toBeVisible()

    await page.locator('#melde-close').click()
    await expect(page.locator('#melde-overlay')).toHaveCount(0)
    expect((db.meldungen || []).length).toBe(0)
  })
})
