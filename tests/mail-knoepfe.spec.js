// Lesbarkeit der Knöpfe in den automatischen E-Mails (26.8.).
//
// Zwei Probleme steckten in derselben Zeile:
//
//   background:linear-gradient(120deg,#00c896,#2b2f8f);color:#fff
//
// 1. KONTRAST. Weiße Schrift auf #00c896 kommt auf 2,16:1. Am grünen
//    Ende des Verlaufs war der Knopftext also kaum zu lesen — genau der
//    Befund, der am selben Tag schon die Web-Knöpfe betraf.
//
// 2. OUTLOOK KENNT KEINE CSS-VERLÄUFE. Sein Renderer stammt aus Word.
//    Die Kurzform `background:` mit einem Verlauf als einzigem Wert ist
//    für ihn ungültig und fällt komplett weg — übrig bleibt weiße
//    Schrift auf weißem Grund. Der Knopf war dort schlicht UNSICHTBAR.
//
// Betroffen waren drei Mails, darunter die Zusage — die wichtigste, die
// diese Seite überhaupt verschickt.
//
// Behoben mit `background-color` als deckendem Rückfall plus
// `background-image` für den Verlauf. Wer Verläufe kann, sieht sie; alle
// anderen sehen eine dunkle Fläche mit lesbarer Schrift.
//
// Dieser Test liest die Edge Functions als Quelltext. Ausführen lassen
// sie sich hier nicht (Deno, Datenbank, Resend), aber genau diese
// Fehlerklasse ist am Text erkennbar.
const { test, expect } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const FUNKTIONEN = path.join(__dirname, '..', 'supabase', 'functions')

// WCAG AA für normalen Text. Knopfschrift in diesen Mails ist ~15px.
const NOETIG = 4.5

function kontrast(vorne, hinten) {
  const lum = h => {
    const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const a = lum(vorne), b = lum(hinten)
  return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05))).toFixed(2)
}

function dateien() {
  return fs.readdirSync(FUNKTIONEN)
    .map(d => [d, path.join(FUNKTIONEN, d, 'index.ts')])
    .filter(([, p]) => fs.existsSync(p))
}

test('kein Knopf verlässt sich allein auf einen Farbverlauf', () => {
  // Der Kern: `background:` mit einem Verlauf als einzigem Wert.
  const fehler = []
  for (const [name, p] of dateien()) {
    const quelle = fs.readFileSync(p, 'utf8')
    const treffer = quelle.match(/background:\s*linear-gradient\([^)]*\)/g) || []
    for (const t of treffer) fehler.push(`${name}: ${t}`)
  }
  expect(fehler,
    'In Outlook fällt diese Kurzform ersatzlos weg. Statt dessen ' +
    'background-color (deckend) plus background-image (Verlauf) verwenden: ' +
    fehler.join(' | ')
  ).toEqual([])
})

test('jeder Knopf mit weißer Schrift hat einen dunklen Rückfall', () => {
  const schlecht = []
  for (const [name, p] of dateien()) {
    const quelle = fs.readFileSync(p, 'utf8')

    // Alle Stellen mit weißer Schrift auf gesetztem Hintergrund.
    const muster = /background-color:\s*(#[0-9a-fA-F]{6})[^"']*?color:\s*#fff\b/g
    let m
    let gefunden = 0
    while ((m = muster.exec(quelle)) !== null) {
      gefunden++
      const wert = kontrast('#ffffff', m[1].toLowerCase())
      if (wert < NOETIG) schlecht.push(`${name}: weiß auf ${m[1]} = ${wert}:1`)
    }

    // Auch die einfache Form ohne Verlauf prüfen.
    const muster2 = /background:\s*(#[0-9a-fA-F]{6});\s*color:\s*#fff\b/g
    while ((m = muster2.exec(quelle)) !== null) {
      gefunden++
      const wert = kontrast('#ffffff', m[1].toLowerCase())
      if (wert < NOETIG) schlecht.push(`${name}: weiß auf ${m[1]} = ${wert}:1`)
    }

    expect(gefunden, `${name}: keine Knöpfe gefunden — Suchmuster veraltet?`)
      .toBeGreaterThan(0)
  }
  expect(schlecht, 'zu blasse Knöpfe: ' + schlecht.join(' | ')).toEqual([])
})

test('wo ein Verlauf steht, ist auch sein Anfang dunkel genug', () => {
  // Clients, die Verläufe können, zeigen die ERSTE Farbe am linken Rand.
  // Steht dort das helle Marken-Grün, ist der Knopftext dort unlesbar,
  // auch wenn der Rückfall stimmt.
  const schlecht = []
  for (const [name, p] of dateien()) {
    const quelle = fs.readFileSync(p, 'utf8')
    const muster = /background-image:\s*linear-gradient\([^,]+,\s*(#[0-9a-fA-F]{6})[^)]*\)([^"']*color:\s*#fff\b)?/g
    let m
    while ((m = muster.exec(quelle)) !== null) {
      if (!m[2]) continue          // kein Text darauf, z.B. der Zierbalken
      const wert = kontrast('#ffffff', m[1].toLowerCase())
      if (wert < NOETIG) schlecht.push(`${name}: Verlauf beginnt bei ${m[1]} = ${wert}:1`)
    }
  }
  expect(schlecht, schlecht.join(' | ')).toEqual([])
})

test('alle Nutzerwerte in den Mails werden escaped', () => {
  // Job-Titel und Namen schreiben Nutzer selbst. Ohne Escaping wäre das
  // eine Einladung, Links in fremde Postfächer zu schreiben.
  for (const [name, p] of dateien()) {
    const quelle = fs.readFileSync(p, 'utf8')
    expect(quelle, `${name} hat keine esc()-Funktion`).toMatch(/function esc\(/)
  }
})

test('jede Mail nennt einen Weg, sie abzubestellen oder umzustellen', () => {
  // Ohne das landen automatische Mails schneller im Spam-Ordner — und
  // es ist schlicht anständig.
  for (const [name, p] of dateien()) {
    const quelle = fs.readFileSync(p, 'utf8')
    expect(quelle, `${name}: kein Hinweis zum Abbestellen oder Umstellen`)
      .toMatch(/abbestellen|Einstellungen änderst du|kannst du auf|umstellen/i)
  }
})
