// Ein geteilter Link muss auch für Angemeldete irgendwohin führen (9.9.2026).
//
// DER BEFUND: `job.html` hat einen „Link kopieren"-Knopf — Teilen ist
// also ausdrücklich vorgesehen. Die Seite prüfte aber nie, ob der
// Empfänger angemeldet ist, und zeigte zweimal „Kostenlos registrieren &
// bewerben" plus „Ich habe schon ein Konto".
//
// Wer längst ein Konto hat, landete damit in einem
// Registrierungsformular. Und `dashboard-schueler.html` kannte **gar
// keinen** URL-Parameter — es gab also überhaupt keinen Weg vom geteilten
// Link zur Bewerbung. `jobs.html` konnte das längst (`?job=`); ausgerechnet
// dort, wo man sich bewirbt, fehlte es.
//
// Dazu der Fall, den ein geteilter Link besonders leicht erzeugt: Die
// Anzeige ist „ab 16", der Empfänger ist 14. Im Dashboard taucht sie
// deshalb gar nicht auf — der Klick auf den Link hätte also ins Leere
// geführt. Jetzt sagt die Seite, warum, und nennt den Grund beim Namen.

const { test, expect, setupDashboard, warteAufDashboard, SCHUELER, FIRMA, defaultDb } = require('./helpers/supabase-fake')

const BASIS = {
  firma_id: FIRMA.id, firma_name: FIRMA.name, beschreibung: 'Eis verkaufen.',
  ort: 'München', stundenlohn: 13, kategorie: 'Gastronomie', lat: 48.137, lon: 11.575,
  arbeitszeit: 'Wochenende', aktiv: true, aufrufe: 1,
  erstellt_am: '2026-09-01T10:00:00Z', verfuegbarkeit: null,
}

function db({ alter = 17, jobs } = {}) {
  const d = defaultDb()
  d.jobs = jobs || [{ ...BASIS, id: 'geteilt-1', titel: 'Aushilfe Eistheke', mindestalter: 15 }]
  d.profiles = d.profiles.map(p => p.id === SCHUELER.id
    ? { ...p, alter_jahre: alter, verifiziert: true, lat: 48.137, lon: 11.575 }
    : p)
  return d
}

test.describe('im Dashboard öffnet ?job= die Anzeige', () => {
  test('das Detailfenster geht auf', async ({ page }) => {
    await setupDashboard(page.context(), { db: db(), user: SCHUELER })
    await page.goto('/dashboard-schueler.html?job=geteilt-1')
    await warteAufDashboard(page)
    await expect(page.locator('#detail-titel')).toHaveText('Aushilfe Eistheke', { timeout: 20_000 })
  })

  test('und der Parameter verschwindet aus der Adresse', async ({ page }) => {
    // Sonst zieht ein Neuladen das Fenster ein zweites Mal auf, und der
    // Link im Verlauf zeigt auf etwas, das schon erledigt ist.
    await setupDashboard(page.context(), { db: db(), user: SCHUELER })
    await page.goto('/dashboard-schueler.html?job=geteilt-1')
    await warteAufDashboard(page)
    await expect(page.locator('#detail-titel')).toHaveText('Aushilfe Eistheke', { timeout: 20_000 })
    expect(new URL(page.url()).search).toBe('')
  })
})

test.describe('wenn die Anzeige nicht passt, wird gesagt warum', () => {
  test('zu jung: das Alter wird beim Namen genannt', async ({ page }) => {
    // Der Fall, den ein geteilter Link besonders leicht erzeugt.
    await setupDashboard(page.context(), {
      db: db({ alter: 14, jobs: [{ ...BASIS, id: 'geteilt-1', titel: 'Kellnern', mindestalter: 16 }] }),
      user: SCHUELER,
    })
    await page.goto('/dashboard-schueler.html?job=geteilt-1')
    await warteAufDashboard(page)
    const meldung = page.locator('.toast, #toast')
    await expect(meldung).toContainText('ab 16 Jahren', { timeout: 20_000 })
    await expect(meldung).toContainText('14')
  })

  test('und die Schuld liegt nicht bei der Firma', async ({ page }) => {
    // „Die wollen dich nicht" wäre die falsche Botschaft an einen
    // 14-Jährigen. Es ist das Gesetz, und das gehört dazugesagt.
    await setupDashboard(page.context(), {
      db: db({ alter: 14, jobs: [{ ...BASIS, id: 'geteilt-1', titel: 'Kellnern', mindestalter: 16 }] }),
      user: SCHUELER,
    })
    await page.goto('/dashboard-schueler.html?job=geteilt-1')
    await warteAufDashboard(page)
    await expect(page.locator('.toast, #toast'))
      .toContainText('Jugendarbeitsschutzgesetz', { timeout: 20_000 })
  })

  test('zurückgezogene Anzeige: auch das steht da', async ({ page }) => {
    await setupDashboard(page.context(), {
      db: db({ jobs: [{ ...BASIS, id: 'geteilt-1', titel: 'Weg', mindestalter: 15, aktiv: false }] }),
      user: SCHUELER,
    })
    await page.goto('/dashboard-schueler.html?job=geteilt-1')
    await warteAufDashboard(page)
    await expect(page.locator('.toast, #toast'))
      .toContainText('gibt es nicht mehr', { timeout: 20_000 })
  })
})

test.describe('ohne Parameter ändert sich nichts', () => {
  test('kein Fenster geht von selbst auf', async ({ page }) => {
    await setupDashboard(page.context(), { db: db(), user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await expect(page.locator('#job-detail-overlay')).not.toHaveClass(/open/)
  })
})

test.describe('die öffentliche Anzeigenseite', () => {
  // Dieselbe Anzeige, einmal abgemeldet und einmal angemeldet. Die Id
  // muss im Bestand liegen, sonst zeigt job.html „nicht gefunden" und es
  // gibt gar keinen Knopf zu prüfen — genau dort bin ich beim Schreiben
  // hineingelaufen.
  const OEFFENTLICH = { ...BASIS, id: 'geteilt-1', titel: 'Aushilfe Eistheke', mindestalter: 15 }

  test('ohne Anmeldung bleibt es beim Registrieren', async ({ page }) => {
    await setupDashboard(page.context(), { db: db({ jobs: [OEFFENTLICH] }) })
    await page.goto('/job.html?id=geteilt-1')
    await expect(page.locator('[data-cta-link]').first())
      .toContainText('registrieren', { timeout: 20_000 })
    await expect(page.locator('[data-cta-login]')).toBeVisible()
  })

  test('mit Anmeldung führt sie ins Dashboard, zu genau dieser Anzeige', async ({ page }) => {
    await setupDashboard(page.context(), { db: db({ jobs: [OEFFENTLICH] }), user: SCHUELER })
    await page.goto('/job.html?id=geteilt-1')

    const cta = page.locator('[data-cta-link]').first()
    await expect(cta).toContainText('Dashboard', { timeout: 20_000 })
    await expect(cta).toHaveAttribute('href', 'dashboard-schueler.html?job=geteilt-1')

    // „Ich habe schon ein Konto" ist dann gegenstandslos.
    await expect(page.locator('[data-cta-login]')).toHaveCount(0)
  })
})
