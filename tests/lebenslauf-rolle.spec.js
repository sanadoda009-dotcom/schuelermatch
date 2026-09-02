// Der Lebenslauf-Editor und die falsche Rolle (1.9.2026).
//
// ANLASS: Sanad hat es selbst gemeldet. Er klickte im Ratgeber auf
// „Wie bewerbe ich mich?", war als Firma angemeldet – und landete
// wortlos im Firmen-Dashboard beim Formular zum Anzeigen-Aufgeben.
// Vorher blitzte der Lebenslauf-Editor kurz auf.
//
// Zwei Ursachen:
//   1. `requireAuth('schueler')` schob jede andere Rolle stumm auf ihr
//      Dashboard. Für die Dashboards ist das richtig – auf einer
//      Funktionsseite, die man aus dem Ratgeber heraus anklickt, ist es
//      eine Sackgasse ohne Erklärung.
//   2. Der Editor steht statisch im HTML und war da, bevor die Prüfung
//      antworten konnte.
//
// Jetzt: Wer als Firma hier landet, bleibt auf der Seite und bekommt
// gesagt, warum sie nichts für ihn ist – mit einem Weg zurück. Und der
// Editor wird zurückgehalten, bis feststeht, ob er bleiben darf.

const { test, expect, setupDashboard, defaultDb, FIRMA, SCHUELER, SUPABASE_REF } =
  require('./helpers/supabase-fake')

test('als Firma bleibt man auf der Seite und bekommt eine Erklärung', async ({ page }) => {
  await setupDashboard(page.context(), { user: FIRMA, db: defaultDb() })
  await page.goto('/lebenslauf.html')

  await expect(page.locator('main')).toContainText('Der Lebenslauf-Editor ist für Schüler',
    { timeout: 20_000 })
  // Der Kern der Meldung: kein Sprung ins Formular zum Anzeigen-Aufgeben.
  await expect(page).toHaveURL(/lebenslauf\.html/)
  await expect(page.locator('main a[href="dashboard-firma.html"]')).toBeVisible()
  await expect(page.locator('main a[href="ratgeber.html"]')).toBeVisible()
})

test('die Erklärung rät nicht, es nochmal zu versuchen', async ({ page }) => {
  // Es liegt keine Störung vor. „Nochmal versuchen" und „Prüf deine
  // Internetverbindung" wären hier eine falsche Fährte.
  await setupDashboard(page.context(), { user: FIRMA, db: defaultDb() })
  await page.goto('/lebenslauf.html')
  await expect(page.locator('main')).toContainText('Der Lebenslauf-Editor ist für Schüler',
    { timeout: 20_000 })

  await expect(page.locator('main')).not.toContainText('Nochmal versuchen')
  await expect(page.locator('main')).not.toContainText('Internetverbindung')
})

test('als Schüler ist der Editor da', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: defaultDb() })
  await page.goto('/lebenslauf.html')

  await expect(page.locator('main')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('main')).not.toContainText('ist für Schüler')
  await expect(page.locator('main')).not.toHaveClass(/pruefe-zugang/)
})

test('der Editor blitzt nicht auf, bevor die Prüfung durch ist', async ({ page }) => {
  // Genau das hat Sanad beschrieben: „springe ich kurz auf lebenslauf".
  await page.route(`**/${SUPABASE_REF}.supabase.co/rest/v1/profiles*`, async route => {
    await new Promise(r => setTimeout(r, 1500))
    await route.fallback()
  })
  await setupDashboard(page.context(), { user: FIRMA, db: defaultDb() })
  await page.goto('/lebenslauf.html', { waitUntil: 'domcontentloaded' })

  // Solange die Prüfung läuft, ist der Inhalt zurückgehalten.
  await expect(page.locator('main')).toHaveClass(/pruefe-zugang/)
  await expect(page.locator('main')).not.toBeVisible()

  // Und danach steht die Erklärung da – nicht der Editor.
  await expect(page.locator('main')).toContainText('Der Lebenslauf-Editor ist für Schüler',
    { timeout: 20_000 })
  await expect(page.locator('main')).toBeVisible()
})

test('ohne Modul bleibt die Seite nicht dauerhaft leer', async ({ page }) => {
  // Die Notbremse in lebenslauf.html. Ohne sie wäre ein Ladefehler des
  // Moduls schlimmer als das Problem, das die Klasse löst.
  await setupDashboard(page.context(), { user: SCHUELER, db: defaultDb() })
  await page.route('**/js/lebenslauf.js', route => route.abort())
  await page.goto('/lebenslauf.html', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('main')).toBeVisible({ timeout: 20_000 })
})

test.describe('wer nicht weiß, dass er angemeldet ist', () => {
  // Sanad am 2.9.: „steht da, als Arbeitgeber steht dir das nicht zur
  // Verfügung – aber ich war gar nicht eingeloggt." Er WAR es: Eine
  // Supabase-Sitzung liegt im Browser und überlebt das Schließen des Tabs.
  // Die Seite wusste das und hat es ihm nicht gesagt. Genau das ist der
  // Fehler – nicht die Weiche.
  test('die Seite sagt, mit welchem Konto man hier ist', async ({ page }) => {
    await setupDashboard(page.context(), { user: FIRMA, db: defaultDb() })
    await page.goto('/lebenslauf.html')
    await expect(page.locator('main')).toContainText('für Schüler', { timeout: 20_000 })

    const konto = page.locator('.hinweis-konto')
    await expect(konto).toBeVisible()
    await expect(konto).toContainText(FIRMA.email)
    // Und warum das so ist, ohne dass man raten muss.
    await expect(konto).toContainText('bis du dich abmeldest')
  })

  test('man kommt aus der Sackgasse auch wieder heraus', async ({ page }) => {
    await setupDashboard(page.context(), { user: FIRMA, db: defaultDb() })
    await page.goto('/lebenslauf.html')
    await expect(page.locator('main')).toContainText('für Schüler', { timeout: 20_000 })

    const abmelden = page.locator('main button', { hasText: 'Abmelden' })
    await expect(abmelden).toBeVisible()
    await abmelden.click()
    await expect(page).toHaveURL(/login\.html/, { timeout: 20_000 })
  })

  test('ohne Anmeldung gibt es keinen Rollen-Hinweis, sondern den Login', async ({ page }) => {
    // Der Fall, den Sanad vermutet hatte. Er verhält sich richtig – und
    // ab jetzt bewacht ihn ein Test.
    await setupDashboard(page.context(), { user: null, db: defaultDb() })
    await page.goto('/lebenslauf.html')
    await expect(page).toHaveURL(/login\.html/, { timeout: 20_000 })
  })

  test('eine Sitzung ohne Profil endet nicht im Rollen-Hinweis', async ({ page }) => {
    // So sieht es aus, wenn jemand sein Konto gelöscht hat und der Browser
    // die Sitzung behält. Dann ist die Rolle unbekannt – ein Hinweis
    // „du bist Arbeitgeber" wäre schlicht falsch.
    await setupDashboard(page.context(), { user: FIRMA, db: defaultDb({ profiles: [] }) })
    await page.goto('/lebenslauf.html')
    await expect(page.locator('main')).toContainText('Konto unvollständig', { timeout: 20_000 })
    await expect(page.locator('main')).not.toContainText('für Schüler')
  })
})
