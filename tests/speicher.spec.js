// Was der Browser speichert - und was die Datenschutzerklärung dazu sagt.
//
// Anlass (26.8.): Der Dunkelmodus wurde im August entfernt (e920946), die
// Datenschutzerklärung nannte die „Hell-/Dunkel-Einstellung" aber weiter
// als gespeicherten Wert. Umgekehrt hatte ich am selben Tag mit der
// Ferienjob-Seite einen NEUEN Schlüssel eingeführt (`sm-bundesland`) und
// die Erklärung nicht angefasst. Beides fiel niemandem auf, weil die
// beiden Dinge an völlig verschiedenen Stellen stehen.
//
// Eine Datenschutzerklärung, die etwas anderes behauptet als der Code
// tut, ist auf einer Seite für Minderjährige kein Schönheitsfehler -
// gerade weil die rechtliche Prüfung noch aussteht.
//
// Dieser Test kann den Text nicht auf Richtigkeit prüfen. Er kann aber
// Alarm schlagen, sobald sich der GESPEICHERTE BESTAND ändert: Jeder neue
// oder entfallene Schlüssel lässt ihn umfallen und zwingt dazu, Abschnitt
// 7 der Datenschutzerklärung anzufassen.
const { test, expect } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')

// Der dokumentierte Bestand. Beim Ändern IMMER auch datenschutz.html
// Abschnitt 7 („Cookies / lokale Speicherung") nachziehen.
const ERLAUBT = {
  'cv-draft-<id>': 'Zwischenstand des Lebenslaufs — genannt als „Zwischenstand deines Lebenslaufs als Entwurf"',
  'cv-design-<id>': 'PDF-Layout und Farbe — genannt als „deine Wahl von PDF-Layout und Farbe"',
  'onboarding-weg-<id>': '„Erste Schritte"-Karte ausgeblendet — genannt',
  'gesehen-<id>': 'bereits gesehene Benachrichtigungen — genannt',
  'sm-bundesland': 'Bundesland auf der Ferienjob-Seite — genannt (am 26.8. ergänzt)',
  // Bewusst NICHT in der Datenschutzerklärung: Die Zugangssperre ist ein
  // Bauphasen-Schild und verschwindet zum Launch (GATE_AKTIV = false).
  // Der Wert lebt nur in der sessionStorage des laufenden Tabs und ist
  // für die angeforderte Funktion technisch notwendig — dieselbe
  // Kategorie wie der Login-Token, den Abschnitt 7 gesondert nennt.
  'sm-zugang-ok': 'Zugangssperre der Bauphase (sessionStorage, technisch notwendig)',
}

// Schlüssel-Ausdruck -> Muster. Aus 'cv-draft-' + profile.id wird
// cv-draft-<id>, aus `gesehen-${rolle}-${id}` wird gesehen-<id>.
function alsMuster(literal) {
  return literal
    .replace(/\$\{[^}]*\}/g, '<id>')      // Template-Platzhalter
    .replace(/<id>-<id>/g, '<id>')        // gesehen-<rolle>-<id> zusammenfassen
    .replace(/-$/, '-<id>')               // 'cv-draft-' + profile.id
}

// Findet das erste String- oder Template-Literal in einem Ausdruck; ist
// keins da, wird der Bezeichner in der Datei nachgeschlagen (Konstante
// oder Hilfsfunktion mit return).
function loeseAuf(ausdruck, quelle) {
  const direkt = ausdruck.match(/['"`]([^'"`]+)['"`]/)
  if (direkt) return direkt[1]

  const name = (ausdruck.match(/^\s*([A-Za-z_$][\w$]*)/) || [])[1]
  if (!name) return null

  const konstante = quelle.match(
    new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*[^\\n;]*?[\'"`]([^\'"`]+)[\'"`]'))
  if (konstante) return konstante[1]

  const funktion = quelle.match(
    new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{[^}]*?return\\s*[\'"`]([^\'"`]+)[\'"`]'))
  if (funktion) return funktion[1]

  return null
}

function gefundeneSchluessel() {
  const dateien = [
    ...fs.readdirSync(path.join(WURZEL, 'js')).filter(f => f.endsWith('.js')).map(f => path.join('js', f)),
    ...fs.readdirSync(WURZEL).filter(f => f.endsWith('.html')),
  ]
  const treffer = new Map()   // Muster -> Fundstellen
  for (const rel of dateien) {
    const quelle = fs.readFileSync(path.join(WURZEL, rel), 'utf8')
    const muster = /(?:local|session)Storage\.(?:get|set|remove)Item\(\s*([^,)]+(?:\([^)]*\))?)/g
    let m
    while ((m = muster.exec(quelle)) !== null) {
      const literal = loeseAuf(m[1], quelle)
      if (!literal) {
        treffer.set('UNAUFLÖSBAR: ' + m[1].trim(), rel)
        continue
      }
      treffer.set(alsMuster(literal), rel)
    }
  }
  return treffer
}

