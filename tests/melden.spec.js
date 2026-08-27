// Der Melde-Dialog (27.8.).
//
// `js/melden.js` ist der Weg, auf dem ein Schüler eine Betrugsanzeige
// oder eine übergriffige Nachricht meldet — 117 Zeilen, und **kein
// einziger Test**. Geprüft war nur die Betreiber-Seite
// (`admin-meldungen.spec.js`), also das Ansehen der Meldungen. Der Weg
// dorthin nicht.
//
// Darauf ruht die ganze Sicherheitszusage der Plattform. Gefunden über
// dieselbe Frage wie bei `js/sicher.js`: welche Datei kommt in keinem
// Test vor?
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA } = require('./helpers/supabase-fake')

async function oeffneJobDetail(page) {
  await expect(page.locator('#view-jobs .job-card').first()).toBeVisible({ timeout: 30_000 })
  await page.locator('#view-jobs .job-card h3').first().click()
  await expect(page.locator('#job-detail-overlay')).toHaveClass(/open/)
}

async function oeffneMeldeDialog(page) {
  await page.locator('#detail-body [data-melde-job]').click()
  await expect(page.locator('#melde-overlay')).toBeVisible()
}

function db() {
  const d = defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] })
  d.meldungen = []
  return d
}

test.describe('eine Anzeige melden', () => {
  test.beforeEach(async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER, db: db() })
    await page.goto('/dashboard-schueler.html')
    await oeffneJobDetail(page)
  })

  test('der Melden-Knopf ist da', async ({ page }) => {
    await expect(page.locator('#detail-body [data-melde-job]')).toBeVisible()
  })

  test('der Dialog nennt alle fünf Gründe', async ({ page }) => {
    await oeffneMeldeDialog(page)
    const werte = await page.locator('input[name="melde-grund"]').evaluateAll(
      els => els.map(e => e.value))
    expect(werte).toEqual(['unangemessen', 'betrug', 'kontaktdaten', 'unrealistisch', 'sonstiges'])
  })

  test('die Gründe stimmen mit der Datenbank überein', async ({ page }) => {
    // In `meldungen` steht eine CHECK-Regel auf genau diese fünf Werte.
    // Weicht der Dialog ab, schlägt das Absenden mit einer unverständlichen
    // Meldung fehl — und der Schüler denkt, es sei egal.
    await oeffneMeldeDialog(page)
    const werte = await page.locator('input[name="melde-grund"]').evaluateAll(
      els => els.map(e => e.value))
    const inDerDatenbank = ['unangemessen', 'betrug', 'kontaktdaten', 'unrealistisch', 'sonstiges']
    expect(werte.sort()).toEqual(inDerDatenbank.sort())
  })

  test('der erste Grund ist vorausgewählt — kein Absenden ins Leere', async ({ page }) => {
    await oeffneMeldeDialog(page)
    await expect(page.locator('input[name="melde-grund"]:checked')).toHaveCount(1)
  })

  test('der Dialog sagt zu, dass die Meldung anonym bleibt', async ({ page }) => {
    // Ohne diese Zusage meldet niemand jemanden, mit dem er noch
    // schreiben muss. Die Zugriffsregel hält sie: „Eigene Meldungen
    // lesen" erlaubt nur dem Melder und dem Betreiber den Blick darauf.
    await oeffneMeldeDialog(page)
    const text = await page.locator('.melde-intro').innerText()
    expect(text).toMatch(/erfährt.*nicht/is)
  })

  test('der Notfall-Hinweis steht drin', async ({ page }) => {
    // Wichtiger als die Meldung selbst: Wer bedroht wird, braucht einen
    // Menschen, nicht ein Formular.
    await oeffneMeldeDialog(page)
    const text = await page.locator('.melde-notfall').innerText()
    expect(text).toMatch(/Eltern|vertraust/)
    expect(text).toMatch(/110/)
  })

  test('absenden legt die Meldung an', async ({ page }) => {
    const daten = db()
    await setupDashboard(page.context(), { user: SCHUELER, db: daten })
    await page.goto('/dashboard-schueler.html')
    await oeffneJobDetail(page)
    await oeffneMeldeDialog(page)

    await page.locator('input[value="betrug"]').check()
    await page.locator('#melde-text').fill('Verlangt 50 Euro Kaution vorab.')
    await page.locator('#melde-form button[type=submit]').click()

    await expect.poll(() => daten.meldungen.length).toBe(1)
    expect(daten.meldungen[0]).toMatchObject({
      typ: 'job',
      grund: 'betrug',
      melder_id: SCHUELER.id,
      beschreibung: 'Verlangt 50 Euro Kaution vorab.',
    })
    // Bei einer Job-Meldung MUSS nachricht_id leer sein — die CHECK-Regel
    // `meldung_ziel` in der Datenbank verlangt genau das.
    expect(daten.meldungen[0].nachricht_id).toBeFalsy()
    expect(daten.meldungen[0].job_id).toBeTruthy()
  })

  test('ohne Freitext geht es auch — der ist freiwillig', async ({ page }) => {
    const daten = db()
    await setupDashboard(page.context(), { user: SCHUELER, db: daten })
    await page.goto('/dashboard-schueler.html')
    await oeffneJobDetail(page)
    await oeffneMeldeDialog(page)

    await page.locator('#melde-form button[type=submit]').click()
    await expect.poll(() => daten.meldungen.length).toBe(1)
    expect(daten.meldungen[0].beschreibung).toBeFalsy()
  })

  test('nach dem Absenden schliesst der Dialog und bedankt sich', async ({ page }) => {
    await oeffneMeldeDialog(page)
    await page.locator('#melde-form button[type=submit]').click()
    await expect(page.locator('#melde-overlay')).toHaveCount(0)
    await expect(page.locator('.toast')).toContainText(/Danke/)
  })

  test('der Freitext ist auf 1000 Zeichen begrenzt — wie die Datenbank', async ({ page }) => {
    // `meldungen_beschreibung_check` erlaubt höchstens 1000 Zeichen.
    // Wäre das Feld grösser, käme eine unverständliche Fehlermeldung.
    await oeffneMeldeDialog(page)
    await expect(page.locator('#melde-text')).toHaveAttribute('maxlength', '1000')
  })
})

