// Warnhinweise im Chat (26.8.).
//
// Im Chat schreibt ein Minderjähriger mit einem fremden Erwachsenen.
// Seit dem 22.8. gibt es Hinweise bei Kontaktdaten, Geldforderungen und
// Treffen unter vier Augen — geprüft wurde die Erkennung aber nie: Sie
// steckte in `js/chat.js` hinter einem Supabase-Import und lief in
// keinem Test.
//
// Beim Herausziehen kamen zwei Befunde heraus:
//
//   1. E-MAIL-ADRESSEN wurden gar nicht erkannt. Dabei ist „schreib mir
//      an max@gmail.com" der häufigste Weg, den geschützten Chat zu
//      verlassen.
//   2. FEHLALARM bei Terminabsprachen. Vor dem Suchen nach einer
//      Ziffernfolge werden Leerzeichen entfernt — aus „am 12 03 2026"
//      wurde damit „12032026", und eine harmlose Absprache bekam eine
//      Warnung wegen Kontaktdaten. (Punkte werden bewusst nicht
//      entfernt, an „12.03.2026" hatte jemand gedacht — an die
//      Schreibweise mit Leerzeichen nicht.)
//
// Die Grundhaltung bleibt zurückhaltend: Eine Warnung, die bei jeder
// Terminabsprache aufpoppt, liest nach drei Tagen niemand mehr.
const { test, expect } = require('./helpers/basis')

async function warnung(page, text) {
  return page.evaluate(async t => {
    const m = await import('/js/chat-warnung.js')
    return m.warnungFuer(t)
  }, text)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html')
})

test.describe('Kontaktdaten', () => {
  test('eine E-Mail-Adresse wird erkannt', async ({ page }) => {
    expect(await warnung(page, 'Schreib mir einfach an max.mueller@gmail.com'), )
      .toBe('kontakt')
  })

  test('auch mitten im Satz und ohne Leerzeichen davor', async ({ page }) => {
    expect(await warnung(page, 'meld dich:chef@firma-mueller.de danke')).toBe('kontakt')
  })

  test('eine Handynummer wird erkannt', async ({ page }) => {
    expect(await warnung(page, 'Ruf mich an: 0176 12345678')).toBe('kontakt')
  })

  test('auch mit Bindestrichen und Klammern', async ({ page }) => {
    expect(await warnung(page, 'Meine Nummer: (0176) 123-45678')).toBe('kontakt')
  })

  test('andere Messenger werden erkannt', async ({ page }) => {
    for (const wort of ['WhatsApp', 'Telegram', 'Snapchat', 'Instagram', 'Discord']) {
      expect(await warnung(page, `Lass uns lieber über ${wort} schreiben`), wort).toBe('kontakt')
    }
  })
})

test.describe('kein Fehlalarm bei harmlosen Nachrichten', () => {
  // Der wichtigste Teil. Wer ständig gewarnt wird, liest nicht mehr.
  const HARMLOS = [
    'Hallo, ich interessiere mich für die Stelle.',
    'Passt dir Montag um 15 Uhr?',
    'Ich kann am 12.03.2026 anfangen.',
    'Ich kann am 12 03 2026 anfangen.',          // ohne Punkte geschrieben
    'Geht auch 14 30 statt 15 00?',
    'Ich verdiene gerne 12 Euro die Stunde.',
    'Wir haben 2026 schon zwei Aushilfen eingestellt.',
    'Die Schicht geht von 9 bis 17 Uhr.',
    'Ich bin in der 9. Klasse und 15 Jahre alt.',
  ]

  for (const text of HARMLOS) {
    test(`keine Warnung: „${text.slice(0, 38)}…"`, async ({ page }) => {
      expect(await warnung(page, text), 'Fehlalarm').toBeNull()
    })
  }
})

test.describe('Geld', () => {
  test('Vorkasse wird erkannt', async ({ page }) => {
    expect(await warnung(page, 'Du musst nur 20 Euro Anzahlung leisten')).toBe('geld')
  })

  test('auch Umlaute im Suchwort', async ({ page }) => {
    // Wortgrenzen greifen in JavaScript vor ü/ä/ö nicht — deshalb sind
    // diese Muster bewusst ohne \b geschrieben.
    expect(await warnung(page, 'Bitte eine kleine Gebühr überweisen')).toBe('geld')
  })

  test('Gutscheinkarten sind ein klassischer Betrug', async ({ page }) => {
    expect(await warnung(page, 'Kauf bitte einen Amazon-Gutschein')).toBe('geld')
  })
})

test.describe('Treffen unter vier Augen', () => {
  test('Einladung in die Wohnung wird erkannt', async ({ page }) => {
    expect(await warnung(page, 'Komm einfach zu mir nach Hause')).toBe('treffen')
  })

  test('„komm allein" wird erkannt', async ({ page }) => {
    expect(await warnung(page, 'Und komm allein, ja?')).toBe('treffen')
  })

  test('ein normaler Treffpunkt löst nichts aus', async ({ page }) => {
    expect(await warnung(page, 'Wir treffen uns im Laden in der Hauptstraße')).toBeNull()
  })
})

test('die Warnung erscheint nur an fremden Nachrichten', async ({ page }) => {
  // Sich selbst vor der eigenen Nachricht zu warnen wäre sinnlos —
  // die Prüfung sitzt in chat.js an `fremd`.
  const quelle = await page.evaluate(async () => (await fetch('/js/chat.js')).text())
  expect(quelle).toMatch(/fremd \? warnungHtml/)
})

test('jede Warnart hat einen Text', async ({ page }) => {
  const fehlt = await page.evaluate(async () => {
    const m = await import('/js/chat-warnung.js')
    return ['kontakt', 'geld', 'treffen'].filter(a => !m.WARN_TEXT[a])
  })
  expect(fehlt).toEqual([])
})
