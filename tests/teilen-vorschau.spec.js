// Das Bild, das beim Teilen erscheint (26.8.).
//
// Anlass: Es gab **kein einziges** og:image. Wer einen SchülerMatch-Link
// in eine WhatsApp-Gruppe warf, sah einen nackten Textkasten. Für eine
// Seite, deren Wachstum davon lebt, dass Schüler Jobs untereinander
// weitergeben, ist genau das der sichtbarste Moment überhaupt.
//
// `register.html` und `login.html` hatten sogar gar keine og-Tags - ein
// in eine Klassengruppe geteilter Anmelde-Link zeigte nur die Adresse.
//
// Geprüft wird hier alles, was beim Teilen schiefgehen kann und was man
// selbst nie sieht, weil das Bild in einer fremden App gerendert wird:
// fehlendes Tag, relativer Pfad, falsche Maßangabe, zu große Datei.
const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const DOMAIN = 'https://schuelermatch.de'

// WhatsApp zeigt oberhalb einer gewissen Größe gar keine Vorschau mehr.
// 300 KB ist der übliche Richtwert; wir liegen mit JPEG weit darunter.
const MAX_KB = 300

const SEITEN = [
  'index.html', 'jobs.html', 'job.html', 'ferienjob.html', 'fairer-lohn.html', 'taschengeld.html', 'ratgeber.html',
  'jobideen.html', 'jugendarbeitsschutz.html', 'eltern.html', 'fuer-firmen.html',
  'job-finder.html', 'register.html', 'login.html',
]

function kopf(datei) {
  return fs.readFileSync(path.join(WURZEL, datei), 'utf8')
}

function metaWert(quelle, name) {
  const m = quelle.match(
    new RegExp('<meta\\s+(?:property|name)="' + name + '"\\s+content="([^"]*)"'))
  return m ? m[1] : null
}

test.describe('Teilen-Vorschau', () => {
  for (const datei of SEITEN) {
    test(`${datei} bringt beim Teilen ein Bild mit`, () => {
      const quelle = kopf(datei)

      const bild = metaWert(quelle, 'og:image')
      expect(bild, `${datei} hat kein og:image`).toBeTruthy()

      // Relative Pfade lösen WhatsApp, Facebook und Co. NICHT auf.
      expect(bild, `${datei}: og:image muss eine absolute Adresse sein`)
        .toMatch(/^https:\/\//)
      expect(bild, `${datei}: og:image zeigt auf eine fremde Domain`)
        .toContain(DOMAIN)

      // Ohne Titel und Beschreibung bleibt die Vorschau halb leer.
      expect(metaWert(quelle, 'og:title'), `${datei} hat keinen og:title`).toBeTruthy()
      expect(metaWert(quelle, 'og:description'), `${datei} hat keine og:description`).toBeTruthy()

      // Ohne diese Zeile zeigt X/Twitter nur ein Briefmarkenbild.
      expect(metaWert(quelle, 'twitter:card'), `${datei}: twitter:card fehlt`)
        .toBe('summary_large_image')
    })
  }

  test('das Bild gibt es wirklich, in der angegebenen Größe', async ({ page }) => {
    const quelle = kopf('index.html')
    const adresse = metaWert(quelle, 'og:image')
    const relativ = adresse.replace(DOMAIN + '/', '')

    const datei = path.join(WURZEL, relativ)
    expect(fs.existsSync(datei), `${relativ} liegt nicht im Projekt`).toBe(true)

    const kb = fs.statSync(datei).size / 1024
    expect(kb, `${relativ} ist ${Math.round(kb)} KB - über ${MAX_KB} KB zeigt WhatsApp keine Vorschau`)
      .toBeLessThan(MAX_KB)

    // Die angegebenen Maße müssen zur Datei passen: Stimmen sie nicht,
    // schneiden manche Dienste falsch zu.
    await page.goto('/' + relativ)
    const masse = await page.evaluate(() => {
      const bild = document.querySelector('img')
      return bild ? { b: bild.naturalWidth, h: bild.naturalHeight } : null
    })
    expect(masse, 'Bild ließ sich nicht laden').toBeTruthy()
    expect(masse.b).toBe(Number(metaWert(quelle, 'og:image:width')))
    expect(masse.h).toBe(Number(metaWert(quelle, 'og:image:height')))

    // 1.91:1 ist das Seitenverhältnis, das Facebook und WhatsApp erwarten.
    expect(masse.b / masse.h).toBeCloseTo(1.91, 1)
  })

  test('alle Seiten zeigen auf dasselbe Bild', () => {
    const adressen = new Set(SEITEN.map(d => metaWert(kopf(d), 'og:image')))
    expect([...adressen],
      'Verschiedene og:image-Adressen - vermutlich eine beim Ändern vergessen'
    ).toHaveLength(1)
  })

  test('die Vorlage für das Bild liegt im Projekt', () => {
    // Ohne die Vorlage lässt sich das Bild nach einem Design-Wechsel
    // nicht mehr originalgetreu neu erzeugen.
    expect(fs.existsSync(path.join(WURZEL, 'assets', 'og-vorlage.html')),
      'assets/og-vorlage.html fehlt - das Bild wäre dann nicht reproduzierbar').toBe(true)
  })
})