test.describe('wenn etwas schiefgeht', () => {
  test('eine zweite Meldung derselben Anzeige wird freundlich abgefangen', async ({ page }) => {
    // In der Datenbank liegt ein eindeutiger Index
    // (`meldungen_einmal_pro_job`). Ohne die Behandlung bekäme der
    // Schüler „konnte nicht gesendet werden" und dächte, seine erste
    // Meldung sei auch verloren.
    await setupDashboard(page.context(), { user: SCHUELER, db: db() })
    await page.goto('/dashboard-schueler.html')
    await page.route('**/rest/v1/meldungen*', route => {
      if (route.request().method() !== 'POST') return route.continue()
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint' }),
      })
    })
    await oeffneJobDetail(page)
    await oeffneMeldeDialog(page)
    await page.locator('#melde-form button[type=submit]').click()

    await expect(page.locator('.toast')).toContainText(/bereits gemeldet/)
    await expect(page.locator('#melde-overlay'), 'der Dialog darf nicht offen bleiben').toHaveCount(0)
  })

  test('bei einem echten Fehler bleibt der Dialog offen und der Knopf nutzbar', async ({ page }) => {
    // Sonst wäre die Meldung weg und der Schüler müsste alles neu
    // eintippen — bei einem Vorgang, den man ungern zweimal beginnt.
    await setupDashboard(page.context(), { user: SCHUELER, db: db() })
    await page.goto('/dashboard-schueler.html')
    await page.route('**/rest/v1/meldungen*', route => {
      if (route.request().method() !== 'POST') return route.continue()
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' })
    })
    await oeffneJobDetail(page)
    await oeffneMeldeDialog(page)
    await page.locator('#melde-text').fill('Das will ich nicht nochmal tippen.')
    await page.locator('#melde-form button[type=submit]').click()

    await expect(page.locator('.toast')).toContainText(/später nochmal/)
    await expect(page.locator('#melde-overlay')).toBeVisible()
    await expect(page.locator('#melde-form button[type=submit]')).toBeEnabled()
    await expect(page.locator('#melde-text')).toHaveValue('Das will ich nicht nochmal tippen.')
  })
})

test.describe('den Dialog wieder loswerden', () => {
  test.beforeEach(async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER, db: db() })
    await page.goto('/dashboard-schueler.html')
    await oeffneJobDetail(page)
    await oeffneMeldeDialog(page)
  })

  test('das Kreuz schliesst ihn', async ({ page }) => {
    await page.locator('#melde-close').click()
    await expect(page.locator('#melde-overlay')).toHaveCount(0)
  })

  test('ein Klick daneben auch', async ({ page }) => {
    await page.locator('#melde-overlay').click({ position: { x: 5, y: 5 } })
    await expect(page.locator('#melde-overlay')).toHaveCount(0)
  })

  test('Escape auch — er ist ein modal-overlay', async ({ page }) => {
    // js/tastatur.js greift über die Klasse. Hier festgehalten, weil der
    // Dialog erst zur Laufzeit erzeugt wird und deshalb leicht durch
    // dieses Netz fallen könnte.
    await page.keyboard.press('Escape')
    await expect(page.locator('#melde-overlay')).toHaveCount(0)
  })

  test('der Fokus landet im Dialog, nicht dahinter', async ({ page }) => {
    const drin = await page.evaluate(() =>
      document.getElementById('melde-overlay')?.contains(document.activeElement))
    expect(drin).toBe(true)
  })
})

