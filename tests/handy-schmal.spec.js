// Dashboards auf schmalen Handys: 360 und 375 Pixel (13.9.2026).
//
// Beim Durchfotografieren der Fenster und Dialoge auf 360px gefunden:
//
//   1. KOPFZEILE: Auf 360 und 375px – gängige iPhone-Breiten – brach
//      „Logout" in eine zweite Zeile, die Kopfzeile wurde 120 statt 80px
//      hoch. Es fehlte ein Pixel (Knöpfe und Logo 328px + Rand 48px).
//   2. CHAT DES SCHÜLERS: Das Eingabefeld lag unter dem Bildschirmrand –
//      gemessen auf 360 × 760 mit Unterkante bei 833px. Der Verlauf war
//      fest 380px hoch, darüber Überschrift, Chat-Kopf, Sicherheitshinweis.
//   3. Die Silbentrennung machte aus „← Zurück" drei Zeilen „Zu-rück".

const { test, expect, setupDashboard, defaultDb, profilZeile, warteAufDashboard, SCHUELER, FIRMA } =
  require('./helpers/supabase-fake')

const zeilen = el => {
  const r = document.createRange()
  r.selectNodeContents(el)
  return new Set([...r.getClientRects()].map(k => Math.round(k.top))).size
}

for (const [rolle, user, url] of [['Schüler', SCHUELER, '/dashboard-schueler.html'], ['Firma', FIRMA, '/dashboard-firma.html']]) {
  for (const breite of [360, 375]) {
    test(`${rolle}, ${breite}px: die Kopfzeile bleibt einzeilig`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 760 })
      await setupDashboard(page.context(), { user })
      await page.goto(url)
      await warteAufDashboard(page)
      const m = await page.evaluate(() => {
        const tops = ['#sidebar-toggle', '.logo', '#glocke-btn', '#logout-btn']
          .map(s => document.querySelector(s).getBoundingClientRect())
        return {
          hoehe: Math.round(document.querySelector('nav').getBoundingClientRect().height),
          reihen: new Set(tops.map(r => Math.round(r.top + r.height / 2) >> 3)).size,
          logout: Math.round(document.querySelector('#logout-btn').getBoundingClientRect().height),
        }
      })
      expect(m.hoehe, 'Kopfzeile umgebrochen').toBeLessThan(100)
      // 44px wie überall im Projekt. Die erste Fassung der Korrektur machte
      // den Knopf in dieser Desktop-Messung 39px hoch – diese Zeile hat es
      // gefangen. (Auf dem emulierten Android-Gerät waren es 44px; die
      // Mindesthöhe sitzt jetzt trotzdem fest.)
      expect(m.logout, 'Logout groß genug zum Tippen').toBeGreaterThanOrEqual(44)
    })
  }
}

for (const [breite, hoehe] of [[360, 640], [360, 760], [375, 667]]) {
  test(`Chat auf ${breite} × ${hoehe}: das Eingabefeld ist im Bild`, async ({ page }) => {
    await page.setViewportSize({ width: breite, height: hoehe })
    const db = defaultDb({
      profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)],
      bewerbungen: [{ id: 'bw-1', job_id: 'aaaaaaaa-0000-4000-8000-000000000002', schueler_id: SCHUELER.id,
        status: 'angenommen', erstellt_am: '2026-09-10T10:00:00Z' }],
      nachrichten: Array.from({ length: 8 }, (_, i) => ({ id: 'n' + i, bewerbung_id: 'bw-1',
        absender_id: i % 2 ? SCHUELER.id : FIRMA.id, text: 'Nachricht ' + i, gelesen: true,
        erstellt_am: `2026-09-11T1${i}:00:00Z` })),
    })
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await page.evaluate(() => document.querySelector('.sidebar-item[data-view="nachrichten"]').click())
    await page.locator('#view-nachrichten').getByText('Chat öffnen').first().click()
    await expect(page.locator('.chat-input')).toBeAttached({ timeout: 20_000 })
    await page.waitForTimeout(800)

    const m = await page.evaluate(fn => {
      const z = new Function('return ' + fn)()
      return {
        inputUnten: Math.round(document.querySelector('.chat-input').getBoundingClientRect().bottom),
        vh: innerHeight,
        zurueck: z(document.querySelector('.chat-kopf .zurueck')),
      }
    }, zeilen.toString())
    expect(m.inputUnten, `Eingabefeld endet bei ${m.inputUnten}px, Bildschirm ist ${m.vh}px hoch`)
      .toBeLessThanOrEqual(m.vh)
    expect(m.zurueck, '„← Zurück" umgebrochen').toBe(1)
  })
}
