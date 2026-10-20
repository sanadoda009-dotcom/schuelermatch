// Jede neue Spalte braucht eine Entscheidung: eingefroren oder aenderbar?
// (20.10.2026)
//
// DER ANLASS - zweimal dasselbe:
//   4.9.   `profiles.email` stand nicht im Schutz-Trigger
//          schuetze_profil_felder -> jeder konnte die Adresse umsetzen,
//          an die die Plattform Mails schickt.
//   20.10. `bewerbungen.job_titel` kam mit bewerbung-bleibt.sql dazu;
//          schuetze_bewerbung_felder kannte die Spalte nicht -> die Firma
//          konnte die Titel-Kopie umschreiben, die dem Schueler als
//          Nachweis bleibt.
//
// Beide Male war der Trigger aelter als die Spalte. Deshalb dieser Test:
// Jede Spalte, die eine SQL-Datei an `bewerbungen` anlegt, muss ENTWEDER
// in der neuesten Fassung des Triggers eingefroren sein ODER hier
// ausdruecklich als "darf die Firma aendern" stehen - mit Grund.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const SUPA = path.join(__dirname, '..', 'supabase')
const dateien = fs.readdirSync(SUPA).filter(d => d.endsWith('.sql'))
const lies = d => fs.readFileSync(path.join(SUPA, d), 'utf8')
// Nur ausfuehrbarer Code: Die Pruefanleitung in den Kommentaren nennt
// dieselben Zeilen ("Erwartet: new.job_titel := old.job_titel"). Die
// Gegenprobe am 20.10. blieb deshalb gruen, obwohl die Zeile im Code fehlte.
const code = d => lies(d).split(/\r?\n/).filter(z => !z.trim().startsWith('--')).join('\n')

// Bewusst aenderbar - die Firma entscheidet und darf korrigieren.
const AENDERBAR = {
  angesehen_am: 'setzt die Firma beim ersten Ansehen (danach eingefroren, siehe coalesce)',
  entschieden_am: 'setzt die Firma bei jeder Entscheidung',
  absage_grund: 'Teil der Entscheidung',
}

function neueSpalten(tabelle) {
  const spalten = new Set()
  for (const d of dateien) {
    const sql = lies(d)
    const re = new RegExp(`alter table public\\.${tabelle}[\\s\\S]*?;`, 'g')
    for (const block of sql.match(re) || []) {
      for (const m of block.matchAll(/add column if not exists (\w+)/g)) spalten.add(m[1])
    }
  }
  return [...spalten]
}

// Die neueste Fassung der Trigger-Funktion: die Datei, die sie zuletzt
// ersetzt. Hier fest benannt, damit eine aeltere Fassung nicht zaehlt.
const TRIGGER_DATEI = 'bewerbung-titel-festnageln.sql'

test('jede neue Spalte an bewerbungen ist eingefroren oder bewusst aenderbar', async () => {
  const trigger = code(TRIGGER_DATEI)
  expect(trigger).toContain('create or replace function public.schuetze_bewerbung_felder()')
  const spalten = neueSpalten('bewerbungen')
  expect(spalten.length, 'keine neuen Spalten gefunden? Dann prueft der Test nichts').toBeGreaterThan(2)
  for (const s of spalten) {
    const eingefroren = new RegExp(`new\\.${s}\\s*:=`).test(trigger)
    expect(eingefroren || s in AENDERBAR,
      `bewerbungen.${s}: weder im Schutz-Trigger noch als aenderbar begruendet`).toBe(true)
  }
})

test('die Titel-Kopie ist eingefroren', async () => {
  // Gegenprobe gegen die Luecke vom 20.10. ganz direkt.
  expect(code(TRIGGER_DATEI)).toMatch(/new\.job_titel\s*:=\s*old\.job_titel/)
})

test('die Fassung mit dem Trigger enthaelt alle Felder der alten', async () => {
  // Wer die Funktion ersetzt, ersetzt sie GANZ. Fehlt dabei eine alte
  // Zeile, ist die Spalte wieder offen.
  const trigger = code(TRIGGER_DATEI)
  for (const s of ['id', 'job_id', 'schueler_id', 'motivationsschreiben', 'zeugnis_url',
                   'lebenslauf_url', 'erstellt_am']) {
    expect(trigger, `${s} ist nicht mehr eingefroren`).toMatch(new RegExp(`new\\.${s}\\s*:=\\s*old\\.${s}`))
  }
})
