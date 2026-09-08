// Deckt die CSP das ab, was die Seite wirklich lädt? (8.9.2026)
//
// DER BEFUND: `vercel.json` setzt eine ausführliche
// Content-Security-Policy — sie sagt, von welchen fremden Adressen der
// Browser überhaupt etwas laden darf. Alles andere blockiert er.
//
// Die Testsuite wendet sie NIE an. `tests/server.js` liefert die Dateien
// ohne diese Kopfzeilen aus. Wer also einen neuen CDN einbindet und die
// CSP nicht mitzieht, sieht 1084 grüne Tests — und in Produktion lädt das
// Skript nicht. Ohne Fehlermeldung im Testlauf, und (solange kein
// Sentry-DSN gesetzt ist, siehe js/monitoring.js) auch ohne Meldung aus
// dem Browser echter Nutzer.
//
// Dieser Test schließt die Lücke von der anderen Seite: Er liest die CSP
// aus `vercel.json` und hält sie gegen die Adressen, die im Quelltext
// tatsächlich GELADEN werden.
//
// WICHTIG — Laden ist nicht Verlinken: `<a href="https://www.kmk.org">`
// ist ein Ziel, kein geladener Inhalt. Dafür gilt die CSP nicht (nur
// `form-action` und `frame-ancestors` betreffen Navigation). Solche
// Adressen dürfen also fehlen und werden hier ausgenommen.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const CONFIG = JSON.parse(fs.readFileSync(path.join(WURZEL, 'vercel.json'), 'utf8'))

function cspWert() {
  for (const block of CONFIG.headers || []) {
    for (const h of block.headers || []) {
      if (h.key === 'Content-Security-Policy') return h.value
    }
  }
  return null
}

// Alle Adressen, die WIRKLICH geladen werden: Skripte, Stile, Schriften,
// Bilder, fetch/import. Linkziele (`href="https://…"` an einem <a>)
// bleiben draußen.
function geladeneHosts() {
  const treffer = new Map()
  const dateien = [
    ...fs.readdirSync(WURZEL).filter(f => f.endsWith('.html')),
    ...fs.readdirSync(path.join(WURZEL, 'js')).map(f => 'js/' + f),
  ]
  const muster = [
    /<script[^>]+src="https:\/\/([a-z0-9.\-]+)/g,
    /<link[^>]+href="https:\/\/([a-z0-9.\-]+)/g,
    /<img[^>]+src="https:\/\/([a-z0-9.\-]+)/g,
    /@import\s+url\(['"]?https:\/\/([a-z0-9.\-]+)/g,
    /\bimport\s[^'"]*['"]https:\/\/([a-z0-9.\-]+)/g,
    /\bfetch\(\s*[`'"]https:\/\/([a-z0-9.\-]+)/g,
    /createClient\(\s*[`'"]https:\/\/([a-z0-9.\-]+)/g,
    /\.src\s*=\s*[`'"]https:\/\/([a-z0-9.\-]+)/g,
    /SUPABASE_URL\s*=\s*['"]https:\/\/([a-z0-9.\-]+)/g,
  ]
  for (const datei of dateien) {
    const txt = fs.readFileSync(path.join(WURZEL, datei), 'utf8')
    for (const m of muster) {
      for (const t of txt.matchAll(m)) {
        if (!treffer.has(t[1])) treffer.set(t[1], new Set())
        treffer.get(t[1]).add(datei)
      }
    }
  }
  return treffer
}

function deckt(erlaubt, host) {
  return [...erlaubt].some(e => e === host || (e.startsWith('*.') && host.endsWith(e.slice(1))))
}

test('es gibt überhaupt eine CSP', async () => {
  const csp = cspWert()
  expect(csp, 'keine Content-Security-Policy in vercel.json').toBeTruthy()
  // Die Riegel, die keine Adressliste brauchen.
  for (const teil of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"]) {
    expect(csp, `${teil} fehlt`).toContain(teil)
  }
})

test('jede geladene Fremdadresse ist erlaubt', async () => {
  const csp = cspWert()
  const erlaubt = new Set(csp.match(/https:\/\/[a-z0-9.*\-]+/g).map(s => s.slice(8)))
  const benutzt = geladeneHosts()

  expect(benutzt.size, 'keine Fremdadresse gefunden? Dann prüft der Test nichts')
    .toBeGreaterThan(2)

  const fehlend = [...benutzt.keys()]
    .filter(h => !h.endsWith('schuelermatch.de') && !deckt(erlaubt, h))
    .map(h => `${h} (aus ${[...benutzt.get(h)].sort().join(', ')})`)

  expect(fehlend,
    'Diese Adressen lädt die Seite, die CSP erlaubt sie aber nicht — '
    + 'in Produktion blockiert der Browser sie, im Testlauf fällt es nicht auf')
    .toEqual([])
})

test('die Sentry-Adressen bleiben, solange der Baustein da ist', async () => {
  // js/monitoring.js ist bewusst inaktiv (SENTRY_DSN = ''), lädt aber
  // js.sentry-cdn.com, sobald ein DSN eingetragen wird. Die Erlaubnis
  // vorher wegzunehmen hieße, dass die Überwachung am Tag ihrer
  // Aktivierung still nicht funktioniert.
  const csp = cspWert()
  const quelle = fs.readFileSync(path.join(WURZEL, 'js', 'monitoring.js'), 'utf8')
  if (quelle.includes('js.sentry-cdn.com')) {
    expect(csp).toContain('js.sentry-cdn.com')
    expect(csp, 'ohne ingest-Adresse kann Sentry nichts melden')
      .toMatch(/ingest[a-z.]*\.sentry\.io/)
  }
})

test('der Testserver setzt die CSP bewusst nicht — und das steht auch da', async () => {
  // Damit niemand annimmt, ein grüner Lauf beweise, dass die CSP passt.
  // Diesen Test hier gibt es genau deshalb.
  const server = fs.readFileSync(path.join(WURZEL, 'tests', 'server.js'), 'utf8')

  // Gemeint ist: Er SETZT die Kopfzeile nicht. Sie im Kommentar zu
  // erwaehnen ist gerade erwuenscht - ein blosses `not.toContain` haette
  // also den Hinweis verboten, den derselbe Test verlangt. (Genau da bin
  // ich beim Schreiben hineingelaufen.)
  const setztKopfzeile = /setHeader\(\s*['"]Content-Security-Policy|['"]Content-Security-Policy['"]\s*:/i
  expect(setztKopfzeile.test(server),
    'der Testserver setzt eine CSP - dann muesste sie mit vercel.json abgeglichen werden')
    .toBe(false)

  expect(server, 'im Testserver fehlt der Hinweis, warum keine CSP gesetzt wird')
    .toMatch(/Content-Security-Policy/)
})
