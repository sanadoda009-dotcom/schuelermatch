// Eingeloggtes Schüler-Dashboard (dashboard-schueler.html + js/dashboard-schueler.js).
// Session + Supabase sind komplett gefälscht (helpers/supabase-fake.js):
// keine echte DB, keine echten Accounts/Bewerbungen/Uploads.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER } = require('./helpers/supabase-fake')

// Die Sidebar ist ein Off-Canvas-Drawer (left:-280px) – erst per Hamburger öffnen,
// dann den Menüpunkt klicken. Der Klick schließt den Drawer wieder.
async function navigate(page, view) {
  await page.locator('#sidebar-toggle').click()
  await page.locator(`.sidebar-item[data-view="${view}"]`).click()
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

  test('Motivations-Starthilfe füllt einen Beispieltext ein', async ({ page }) => {
    const db = defaultDb({ profiles: [bewerbungsfaehig()] })
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/dashboard-schueler.html')

    await page.locator('#view-jobs .job-card').first().getByRole('button', { name: 'Jetzt bewerben' }).click()
    await expect(page.locator('#bewerbung-overlay')).toHaveClass(/open/)
    await expect(page.locator('#bewerbung-motivation')).toHaveValue('')
    await page.locator('#motivation-tipp').click()
    await expect(page.locator('#bewerbung-motivation')).not.toHaveValue('')
  })

  test('Logout meldet ab und leitet zum Login', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await expect(page.locator('#user-name')).toHaveText('Lena')
    await page.locator('#logout-btn').click()
    await expect(page).toHaveURL(/login\.html/)
  })
})
