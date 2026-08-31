// Lesbarkeit aller Texte (26.8.).
//
// Die Lücke, die diese Datei schließt: Alle bisherigen Prüfungen fragen,
// ob Elemente DA, GROSS GENUG oder BEDIENBAR sind. Keine fragte, ob man
// den Text lesen kann. Farbe fiel durch das Raster - über Monate.
//
// Was die erste Messung zutage förderte:
//   ~48 Stellen  Marken-Grün (#00a87d) als Fließtextfarbe:  2,9-3,0:1
//    6 Stellen   Warnfarbe (#ff6b4a) als Schrift:           2,7-2,8:1
//    4 Stellen   grüne Schrift auf grünem Knopf:            1,77:1
//    1 Stelle    Passwort-Anzeige "Okay" bei Registrierung: 1,86:1
// Nötig sind 4,5:1 (WCAG AA), bei großem Text 3:1.
//
// Behoben wurde das an den Farb-Token, nicht an den einzelnen Regeln:
// --match-green-dark und --coral wurden abgedunkelt. Die Markenfarbe
// --match-green (#00c896) blieb unangetastet - sie steht auf Flächen,
// im Logo und auf dunklem Grund, wo sie richtig ist.
//
// Die Messung selbst steckt in helpers/kontrast.js; dort ist auch
// beschrieben, warum das Ermitteln des echten Hintergrunds der schwierige
// Teil ist (zwei Fehlalarme beim Bauen).
const { test, expect, setupDashboard, SCHUELER, FIRMA, warteAufDashboard } = require('./helpers/supabase-fake')
const { MESSUNG } = require('./helpers/kontrast')

test.describe('öffentliche Seiten', () => {
  for (const [name, pfad] of [
    ['Startseite', '/index.html'],
    ['Jobbörse', '/jobs.html'],
    ['Job-Detail', '/job.html?id=aaaaaaaa-0000-4000-8000-000000000001'],
    ['Ferienjob', '/ferienjob.html'],
    ['Fairer Lohn', '/fairer-lohn.html'],
    ['Taschengeld', '/taschengeld.html'],
    ['Gesundheitszeugnis', '/gesundheitszeugnis.html'],
    ['Arbeitsvertrag', '/arbeitsvertrag.html'],
    ['Bewerbungsfoto', '/bewerbungsfoto.html'],
    ['Ratgeber', '/ratgeber.html'],
    ['Jobideen', '/jobideen.html'],
    ['Jugendarbeitsschutz', '/jugendarbeitsschutz.html'],
    ['Für Eltern', '/eltern.html'],
    ['Für Arbeitgeber', '/fuer-firmen.html'],
    ['Job-Finder', '/job-finder.html'],
    ['Login', '/login.html'],
    ['Registrierung', '/register.html'],
    ['Job-Alarm abbestellen', '/job-alarm-aus.html'],
  ]) {
    test(`Texte sind lesbar: ${name}`, async ({ page }) => {
      await setupDashboard(page.context(), {})
      await page.goto(pfad)
      await page.waitForTimeout(800)
      expect(await page.evaluate(MESSUNG)).toEqual([])
    })
  }
})

test.describe('eingeloggte Bereiche', () => {
  test('Texte sind lesbar: Schüler-Dashboard', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await page.waitForTimeout(1500)
    expect(await page.evaluate(MESSUNG)).toEqual([])
  })

  test('Texte sind lesbar: Firmen-Dashboard', async ({ page }) => {
    await setupDashboard(page.context(), { user: FIRMA })
    await page.goto('/dashboard-firma.html')
    await page.waitForTimeout(2500)
    expect(await page.evaluate(MESSUNG)).toEqual([])
  })
})

// Die Passwort-Anzeige erscheint erst beim Tippen - sie wäre der Messung
// oben entgangen. Sie war der schlechteste Einzelwert überhaupt (1,86:1
// für "Okay"), deshalb hier gezielt.
test('Texte sind lesbar: Passwort-Anzeige bei der Registrierung', async ({ page }) => {
  await setupDashboard(page.context(), {})
  await page.goto('/register.html')
  for (const pw of ['abc', 'abcdefghij', 'Abcdefghij1!']) {
    await page.fill('#reg-password', pw)
    await page.waitForTimeout(150)
    expect(await page.evaluate(MESSUNG), `Passwort "${pw}"`).toEqual([])
  }
})
