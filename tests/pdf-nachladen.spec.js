// jsPDF (~93 KB) wurde früher auf jeder Dashboard-Seite sofort geladen,
// gebraucht wird es aber nur, wenn wirklich ein PDF entsteht.
// Diese Tests halten beides fest: die Ersparnis UND dass das Nachladen klappt.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, warteAufDashboard } = require('./helpers/supabase-fake')

function schuelerMitLebenslauf() {
  return profilZeile(SCHUELER, {
    verifiziert: true, schule: 'Gymnasium Nord', klasse: '10. Klasse',
    lebenslauf_bloecke: [{ id: 'b1', typ: 'text', titel: 'Über mich', inhalt: 'Ich bin zuverlässig.' }],
  })
}

test('Dashboard lädt jsPDF NICHT beim Seitenaufruf', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: defaultDb({ profiles: [schuelerMitLebenslauf()] }) })
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
  await expect(page.locator('#view-jobs .job-card').first()).toBeVisible()

  // Kein <script>-Tag und kein window.jspdf -> die 93 KB werden gespart
  expect(await page.locator('script[src*="jspdf"]').count()).toBe(0)
  expect(await page.evaluate(() => typeof window.jspdf)).toBe('undefined')
})

test('Firmen-Dashboard lädt jsPDF ebenfalls nicht vorab', async ({ page }) => {
  await setupDashboard(page.context(), { user: FIRMA, db: defaultDb({ profiles: [profilZeile(FIRMA)] }) })
  await page.goto('/dashboard-firma.html')
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })

  expect(await page.evaluate(() => typeof window.jspdf)).toBe('undefined')
})

test('Lebenslauf-Vorschau lädt jsPDF bei Bedarf nach und erzeugt ein PDF', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: defaultDb({ profiles: [schuelerMitLebenslauf()] }) })
  // Für diesen Test das CDN wieder zulassen (sonst kann nichts nachgeladen werden)
  await page.context().route(/cdnjs\.cloudflare\.com/, r => r.continue())

  await page.goto('/lebenslauf.html')
  await expect(page.locator('.ll-karte').first()).toBeVisible({ timeout: 30_000 })

  // Die Vorschau erzeugt ein echtes PDF -> jsPDF muss nachgeladen worden sein
  await expect.poll(() => page.evaluate(() => typeof window.jspdf), { timeout: 30_000 }).toBe('object')
  await expect(page.locator('#vorschau-seiten canvas, #vorschau-seiten .ll-a4').first())
    .toBeVisible({ timeout: 30_000 })
})
