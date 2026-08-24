// Merkliste: Was passiert, wenn das Speichern scheitert?
//
// Anlass (Durchsicht am 24.8.): Die Erfolgsmeldung lief unabhängig davon,
// ob das Merken geklappt hatte – und sagte dabei das GEGENTEIL. Wer auf
// das Herz tippte und dessen Speichern fehlschlug, las "Job entfernt".
// Umgekehrt las man beim gescheiterten Entfernen "Job gemerkt ❤".
// Der Fehler selbst wurde nie erwähnt.
//
// Gegen den alten Code geprüft: Von diesen vier Tests fällt genau EINER
// um - der erste. Das Herz blieb auch vorher schon korrekt ungefüllt;
// falsch war allein die Meldung darunter.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, warteAufDashboard } = require('./helpers/supabase-fake')

const HOST = 'blufrvuskqiloslyxjkx.supabase.co'

function db() {
  return defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] })
}

async function oeffneDashboard(page, datenbank) {
  await setupDashboard(page.context(), { user: SCHUELER, db: datenbank })
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
  await expect(page.locator('.merken-btn').first()).toBeVisible({ timeout: 20_000 })
}

test('gescheitertes Merken meldet den Fehler statt eines Erfolgs', async ({ page }) => {
  const d = db()
  await oeffneDashboard(page, d)

  await page.route(`https://${HOST}/rest/v1/gemerkte_jobs*`, route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 500, contentType: 'application/json',
        body: JSON.stringify({ message: 'kaputt' }) })
    }
    return route.fallback()
  })

  const herz = page.locator('.merken-btn').first()
  await herz.click()

  const meldung = page.locator('.toast').first()
  await expect(meldung).toBeVisible({ timeout: 10_000 })
  const text = await meldung.textContent()

  // Vorher stand hier "Job entfernt" – das Gegenteil dessen, was der
  // Nutzer wollte, und ohne jeden Hinweis auf das Problem.
  expect(text).not.toContain('Job entfernt')
  expect(text).not.toContain('Job gemerkt')
  expect(text.toLowerCase()).toMatch(/nicht geklappt|verbindung|berechtigung/)
})

// Absicherung, kein Fehlerbeleg: Das machte schon der alte Code richtig -
// nur die MELDUNG log. Der Test haelt fest, dass beides zusammenpasst.
test('gescheitertes Merken lässt das Herz ungefüllt', async ({ page }) => {
  const d = db()
  await oeffneDashboard(page, d)

  await page.route(`https://${HOST}/rest/v1/gemerkte_jobs*`, route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 500, contentType: 'application/json',
        body: JSON.stringify({ message: 'kaputt' }) })
    }
    return route.fallback()
  })

  const herz = page.locator('.merken-btn').first()
  await herz.click()
  await page.waitForTimeout(1200)

  // Das Herz darf nicht gefüllt aussehen, wenn nichts gespeichert wurde.
  await expect(herz).not.toHaveClass(/gemerkt/)
  await expect(herz).toBeEnabled()
})

test('erfolgreiches Merken meldet Erfolg und füllt das Herz', async ({ page }) => {
  // Gegenprobe: Im Normalfall soll alles wie bisher funktionieren.
  const d = db()
  await oeffneDashboard(page, d)

  const herz = page.locator('.merken-btn').first()
  await herz.click()

  await expect(page.locator('.toast').filter({ hasText: /gemerkt/i }).first())
    .toBeVisible({ timeout: 10_000 })
  await expect(herz).toHaveClass(/gemerkt/)
  await expect.poll(() => (d.gemerkte_jobs || []).length, { timeout: 10_000 }).toBe(1)
})

test('Entfernen aus der Merkliste funktioniert', async ({ page }) => {
  const d = db()
  d.gemerkte_jobs = [{ schueler_id: SCHUELER.id, job_id: d.jobs[0].id }]
  await oeffneDashboard(page, d)

  const herz = page.locator(`.merken-btn[data-merken="${d.jobs[0].id}"]`)
  await expect(herz).toHaveClass(/gemerkt/)
  await herz.click()

  await expect(page.locator('.toast').filter({ hasText: /entfernt/i }).first())
    .toBeVisible({ timeout: 10_000 })
  await expect(herz).not.toHaveClass(/gemerkt/)
  await expect.poll(() => (d.gemerkte_jobs || []).length, { timeout: 10_000 }).toBe(0)
})