test('der Browser speichert nur, was die Datenschutzerklärung nennt', () => {
  const gefunden = gefundeneSchluessel()

  const unbekannt = [...gefunden.keys()].filter(k => !(k in ERLAUBT))
  expect(unbekannt,
    'Neu gespeicherte Schlüssel gefunden. Trag sie in ERLAUBT ein UND ergänze ' +
    'Abschnitt 7 von datenschutz.html:\n' +
    unbekannt.map(k => '  ' + k + '  (' + gefunden.get(k) + ')').join('\n')
  ).toEqual([])

  const verschwunden = Object.keys(ERLAUBT).filter(k => !gefunden.has(k))
  expect(verschwunden,
    'Diese Schlüssel werden nicht mehr geschrieben. Prüf, ob sie noch in ' +
    'datenschutz.html stehen — genau so blieb der Dunkelmodus dort stehen, ' +
    'nachdem er entfernt wurde:\n' + verschwunden.map(k => '  ' + k).join('\n')
  ).toEqual([])
})

test('die Datenschutzerklärung nennt keine Einstellung, die es nicht mehr gibt', () => {
  const text = fs.readFileSync(path.join(WURZEL, 'datenschutz.html'), 'utf8')

  // Der Dunkelmodus ist der konkrete Fall, der passiert ist. Die Prüfung
  // hängt an dem, was der Code tut - nicht an einer festen Wortliste.
  const jsQuelle = fs.readdirSync(path.join(WURZEL, 'js'))
    .filter(f => f.endsWith('.js'))
    .map(f => fs.readFileSync(path.join(WURZEL, 'js', f), 'utf8'))
    .join('\n')

  const gibtEsDunkelmodus = /sm-theme|data-theme/.test(jsQuelle)
  if (!gibtEsDunkelmodus) {
    expect(text, 'Dunkelmodus ist aus dem Code entfernt, steht aber noch in der Datenschutzerklärung')
      .not.toMatch(/Hell-\/Dunkel|Dunkelmodus|Dark Mode/)
  }
})

test('Abschnitt 7 sagt weiterhin, dass kein Tracking stattfindet', () => {
  const text = fs.readFileSync(path.join(WURZEL, 'datenschutz.html'), 'utf8')
  expect(text).toMatch(/keine Werbe- oder Tracking-Cookies/)
  expect(text, 'die TTDSG-Begründung trägt die Aussage „kein Cookie-Banner nötig"')
    .toMatch(/§\s*25\s*Abs\.?\s*2\s*TTDSG/)
})

