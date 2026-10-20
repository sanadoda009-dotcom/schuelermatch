// Sagen Formular und Datenbank dieselbe Laengengrenze? (20.10.2026)
//
// DER ANLASS: Am 20.10. ist supabase/bewerbung-grenzen.sql eingespielt
// worden. Seitdem lehnt die Datenbank zu lange Texte ab:
//
//   bewerbungen.motivationsschreiben  2000
//   jobs.beschreibung                 4000
//   profiles.ueber_mich                600
//
// Das Anschreiben und "Ueber uns" hatten im Formular schon ein passendes
// `maxlength`. Die ANZEIGENBESCHREIBUNG nicht. Eine Firma mit einem
// langen Text haette beim Veroeffentlichen "hat gerade nicht geklappt.
// Versuch es gleich nochmal" gelesen - und mit demselben Text beliebig
// oft wieder scheitern koennen.
//
// Dasselbe Muster wie tests/altersfilter.spec.js: Eine Grenze steht an
// zwei Stellen, also haelt ein Test beide gleich. Die Zahlen werden aus
// der SQL-Datei GELESEN, nicht abgeschrieben - aendert jemand die Regel,
// muss er das Formular mitziehen.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = p => fs.readFileSync(path.join(WURZEL, p), 'utf8')
const SQL = lies('supabase/bewerbung-grenzen.sql')

function grenzeAusSql(spalte) {
  const m = SQL.match(new RegExp(`char_length\\(${spalte}\\)\\s*<=\\s*(\\d+)`))
  return m ? Number(m[1]) : null
}

function maxlengthImHtml(datei, id) {
  const html = lies(datei)
  const tag = html.match(new RegExp(`<(?:textarea|input)[^>]*id="${id}"[^>]*>`))
  if (!tag) return { gefunden: false, wert: null }
  const m = tag[0].match(/maxlength="(\d+)"/)
  return { gefunden: true, wert: m ? Number(m[1]) : null }
}

const FELDER = [
  { spalte: 'motivationsschreiben', datei: 'dashboard-schueler.html', id: 'bewerbung-motivation' },
  { spalte: 'beschreibung',         datei: 'dashboard-firma.html',    id: 'job-beschreibung' },
  { spalte: 'ueber_mich',           datei: 'dashboard-firma.html',    id: 'profile-ueber-uns' },
]

for (const f of FELDER) {
  test(`${f.datei} #${f.id} begrenzt wie die Datenbank (${f.spalte})`, async () => {
    const grenze = grenzeAusSql(f.spalte)
    expect(grenze, `keine Grenze fuer ${f.spalte} in der SQL-Datei gefunden`).toBeGreaterThan(0)
    const feld = maxlengthImHtml(f.datei, f.id)
    expect(feld.gefunden, `Feld #${f.id} gibt es nicht mehr`).toBe(true)
    expect(feld.wert, `#${f.id} hat kein maxlength - die Datenbank nimmt nur ${grenze} Zeichen`)
      .toBe(grenze)
  })
}

test('jede Laengengrenze der SQL-Datei hat ein Formularfeld hier', async () => {
  // Kommt eine neue Grenze dazu, ohne dass sie hier steht, prueft dieser
  // Test sie nicht - also faellt er auf.
  const spalten = [...SQL.matchAll(/char_length\((\w+)\)\s*<=/g)].map(m => m[1])
  expect(spalten.length).toBeGreaterThan(0)
  for (const s of spalten) {
    expect(FELDER.map(f => f.spalte), `Grenze fuer ${s} ohne Formularpruefung`).toContain(s)
  }
})

test('eine abgelehnte Regel sagt nicht "gleich nochmal"', async ({ page }) => {
  // Derselbe zu lange Text scheitert beim zweiten Versuch genauso.
  await page.goto('/index.html')
  const t = await page.evaluate(async () => {
    const z = await import('/js/zustand.js')
    return z.verstaendlich({
      message: 'new row for relation "jobs" violates check constraint "jobs_beschreibung_check"',
    }, 'Das Veröffentlichen')
  })
  expect(t).toMatch(/zu lang/)
  expect(t).not.toMatch(/gleich nochmal/)
  expect(t.toLowerCase()).not.toMatch(/constraint|relation/)
})
