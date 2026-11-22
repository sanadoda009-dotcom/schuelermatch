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

// Die Chat-Tests (2. und 3. oben) sind am 22.11.2026 entfallen: Den Chat
// gibt es nicht mehr.