// -----------------------------------------------------------------------
// Zweiter Fall derselben Sorte: Fremdserver.
//
// Jeder Host, den die Seite von sich aus kontaktiert, bekommt die
// IP-Adresse des Besuchers zu sehen - das ist eine Uebermittlung und muss
// in Abschnitt 5 stehen. In Deutschland ist das kein theoretisches Risiko:
// Google Fonts von einem Fremdserver zu laden hat schon Abmahnungen
// ausgeloest.
//
// Gefunden am 26.8.: `js/supabase.js` laedt die Datenbank-Bibliothek von
// cdn.jsdelivr.net - auf praktisch jeder Seite. Google Fonts und cdnjs
// standen in der Erklaerung, jsDelivr nicht.
//
// Nur automatische Anfragen zaehlen. Ein <a href> zu kmk.org ist ein
// Verweis, den der Nutzer selbst anklickt - da uebermittelt die Seite
// nichts.
const HOST_AUSDRUECKE = [
  /<script[^>]+src=["']https?:\/\/([^/"']+)/gi,
  /<link[^>]+href=["']https?:\/\/([^/"']+)/gi,
  /\.src\s*=\s*["'`]https?:\/\/([^/"'`]+)/gi,
  /(?:import|from)\s+["']https?:\/\/([^/"']+)/gi,
  /fetch\(\s*["'`]https?:\/\/([^/"'`]+)/gi,
]

// Die eigene Domain ist kein Fremdserver. Sie taucht in canonical- und
// og:url-Angaben auf, das sind aber keine Anfragen an Dritte.
const EIGENE_HOSTS = new Set(['schuelermatch.de', 'www.schuelermatch.de'])

// Host -> wie er in der Datenschutzerklaerung heisst.
const HOST_GENANNT = {
  'fonts.googleapis.com': 'Google Fonts',
  'fonts.gstatic.com': 'Google Fonts',
  'cdnjs.cloudflare.com': 'cdnjs',
  'cdn.jsdelivr.net': 'jsDelivr',
  'geocoding-api.open-meteo.com': 'Open-Meteo',
  'blufrvuskqiloslyxjkx.supabase.co': 'Supabase',
  // Sentry laedt nur, wenn ein DSN eingetragen ist - siehe eigener Test.
  'js.sentry-cdn.com': 'Sentry',
  'sentry.io': 'Sentry',
}

function kontaktierteHosts() {
  const dateien = [
    ...fs.readdirSync(path.join(WURZEL, 'js')).filter(f => f.endsWith('.js')).map(f => path.join('js', f)),
    ...fs.readdirSync(WURZEL).filter(f => f.endsWith('.html')),
  ]
  const hosts = new Map()
  for (const rel of dateien) {
    const quelle = fs.readFileSync(path.join(WURZEL, rel), 'utf8')
    for (const ausdruck of HOST_AUSDRUECKE) {
      ausdruck.lastIndex = 0
      let m
      while ((m = ausdruck.exec(quelle)) !== null) {
        if (!hosts.has(m[1])) hosts.set(m[1], rel)
      }
    }
  }
  return hosts
}

test('jeder automatisch kontaktierte Fremdserver steht in der Datenschutzerklärung', () => {
  const text = fs.readFileSync(path.join(WURZEL, 'datenschutz.html'), 'utf8')
  const sentryAktiv = !/SENTRY_DSN\s*=\s*['"]\s*['"]/.test(
    fs.readFileSync(path.join(WURZEL, 'js', 'monitoring.js'), 'utf8'))

  const fehlend = []
  for (const [host, datei] of kontaktierteHosts()) {
    if (EIGENE_HOSTS.has(host)) continue
    const name = HOST_GENANNT[host]
    if (!name) { fehlend.push(host + ' — unbekannter Host (' + datei + ')'); continue }
    if (name === 'Sentry' && !sentryAktiv) continue   // laedt nichts ohne DSN
    if (!text.includes(name)) fehlend.push(host + ' — als "' + name + '" nicht genannt (' + datei + ')')
  }

  expect(fehlend,
    'Diese Hosts bekommen die IP des Besuchers, stehen aber nicht in Abschnitt 5 ' +
    'von datenschutz.html: ' + fehlend.join(' | ')
  ).toEqual([])
})

test('sobald Sentry aktiviert wird, muss es in der Datenschutzerklärung stehen', () => {
  const monitoring = fs.readFileSync(path.join(WURZEL, 'js', 'monitoring.js'), 'utf8')
  const sentryAktiv = !/SENTRY_DSN\s*=\s*['"]\s*['"]/.test(monitoring)
  if (!sentryAktiv) {
    // Heute inaktiv: monitoring.js macht ohne DSN keinerlei Netzwerkverkehr.
    // Dieser Test schlaegt in dem Moment an, in dem jemand den DSN eintraegt.
    return
  }
  const text = fs.readFileSync(path.join(WURZEL, 'datenschutz.html'), 'utf8')
  expect(text, 'Sentry ist aktiv (DSN gesetzt) und muss als Auftragsverarbeiter genannt werden')
    .toMatch(/Sentry/)
})
