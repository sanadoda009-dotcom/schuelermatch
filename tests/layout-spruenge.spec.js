// Layout-Sprünge (CLS): Springt der Inhalt beim Laden unter dem Finger weg?
//
// Anlass (Messung am 24.8.): Die Job-Detailseite sprang um 0,12 und das
// Schüler-Dashboard um 0,14 — beides deutlich über Googles Schwelle von 0,1
// für "gut". Ursache war NICHT, wie zuerst vermutet, fehlende Bildgrößen
// (alle Bilder haben feste Maße per CSS), sondern nachgeladener Inhalt in
// Bereichen, für die vorher kein Platz reserviert war.
//
// Dieser Test hält die Grenze. Er misst echte Layout-Verschiebungen im
// Browser, nicht Vermutungen über das Markup.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA } = require('./helpers/supabase-fake')

// Googles Schwellenwert für "gut". Darüber merkt man das Springen.
const GRENZE = 0.1

const BEOBACHTER = `
  window.__cls = 0;
  new PerformanceObserver(liste => {
    for (const e of liste.getEntries()) {
      if (!e.hadRecentInput) window.__cls += e.value
    }
  }).observe({ type: 'layout-shift', buffered: true });
`

async function sprung(page, pfad, wartezeit) {
  await page.addInitScript(BEOBACHTER)
  await page.goto(pfad)
  await page.waitForTimeout(wartezeit)
  return page.evaluate(() => Math.round(window.__cls * 10000) / 10000)
}

for (const [name, pfad] of [
  ['Startseite', '/index.html'],
  ['Jobbörse', '/jobs.html'],
  ['Job-Detail', '/job.html?id=aaaaaaaa-0000-4000-8000-000000000001'],
  ['Login', '/login.html'],
  ['Registrierung', '/register.html'],
]) {
  test(`springt nicht: ${name}`, async ({ page }) => {
    await setupDashboard(page.context(), {})
    const wert = await sprung(page, pfad, 2500)
    expect(wert, `Layout-Sprung auf ${name}`).toBeLessThan(GRENZE)
  })
}

test('springt nicht: Schüler-Dashboard', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER,
    db: defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] }) })
  const wert = await sprung(page, '/dashboard-schueler.html', 4000)
  expect(wert, 'Layout-Sprung im Schüler-Dashboard').toBeLessThan(GRENZE)
})

test('springt nicht: Firmen-Dashboard', async ({ page }) => {
  await setupDashboard(page.context(), { user: FIRMA,
    db: defaultDb({ profiles: [profilZeile(FIRMA)] }) })
  const wert = await sprung(page, '/dashboard-firma.html', 4000)
  expect(wert, 'Layout-Sprung im Firmen-Dashboard').toBeLessThan(GRENZE)
})

test('die Statistik-Zeile reserviert ihren Platz', async ({ page }) => {
  // Das war der wirksamste Einzelfix: Der Kasten ist beim Laden leer und
  // wächst dann auf 96px – ohne Reservierung schob er die halbe Seite nach
  // unten. Fällt die Regel weg, kommt der Sprung zurück.
  await setupDashboard(page.context(), { user: SCHUELER,
    db: defaultDb({ profiles: [profilZeile(SCHUELER)] }) })
  await page.goto('/dashboard-schueler.html')
  const hoehe = await page.evaluate(() => {
    const el = document.getElementById('stats-row')
    return el ? parseFloat(getComputedStyle(el).minHeight) : 0
  })
  expect(hoehe).toBeGreaterThanOrEqual(96)
})
