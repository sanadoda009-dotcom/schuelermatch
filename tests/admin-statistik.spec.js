// Admin-Bereich, Reiter "Statistik" (admin.html + js/admin.js).
// Die Zahlen kommen über die aggregierende RPC `betreiber_statistik` –
// im Test aus der Fake-DB nachgebildet.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, ADMIN, warteAufAdmin } = require('./helpers/supabase-fake')

function statistikDb() {
  const db = defaultDb({
    profiles: [
      profilZeile(ADMIN, { ist_admin: true }),
      profilZeile(SCHUELER, { verifiziert: true }),
      profilZeile({ ...SCHUELER, id: 's2', name: 'Ben' }, { verifiziert: false }),
      profilZeile(FIRMA, { firma_status: 'freigegeben' }),
      profilZeile({ ...FIRMA, id: 'f2', name: 'Neue GmbH' }, { firma_status: 'neu' }),
    ],
  })
  db.bewerbungen = [
    { id: 'b1', job_id: db.jobs[0].id, schueler_id: SCHUELER.id, status: 'angenommen', erstellt_am: new Date().toISOString() },
    { id: 'b2', job_id: db.jobs[1].id, schueler_id: SCHUELER.id, status: 'ausstehend', erstellt_am: new Date().toISOString() },
  ]
  db.meldungen = [
    { id: 'm1', melder_id: SCHUELER.id, typ: 'job', job_id: db.jobs[0].id, grund: 'betrug', status: 'offen', zitat: 'x', erstellt_am: new Date().toISOString() },
  ]
  return db
}

async function oeffneStatistik(page) {
  await warteAufAdmin(page)                // erst wenn init() fertig ist
  await page.locator('.admin-tab[data-tab="statistik"]').click()
  await expect(page.locator('#panel-statistik')).toHaveClass(/active/)
  await expect(page.locator('.stat-gruppe').first()).toBeVisible({ timeout: 20_000 })
}

test('Statistik-Reiter existiert und zeigt Nutzerzahlen', async ({ page }) => {
  await setupDashboard(page.context(), { user: ADMIN, db: statistikDb() })
  await page.goto('/admin.html')
  await oeffneStatistik(page)

  const nutzer = page.locator('.stat-gruppe', { hasText: 'Nutzer' })
  // 3 Schüler-Profile: der Admin selbst hat ebenfalls die Rolle 'schueler'
  // (so ist es auch in der echten DB: ist_admin ist nur ein Flag am Profil).
  await expect(nutzer).toContainText('Schüler')
  await expect(nutzer).toContainText('Arbeitgeber')
  await expect(nutzer).toContainText('davon freigegeben')
  // 1 von 3 verifiziert -> 33%
  await expect(nutzer).toContainText('33%')
})

test('Aktivität zeigt Jobs, Bewerbungen und Zusagenquote', async ({ page }) => {
  await setupDashboard(page.context(), { user: ADMIN, db: statistikDb() })
  await page.goto('/admin.html')
  await oeffneStatistik(page)

  const aktiv = page.locator('.stat-gruppe', { hasText: 'Aktivität' })
  await expect(aktiv).toContainText('Bewerbungen je Job')
  // 2 Bewerbungen, davon 1 angenommen -> 50%
  await expect(aktiv).toContainText('50%')
})

test('offene Aufgaben werden hervorgehoben', async ({ page }) => {
  await setupDashboard(page.context(), { user: ADMIN, db: statistikDb() })
  await page.goto('/admin.html')
  await oeffneStatistik(page)

  const warten = page.locator('.stat-gruppe', { hasText: 'Wartet auf dich' })
  await expect(warten).toContainText('Firmen zu prüfen')
  await expect(warten).toContainText('offene Meldungen')
  await expect(warten.locator('.stat-box--achtung')).toHaveCount(2)
})

test('ohne offene Aufgaben fehlt der Abschnitt', async ({ page }) => {
  const db = defaultDb({
    profiles: [profilZeile(ADMIN, { ist_admin: true }), profilZeile(FIRMA, { firma_status: 'freigegeben' })],
  })
  await setupDashboard(page.context(), { user: ADMIN, db })
  await page.goto('/admin.html')
  await oeffneStatistik(page)

  await expect(page.locator('.stat-gruppe', { hasText: 'Wartet auf dich' })).toHaveCount(0)
})

test('Wochen-Tabelle zeigt 8 Wochen mit Balken', async ({ page }) => {
  await setupDashboard(page.context(), { user: ADMIN, db: statistikDb() })
  await page.goto('/admin.html')
  await oeffneStatistik(page)

  await expect(page.locator('.stat-tabelle tbody tr')).toHaveCount(8)
  await expect(page.locator('.stat-tabelle thead')).toContainText('Anmeldungen')
  await expect(page.locator('.stat-tabelle thead')).toContainText('Neue Jobs')
  // Balken für die aktuelle Woche (2 Bewerbungen heute) sind gerendert
  await expect(page.locator('.balken-bewerbung').last()).toBeVisible()
})
