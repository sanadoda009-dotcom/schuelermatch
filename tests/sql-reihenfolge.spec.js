// Halten die wartenden SQL-Dateien zusammen? (5.9.2026)
//
// DER ANLASS: Es sind zehn geworden. Zehn Dateien, die jemand von Hand
// im Supabase-Editor ausführt, sind schon ohne verdeckte Abhängigkeiten
// eine Zumutung — mit einer wäre es eine Fehlersuche mitten in der
// Datenbank. Also nachgesehen, statt es zu hoffen:
//
//   Jede Datei, die eine NEUE Spalte benutzt, legt sie auch selbst an.
//   `bewerbung-stand.sql`  → angesehen_am, entschieden_am, absage_grund
//   `bewerbung-bleibt.sql` → job_titel
//   alle übrigen           → keine neuen Spalten
//
// Also gibt es keine Reihenfolge, die man einhalten müsste. Dieser Test
// hält das fest — schreibe ich künftig eine Datei, die sich auf eine
// Spalte aus einer anderen stützt, fällt es hier auf und nicht bei Sanad
// im SQL-Editor.
//
// Zwei Wechselwirkungen gibt es trotzdem, und die stehen in
// OFFENE-PUNKTE.md, weil sie sonst später wie Fehler aussehen:
//   * `bewerbung-bleibt.sql` macht `job_id` nullable, und der eindeutige
//     Index aus `bewerbung-grenzen.sql` behandelt NULL-Werte als
//     verschieden. Eine Bewerbung, deren Anzeige gelöscht wurde,
//     blockiert also keine neue. So soll es sein.
//   * Nach `bewerbung-bleibt.sql` verliert eine Firma den Zugriff auf
//     Zeugnis und Lebenslauf, sobald sie ihre Anzeige löscht — die Regel
//     aus `zeugnis-nur-eigene-anzeige.sql` findet über `job_id` nichts
//     mehr. Auch das ist gewollt.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const PUNKTE = fs.readFileSync(path.join(WURZEL, 'OFFENE-PUNKTE.md'), 'utf8')

// Die Tabelle „Wartet auf dich" – nur der Block, nicht die ganze Datei.
const TABELLE = PUNKTE.slice(
  PUNKTE.indexOf('## ⏳ Wartet auf dich:'),
  PUNKTE.indexOf('### Datenstand'))

const OFFEN = [...TABELLE.matchAll(/\| `supabase\/([a-z0-9-]+\.sql)` \|/g)].map(m => m[1])

function inhalt(datei) {
  return fs.readFileSync(path.join(WURZEL, 'supabase', datei), 'utf8')
}

// Nur der ausführbare Teil: Die Erklärung oben nennt absichtlich auch
// Spalten, die die Datei gar nicht anfasst.
function ohneKopfkommentar(sql) {
  const zeilen = sql.split('\n')
  const start = zeilen.findIndex(z => z.trim() && !z.trim().startsWith('--'))
  return start === -1 ? '' : zeilen.slice(start).join('\n')
}

test('die Liste nennt nur Dateien, die es gibt', async () => {
  expect(OFFEN.length, 'keine offenen Dateien gefunden? Dann prüft der Test nichts')
    .toBeGreaterThan(3)
  for (const datei of OFFEN) {
    expect(fs.existsSync(path.join(WURZEL, 'supabase', datei)), `${datei} fehlt`).toBe(true)
  }
})

// Zweimal an einem Tag falsch gehabt: Zeile ergänzt, Zahl vergessen.
const ZAHLWORT = {
  3: 'drei', 4: 'vier', 5: 'fünf', 6: 'sechs', 7: 'sieben',
  8: 'acht', 9: 'neun', 10: 'zehn', 11: 'elf', 12: 'zwölf',
}

// Alle Stellen, die dieselbe Zahl noch einmal aussprechen.
//
// Am 11.9. kam ein dritter Fall dazu, den der alte Test nicht sah: Die
// Überschrift sagte „zwölf“, im Text darunter stand weiter „Zehn Dateien
// sind viel“. Er prüfte eben nur die Überschrift.
//
// Jede Stelle ist einzeln freiwillig — wer einen Satz umschreibt, soll
// hier nicht scheitern. Vacuum ist trotzdem ausgeschlossen: Mindestens
// drei der vier müssen zu finden sein.
const ZAEHLSTELLEN = [
  /Wartet auf dich: (\p{L}+) SQL-Dateien/u,
  /Alle (\p{L}+) im Supabase-SQL-Editor/u,
  /(\p{L}+) Dateien sind viel/u,
  /in allen (\p{L}+) Fällen/u,
]

test('jede Stelle nennt dieselbe, richtige Zahl', async () => {
  const erwartet = ZAHLWORT[OFFEN.length]
  expect(erwartet, `kein Zahlwort für ${OFFEN.length} hinterlegt`).toBeTruthy()

  let gefunden = 0
  for (const muster of ZAEHLSTELLEN) {
    const treffer = PUNKTE.match(muster)
    if (!treffer) continue
    gefunden++
    expect(treffer[1].toLowerCase(),
      `„${treffer[0]}“ — es sind ${OFFEN.length} Dateien, also „${erwartet}“`)
      .toBe(erwartet)
  }
  expect(gefunden, 'zu wenige Zählstellen gefunden — dann prüft der Test kaum etwas')
    .toBeGreaterThanOrEqual(3)
})

test('keine Datei stützt sich auf eine Spalte aus einer anderen', async () => {
  // Wer eine neue Spalte benutzt, muss sie selbst anlegen. Sonst gäbe es
  // eine Reihenfolge, die man kennen müsste — und ein Fehlschlag mitten
  // in der Datenbank wäre die Strafe fürs Nichtwissen.
  const legtAn = new Map()   // Spalte -> Datei
  for (const datei of OFFEN) {
    for (const m of inhalt(datei).matchAll(/add column if not exists ([a-z_]+)/g)) {
      legtAn.set(m[1], datei)
    }
  }
  expect(legtAn.size, 'keine neue Spalte im Spiel? Dann prüft der Test nichts')
    .toBeGreaterThan(0)

  for (const datei of OFFEN) {
    const koerper = ohneKopfkommentar(inhalt(datei))
    for (const [spalte, quelle] of legtAn) {
      if (quelle === datei) continue
      expect(koerper.includes(spalte),
        `${datei} benutzt die Spalte ${spalte}, die erst ${quelle} anlegt — `
        + 'damit gäbe es eine Reihenfolge, die eingehalten werden muss').toBe(false)
    }
  }
})

test('jede Datei sagt, wie man nachprüft, dass sie gewirkt hat', async () => {
  // Eine Änderung an der Datenbank, die man nicht nachprüfen kann, ist
  // eine Hoffnung. Bei RLS kommt dazu: `drop policy if exists` schweigt
  // auch bei falschem Namen (die Falle vom 27.8.).
  for (const datei of OFFEN) {
    const sql = inhalt(datei)
    expect(sql, `${datei} hat keinen Prüfteil`).toMatch(/NACHHER PRUEFEN|NACHHER PRÜFEN/)
  }
})

test('jede Datei sagt, wie man sie rückgängig macht', async () => {
  for (const datei of OFFEN) {
    expect(inhalt(datei), `${datei} sagt nicht, wie man zurückkommt`)
      .toMatch(/Rueckgaengig|Rückgängig/)
  }
})
