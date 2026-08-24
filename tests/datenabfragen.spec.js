// Datenabfragen: wie viele, und laufen sie nebeneinander oder hintereinander?
//
// Anlass (Messung am 24.8.): Das Schüler-Dashboard stellte beim Laden
// sechs Abfragen, davon fünf brav hintereinander – rund eine Sekunde
// reine Warteschlange. Und die Tabelle `nachrichten` wurde ZWEIMAL mit
// exakt derselben Bedingung abgefragt: einmal für das Zähler-Abzeichen,
// einmal für die Glocke.
//
// Hier wird bewusst NICHT die Ladezeit in Millisekunden geprüft – die
// schwankt je nach Rechnerlast und macht Tests unzuverlässig. Geprüft
// wird, was deterministisch ist: wie oft welche Tabelle gefragt wird.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, warteAufDashboard } = require('./helpers/supabase-fake')

const HOST = 'blufrvuskqiloslyxjkx.supabase.co'

// Zählt Abfragen pro Tabelle mit.
function zaehleAbfragen(page) {
  const proTabelle = {}
  page.on('request', r => {
    if (!r.url().includes(HOST + '/rest/v1/')) return
    const tabelle = new URL(r.url()).pathname.replace('/rest/v1/', '').split('?')[0]
    proTabelle[tabelle] = (proTabelle[tabelle] || 0) + 1
  })
  return proTabelle
}

test('Schüler-Dashboard fragt die Nachrichten nur einmal ab', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER,
    db: defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] }) })
  const abfragen = zaehleAbfragen(page)
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
  await page.waitForTimeout(1500)

  // Die Glocke liefert die Zahl gleich mit; ein zweiter Zähl-Aufruf wäre
  // dieselbe Frage an dieselbe Tabelle.
  expect(abfragen['nachrichten'] || 0, 'Abfragen auf nachrichten').toBeLessThanOrEqual(1)
})

test('Schüler-Dashboard bleibt bei wenigen Abfragen', async ({ page }) => {
  // Wächst diese Zahl unbemerkt, lädt das Dashboard schleichend länger.
  await setupDashboard(page.context(), { user: SCHUELER,
    db: defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] }) })
  const abfragen = zaehleAbfragen(page)
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
  await page.waitForTimeout(1500)
  const gesamt = Object.values(abfragen).reduce((a, b) => a + b, 0)
  expect(gesamt, `Abfragen gesamt (${JSON.stringify(abfragen)})`).toBeLessThanOrEqual(7)
})

test('die Glocke wartet nicht auf die Job-Liste', async ({ page }) => {
  // Sie braucht nur die eigene Profil-ID. Stand sie hinter dem Laden der
  // Jobs, verlängerte sie die Kette unnötig um rund eine Sekunde.
  await setupDashboard(page.context(), { user: SCHUELER,
    db: defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] }) })
  const reihenfolge = []
  page.on('request', r => {
    if (!r.url().includes(HOST + '/rest/v1/')) return
    reihenfolge.push(new URL(r.url()).pathname.replace('/rest/v1/', '').split('?')[0])
  })
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
  await page.waitForTimeout(1500)

  const nachrichten = reihenfolge.indexOf('nachrichten')
  const gemerkte = reihenfolge.indexOf('gemerkte_jobs')
  expect(nachrichten, 'Nachrichten-Abfrage gestartet').toBeGreaterThanOrEqual(0)
  // Sie darf nicht als Letzte kommen – dann hing sie wieder am Ende der Kette.
  if (gemerkte >= 0) expect(nachrichten).toBeLessThan(gemerkte)
})

test('öffentliche Seiten kommen mit einer Abfrage aus', async ({ page }) => {
  await setupDashboard(page.context(), {})
  const abfragen = zaehleAbfragen(page)
  await page.goto('/jobs.html')
  await page.locator('#jobs-grid .job-card').first().waitFor({ timeout: 20_000 })
  await page.waitForTimeout(800)
  expect(abfragen['jobs'] || 0, 'Jobbörse lädt die Jobs genau einmal').toBe(1)
})

test('Firmen-Dashboard bleibt bei wenigen Abfragen', async ({ page }) => {
  await setupDashboard(page.context(), { user: FIRMA,
    db: defaultDb({ profiles: [profilZeile(FIRMA)] }) })
  const abfragen = zaehleAbfragen(page)
  await page.goto('/dashboard-firma.html')
  await warteAufDashboard(page)
  await page.waitForTimeout(1500)
  const gesamt = Object.values(abfragen).reduce((a, b) => a + b, 0)
  expect(gesamt, `Abfragen gesamt (${JSON.stringify(abfragen)})`).toBeLessThanOrEqual(6)
})
