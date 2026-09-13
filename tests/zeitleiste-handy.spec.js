// Die Zeitleiste einer Bewerbung auf dem Handy (13.9.2026).
//
// DER BEFUND, beim Durchfotografieren gefunden: Die drei Schritte
// „Eingereicht — Angesehen — Zusage!" standen nebeneinander. Schon auf
// 390px passte das nicht, auf 360px noch weniger: Der letzte Schritt
// brach um, die Verbindungslinien hingen lose am Zeilenende oder standen
// allein am Anfang der nächsten Zeile. Gemessen auf 360px: 2, 3 und 3
// Zeilen für drei Zeitleisten – keine davon ordentlich.
//
// Dazu rutschte von den drei Zahlen oben („Gesamt", „In Prüfung",
// „Zusagen") die dritte allein in eine zweite Reihe.
//
// Jetzt auf schmalen Bildschirmen senkrecht, jede Stufe eine Zeile mit
// kurzer Linie dazwischen. Am Rechner bleibt es nebeneinander.

const { test, expect, setupDashboard, defaultDb, profilZeile, warteAufDashboard, SCHUELER, FIRMA } =
  require('./helpers/supabase-fake')

const job = (id, titel) => ({ id, firma_id: FIRMA.id, firma_name: FIRMA.name, titel, beschreibung: 'x',
  ort: 'München', stundenlohn: 13, mindestalter: 15, kategorie: 'Gastronomie', arbeitszeit: 'Wochenende',
  aktiv: true, aufrufe: 1, erstellt_am: '2026-09-01T10:00:00Z', lat: 48.1, lon: 11.5, verfuegbarkeit: null })

async function ansicht(page, breite) {
  await page.setViewportSize({ width: breite, height: 900 })
  const db = defaultDb({
    jobs: [job('j1', 'Aushilfe Eistheke'), job('j2', 'Nachhilfe Mathe'), job('j3', 'Regale einräumen')],
    profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)],
    bewerbungen: [
      { id: 'b1', job_id: 'j1', schueler_id: SCHUELER.id, status: 'angenommen', erstellt_am: '2026-09-02T10:00:00Z',
        angesehen_am: '2026-09-03T10:00:00Z', entschieden_am: '2026-09-04T10:00:00Z' },
      { id: 'b2', job_id: 'j2', schueler_id: SCHUELER.id, status: 'ausstehend', erstellt_am: '2026-09-05T10:00:00Z',
        angesehen_am: null },
      { id: 'b3', job_id: 'j3', schueler_id: SCHUELER.id, status: 'abgelehnt', erstellt_am: '2026-09-01T10:00:00Z',
        angesehen_am: '2026-09-02T10:00:00Z', entschieden_am: '2026-09-06T10:00:00Z', absage_grund: 'zeit' },
    ],
  })
  await setupDashboard(page.context(), { user: SCHUELER, db })
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
  await page.evaluate(() => document.querySelector('.sidebar-item[data-view="bewerbungen"]').click())
  await expect(page.locator('.bew-card')).toHaveCount(3, { timeout: 20_000 })
}

// Für jede Zeitleiste: Auf wie vielen Zeilen stehen die drei Schritte,
// und steht jede Linie zwischen zwei Schritten statt am Rand?
async function vermessen(page) {
  return page.evaluate(() => [...document.querySelectorAll('.bew-timeline')].map(t => {
    const kinder = [...t.children].map(k => ({ linie: k.classList.contains('bew-linie'), r: k.getBoundingClientRect() }))
    const schritte = kinder.filter(k => !k.linie)
    const zeilen = new Set(schritte.map(s => Math.round(s.r.top))).size
    // Senkrecht: Jedes Kind beginnt unterhalb des vorigen.
    const untereinander = kinder.every((k, i) => i === 0 || k.r.top >= kinder[i - 1].r.bottom - 1)
    return { zeilen, untereinander }
  }))
}

test('auf dem Handy stehen die drei Schritte ordentlich untereinander', async ({ page }) => {
  await ansicht(page, 360)
  const m = await vermessen(page)
  expect(m.length).toBe(3)
  for (const z of m) {
    expect(z.zeilen, 'jeder Schritt eine eigene Zeile').toBe(3)
    expect(z.untereinander, 'Linien stehen zwischen den Schritten, nicht daneben').toBe(true)
  }
})

test('und die drei Zahlen passen in eine Reihe', async ({ page }) => {
  await ansicht(page, 360)
  const reihen = await page.evaluate(() =>
    new Set([...document.querySelectorAll('.bew-stats > div')].map(d => Math.round(d.getBoundingClientRect().top))).size)
  expect(reihen).toBe(1)
})

test('am Rechner bleibt die Zeitleiste nebeneinander', async ({ page }) => {
  await ansicht(page, 1280)
  for (const z of await vermessen(page)) expect(z.zeilen).toBe(1)
})
