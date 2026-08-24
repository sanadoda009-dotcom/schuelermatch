// Zeichen im Lebenslauf-PDF.
//
// Anlass (Messung am 24.8.): Der PDF-Export nutzt die Standard-Schrift
// "helvetica". Die kennt nur westeuropäische Zeichen – alles darüber
// hinaus wurde nicht etwa weggelassen, sondern durch ein FALSCHES
// Zeichen ersetzt. Gemessen am echten Export:
//
//   Şeyma Çelik    ->  ^eyma Çelik
//   Łukasz         ->  Aukasz
//   Nguyễn         ->  NguyÅn
//   Дмитрий        ->  <8B@89
//   12 € pro Std   ->  12  pro Std      (Euro-Zeichen verschwand)
//
// Für eine Schülerplattform in Deutschland ist das nicht nebensächlich:
// Viele Schüler haben türkische, polnische, arabische oder russische
// Namen. Im wichtigsten Dokument ihrer Bewerbung stand dann ein
// entstellter Name.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER } = require('./helpers/supabase-fake')

// Prüft die Zeichen-Aufbereitung direkt. Kein Laden der PDF-Bibliothek
// nötig – der Test bleibt schnell und unabhängig vom Netz.
async function aufbereiten(page, texte) {
  return page.evaluate(async (liste) => {
    const { ohneEmojis } = await import('./js/pdf.js')
    return liste.map(t => ohneEmojis(t))
  }, texte)
}

test.beforeEach(async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER,
    db: defaultDb({ profiles: [profilZeile(SCHUELER)] }) })
  await page.goto('/lebenslauf.html')
  await page.waitForTimeout(1500)
})

test('deutsche Umlaute bleiben unverändert', async ({ page }) => {
  // Die kann die Standard-Schrift – hier darf nichts "repariert" werden.
  const [r] = await aufbereiten(page, ['Müller Öztürk Käse groß Weiß'])
  expect(r).toBe('Müller Öztürk Käse groß Weiß')
})

test('Namen mit Sonderbuchstaben bleiben lesbar', async ({ page }) => {
  const proben = {
    'Şeyma Çelik': 'Seyma Çelik',       // türkisch (Ç ist schon darstellbar)
    'Łukasz Wójcik': 'Lukasz Wójcik',   // polnisch
    'Ștefan Đorđe': 'Stefan Dorde',     // rumänisch / serbisch
    'Nguyễn Hương': 'Nguyen Huong',     // vietnamesisch
    'İnci Gökhan': 'Inci Gökhan',       // türkisches I
  }
  const ergebnis = await aufbereiten(page, Object.keys(proben))
  expect(ergebnis).toEqual(Object.values(proben))
})

test('kyrillische Namen werden umgeschrieben statt zerstört', async ({ page }) => {
  const [r] = await aufbereiten(page, ['Дмитрий'])
  // Ein lesbares "Dmitrij" ist besser als die Zeichenfolge "<8B@89".
  expect(r).toBe('Dmitrij')
  expect(r).toMatch(/^[A-Za-z]+$/)
})

test('Euro-Zeichen verschwindet nicht', async ({ page }) => {
  const [r] = await aufbereiten(page, ['12 € pro Stunde'])
  expect(r).toContain('EUR')
  expect(r).not.toBe('12  pro Stunde')
})

test('typografische Zeichen werden ersetzt, nicht verschluckt', async ({ page }) => {
  const [anfuehrung, strich, punkte] = await aufbereiten(page,
    ['„Zitat“', 'Wort – Wort', 'und so weiter…'])
  expect(anfuehrung).toBe('"Zitat"')
  expect(strich).toBe('Wort - Wort')
  expect(punkte).toBe('und so weiter...')
})

test('Emojis werden entfernt', async ({ page }) => {
  // Die Standard-Schrift hat keine Emojis; sie würden als Müll erscheinen.
  const [r] = await aufbereiten(page, ['😀 Sehr motiviert! 🚀'])
  expect(r).toBe('Sehr motiviert!')
})

test('nicht darstellbare Schriften erzeugen keinen Zeichenmüll', async ({ page }) => {
  // Arabisch kann die Standard-Schrift nicht, und eine Umschrift wäre
  // hier unzuverlässig. Dann lieber nichts als eine falsche Zeichenfolge.
  const [r] = await aufbereiten(page, ['محمد Ahmed'])
  expect(r).toBe('Ahmed')
})
