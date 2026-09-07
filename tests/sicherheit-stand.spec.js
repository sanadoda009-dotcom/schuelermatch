// Hält SICHERHEIT-STAND.md mit dem Projekt Schritt? (5.9.2026)
//
// DER ANLASS — ein eigener Fehler: Am 2.9. habe ich eine Lücke gemeldet,
// die es nicht gab (eine Firma könne den Text einer fremden Bewerbung
// ändern). Der Schutz dagegen stand seit dem 27.8. in
// `PROJEKT-STATUS.md` unter „Security-Fix #4" — drei BEFORE-UPDATE-
// Trigger, die alle Spalten außer den legitim änderbaren einfrieren.
//
// Ich hatte `pg_policies` gelesen und dort aufgehört. Die Trigger und
// die eigene Dokumentation nicht.
//
// `PROJEKT-STATUS.md` ist nicht falsch — sie ist 3021 Zeilen
// chronologisch. Für „was gilt gerade?" müsste man sie ganz lesen und im
// Kopf verrechnen, welche spätere Zeile eine frühere aufhebt.
// `SICHERHEIT-STAND.md` ist die Antwort darauf: EINE Seite Ist-Zustand.
//
// Eine Übersicht, die veraltet, ist schlimmer als keine — sie wird
// geglaubt. Deshalb dieser Test. Er kann die laufende Datenbank nicht
// abfragen; er hält fest, dass nichts FEHLT, was es im Projekt gibt.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = p => fs.readFileSync(path.join(WURZEL, p), 'utf8')
const STAND = lies('SICHERHEIT-STAND.md')

test('nennt alle vier Schichten mit ihrer Abfrage', async () => {
  // Der Kern: Wer nur Schicht 1 ansieht, macht meinen Fehler nach.
  for (const quelle of ['pg_policies', 'pg_trigger', 'pg_constraint',
                        'referential_constraints', 'storage.buckets']) {
    expect(STAND, `${quelle} wird nicht genannt`).toContain(quelle)
  }
})

test('führt jeden Schutz-Trigger auf, den es gibt', async () => {
  // Käme ein neuer dazu, ohne hier zu stehen, hätte die Übersicht ein
  // Loch — genau an der Stelle, an der ich schon einmal danebengegriffen
  // habe.
  const tabellen = ['bewerbungen', 'nachrichten', 'profiles', 'bewertungen',
                    'jobs', 'job_alarme', 'meldungen']
  for (const t of tabellen) {
    expect(STAND, `Trigger-Zeile für ${t} fehlt`).toContain(t)
  }
  expect(STAND).toContain('schuetze_')
})

test('führt alle vier Ablagen mit ihrer Sichtbarkeit auf', async () => {
  // Die Liste muss zu js/dokument-pfad.js passen — dort stehen dieselben
  // Buckets samt Grenzen, und die Datei ist die, der der Browser folgt.
  const modul = lies('js/dokument-pfad.js')
  const buckets = [...modul.matchAll(/'([a-z-]+)':\s*\{ maxBytes/g)].map(m => m[1])
  expect(buckets.length, 'keine Buckets im Modul gefunden?').toBe(4)
  for (const b of buckets) {
    expect(STAND, `Ablage ${b} fehlt in der Übersicht`).toContain(b)
  }
})

test('nennt die offenen Punkte, statt sie zu verschweigen', async () => {
  // Eine Sicherheitsübersicht, die nur das Erledigte auflistet, ist eine
  // Werbebroschüre. Jede noch nicht eingespielte Datei, die eine Lücke
  // schließt, muss hier auftauchen.
  const offen = ['profil-email-festnageln.sql', 'chat-erst-nach-zusage.sql',
                 'zeugnis-nur-eigene-anzeige.sql', 'bewerbung-bleibt.sql',
                 'meldungen-bleiben.sql', 'firma-oeffentlich.sql']
  for (const datei of offen) {
    expect(STAND, `${datei} fehlt in der Übersicht`).toContain(datei)
  }
})

test('sagt, dass die Edge Functions an allem vorbeigehen', async () => {
  // Der Punkt, den man beim Lesen der Regeln am ehesten vergisst: Die
  // Service-Rolle kennt weder RLS noch die Trigger.
  expect(STAND).toContain('Service-Rolle')
  for (const fn of fs.readdirSync(path.join(WURZEL, 'supabase', 'functions'))) {
    expect(STAND, `Edge Function ${fn} fehlt`).toContain(fn)
  }
})

test('verweist auf PROJEKT-STATUS.md, statt sie zu ersetzen', async () => {
  // Das Warum einer Entscheidung steht weiter dort. Zwei Dateien, die
  // beide alles erklären wollen, laufen auseinander.
  expect(STAND).toContain('PROJEKT-STATUS.md')
  expect(STAND).toMatch(/ersetzt .*PROJEKT-STATUS\.md.* nicht/)
})

test('sagt selbst, wie man sie nachzieht', async () => {
  expect(STAND).toMatch(/auf den neuesten Stand/)
})