// ---------------------------------------------------------------------
// Melden von den öffentlichen Seiten (27.8.)
//
// Der Knopf gab es nur im Chat und im Dashboard — also nirgends dort, wo
// eine Betrugsanzeige am ehesten gesehen wird. Wer über Google oder
// einen geteilten Link auf einer Anzeige landet, sieht das Dashboard
// nie und konnte gar nichts tun.
//
// Diese Seiten kennen die Anmeldung nicht. Deshalb schlägt
// `meldeMitAnmeldung()` sie selbst nach — ohne Umleitung, denn
// `requireAuth` würde jemanden, der nur stöbert, auf die Anmeldeseite
// werfen.
test.describe('von der Jobbörse aus melden', () => {
  test('der Knopf ist im Detail-Fenster', async ({ page }) => {
    await setupDashboard(page.context(), { user: null, db: db() })
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 30_000 })
    await page.locator('.job-card').first().click()
    await expect(page.locator('#detail-melden')).toBeVisible()
  })

  test('ohne Anmeldung erklärt er, warum es ein Konto braucht', async ({ page }) => {
    // Der Knopf bleibt für alle sichtbar. Ihn zu verstecken hiesse, die
    // Meldung von der Anmeldung abhängig zu machen, ohne das je zu
    // erklären.
    await setupDashboard(page.context(), { user: null, db: db() })
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 30_000 })
    await page.locator('.job-card').first().click()
    await page.locator('#detail-melden').click()

    const dialog = page.locator('#melde-overlay')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/Konto/)
    await expect(dialog.locator('a[href="login.html"]')).toBeVisible()
  })

  test('und wirft niemanden aus der Anzeige, die er melden will', async ({ page }) => {
    // Eine automatische Umleitung wäre bequemer zu bauen und schlechter
    // für den, der gerade etwas Bedenkliches gefunden hat.
    await setupDashboard(page.context(), { user: null, db: db() })
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 30_000 })
    await page.locator('.job-card').first().click()
    await page.locator('#detail-melden').click()
    await expect(page.locator('#melde-overlay')).toBeVisible()
    expect(page.url()).toContain('jobs.html')
  })

  test('auch ohne Anmeldung steht der Notfall-Hinweis da', async ({ page }) => {
    // Wer bedroht wird, braucht die Telefonnummer sofort — nicht erst
    // nach einer Registrierung.
    await setupDashboard(page.context(), { user: null, db: db() })
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 30_000 })
    await page.locator('.job-card').first().click()
    await page.locator('#detail-melden').click()
    await expect(page.locator('#melde-overlay .melde-notfall')).toContainText('110')
  })

  test('angemeldet öffnet sich der richtige Dialog', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER, db: db() })
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 30_000 })
    await page.locator('.job-card').first().click()
    await page.locator('#detail-melden').click()

    await expect(page.locator('input[name="melde-grund"]')).toHaveCount(5)
  })
})

test.describe('von der einzelnen Anzeigenseite aus melden', () => {
  test('der Knopf ist da', async ({ page }) => {
    const daten = db()
    await setupDashboard(page.context(), { user: null, db: daten })
    await page.goto(`/job.html?id=${daten.jobs[0].id}`)
    await expect(page.locator('#melden-btn')).toBeVisible({ timeout: 30_000 })
  })

  test('und funktioniert für einen angemeldeten Schüler', async ({ page }) => {
    const daten = db()
    await setupDashboard(page.context(), { user: SCHUELER, db: daten })
    await page.goto(`/job.html?id=${daten.jobs[0].id}`)
    await expect(page.locator('#melden-btn')).toBeVisible({ timeout: 30_000 })
    await page.locator('#melden-btn').click()

    await page.locator('input[value="betrug"]').check()
    await page.locator('#melde-form button[type=submit]').click()

    await expect.poll(() => daten.meldungen.length).toBe(1)
    expect(daten.meldungen[0]).toMatchObject({ typ: 'job', grund: 'betrug' })
  })
})
