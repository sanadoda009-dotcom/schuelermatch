// Zahlen, die sich ändern, brauchen ein Datum und eine Quelle (9.9.2026).
//
// DER BEFUND: Der Ratgeber nennt genau eine harte Geldzahl als geltendes
// Recht — `ferienjob.html`:
//
//   „Dafür hast du Anspruch auf den gesetzlichen Mindestlohn von
//    13,90 € pro Stunde."
//
// Ohne Datum, ohne Quelle. Der Mindestlohn wird regelmäßig angepasst;
// eine solche Zahl altert still. Ein Schüler, der sie liest, hat keine
// Möglichkeit zu erkennen, ob sie noch gilt — und ausgerechnet er würde
// sie gegenüber einem Arbeitgeber anführen.
//
// Das Projekt kann es besser, und zwar an genau einer Stelle:
// `js/ferien.js` hat `STAND = 'August 2026'` und `QUELLE` mit Link. Nur
// im HTML gab es diese Gewohnheit nirgends — geprüft über alle 30 Seiten,
// „Stand:" kam kein einziges Mal vor.
//
// WICHTIG: Hier wird NICHT behauptet, die Zahl sei falsch. Geprüft wird,
// dass sie überprüfbar ist — mit einem Datum, das sagt, wann sie zuletzt
// nachgetragen wurde, und einer Quelle, bei der die aktuelle Höhe steht.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const SEITEN = fs.readdirSync(WURZEL).filter(f => f.endsWith('.html'))

// Sätze, die einen Geldbetrag als GELTENDES RECHT nennen. Ein
// Erfahrungswert („übliche Löhne: 12–14 €") ist etwas anderes und braucht
// kein Datum — der ändert sich nicht per Gesetz zu einem Stichtag.
function rechtsBetraege(html) {
  const treffer = []
  // Erst „Mindestlohn" finden, dann im Umfeld nach einem Betrag sehen.
  // Ein Muster, das direkt beides greift, scheiterte an den <b>-Tags
  // dazwischen - der Wächter „sonst prüft der Test nichts" hat es
  // gefangen, sonst wären drei Tests leer durchgelaufen.
  for (const m of html.matchAll(/Mindestlohn/g)) {
    const umfeld = html.slice(m.index, m.index + 220)
    const betrag = umfeld.match(/(\d{1,2},\d{2})\s*(?:€|Euro)/)
    if (betrag) treffer.push({ betrag: betrag[1], stelle: m.index })
  }
  return treffer
}

test('irgendwo steht überhaupt so eine Zahl — sonst prüft der Test nichts', async () => {
  const gesamt = SEITEN.reduce(
    (n, f) => n + rechtsBetraege(fs.readFileSync(path.join(WURZEL, f), 'utf8')).length, 0)
  expect(gesamt).toBeGreaterThan(0)
})

test('jeder gesetzliche Betrag nennt seinen Stand', async () => {
  const ohneStand = []
  for (const datei of SEITEN) {
    const html = fs.readFileSync(path.join(WURZEL, datei), 'utf8')
    for (const t of rechtsBetraege(html)) {
      // Im selben Absatz, nicht irgendwo auf der Seite.
      const umfeld = html.slice(t.stelle, t.stelle + 700)
      if (!/Stand dieser Angabe/.test(umfeld)) {
        ohneStand.push(`${datei}: ${t.betrag} €`)
      }
    }
  }
  expect(ohneStand,
    'Diese Beträge stehen als geltendes Recht da, ohne zu sagen, wann sie '
    + 'zuletzt geprüft wurden — sie altern still').toEqual([])
})

test('und eine Quelle, bei der die aktuelle Höhe steht', async () => {
  const ohneQuelle = []
  for (const datei of SEITEN) {
    const html = fs.readFileSync(path.join(WURZEL, datei), 'utf8')
    for (const t of rechtsBetraege(html)) {
      const umfeld = html.slice(t.stelle, t.stelle + 700)
      if (!/<a[^>]+href="https?:\/\//.test(umfeld)) {
        ohneQuelle.push(`${datei}: ${t.betrag} €`)
      }
    }
  }
  expect(ohneQuelle,
    'Ohne Quelle kann niemand nachsehen, ob der Betrag noch stimmt')
    .toEqual([])
})

test('alle Seiten nennen denselben Betrag', async () => {
  // Zwei Seiten mit zwei Zahlen wären schlimmer als eine veraltete: Dann
  // widerspricht die Seite sich selbst, und niemand weiß, welcher gilt.
  const betraege = new Map()
  for (const datei of SEITEN) {
    const html = fs.readFileSync(path.join(WURZEL, datei), 'utf8')
    for (const t of rechtsBetraege(html)) {
      if (!betraege.has(t.betrag)) betraege.set(t.betrag, [])
      betraege.get(t.betrag).push(datei)
    }
  }
  expect([...betraege.keys()],
    `verschiedene Mindestlohn-Angaben: ${JSON.stringify([...betraege])}`)
    .toHaveLength(1)
})

test('die Ferien-Daten machen es weiter vor', async () => {
  // Das Vorbild für diese Runde — und zugleich der Wächter dagegen, dass
  // jemand STAND oder QUELLE dort herausnimmt.
  const ferien = fs.readFileSync(path.join(WURZEL, 'js', 'ferien.js'), 'utf8')
  expect(ferien).toMatch(/export const STAND = '/)
  expect(ferien).toMatch(/export const QUELLE = 'https?:\/\//)
})
