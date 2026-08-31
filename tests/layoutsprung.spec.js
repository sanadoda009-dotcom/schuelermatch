// Layoutsprünge beim Laden (1.9.2026).
//
// ANLASS: Die Seite hat keinen einzigen <img> mit Maßangaben. Solange ein
// Bild nicht geladen ist, weiß der Browser nicht, wie breit es wird – er
// rechnet mit 0. Beim Logo in der Kopfzeile hieß das: 0px, dann plötzlich
// 158px. Auf jeder der 27 Seiten.
//
// Gemessen wurde mit einem PerformanceObserver auf 'layout-shift' und
// künstlich verzögerten Antworten, also so, wie es jemand mit schlechter
// Verbindung erlebt. Vorher/nachher:
//
//   Logo in der Kopfzeile   0px -> 158px      jetzt kein Sprung
//   /jobs.html              CLS 0,0381        jetzt 0,0000
//
// Zum /job-finder.html hatte ich zuerst CLS 0,0752 gemessen. Die
// Gegenprobe hat das widerlegt: Dieser Wert kam aus einer Messschleife,
// die dieselbe Seite mehrfach angesteuert hat. Bei einem frischen Aufruf
// – so wie ein Besucher ankommt – ist der Wert auch ohne die Änderung 0.
// Die reservierte Höhe für #finder-inhalt bleibt trotzdem drin, weil der
// Bereich im HTML wirklich leer ist; sie ist aber Vorsorge und nicht
// durch eine Messung belegt.
//
// Drei Ursachen, drei verschiedene Lösungen:
//   1. Bilder ohne width/height  -> Maße ins Markup
//   2. Leere Elemente, die später Text bekommen (#jobs-count) und ein
//      leerer Fragebereich (#finder-inhalt) -> Höhe in CSS reservieren
//   3. Platzhalterkarten, die flacher waren als die echten Karten, und
//      zu wenige davon -> Höhe angeglichen, Bereich per min-height
//      offengehalten, solange Platzhalter stehen
//
// Der Test hält alle drei fest. Punkt 1 statisch (schnell, deckt alle
// Seiten ab), Punkt 2 und 3 gemessen (nur die Seiten, die wirklich
// nachladen – der Rest kostet nur Laufzeit).

const { test, expect, SUPABASE_HOST } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')

test.describe('Bilder bringen ihre Maße mit', () => {
  test('jedes <img> im Markup hat width und height', () => {
    const ohne = []
    for (const datei of fs.readdirSync(WURZEL).filter(f => f.endsWith('.html'))) {
      const inhalt = fs.readFileSync(path.join(WURZEL, datei), 'utf8')
      for (const tag of inhalt.match(/<img\b[^>]*>/g) || []) {
        if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) ohne.push(`${datei}: ${tag}`)
      }
    }
    expect(ohne,
      'Bild ohne Maßangaben – der Browser reserviert dafür keinen Platz, ' +
      'und alles darunter springt, sobald das Bild da ist').toEqual([])
  })

  test('die angegebenen Maße stimmen mit der Datei überein', async ({ page }) => {
    // Falsche Maße sind schlimmer als gar keine: dann reserviert der
    // Browser den falschen Platz und es springt trotzdem.
    await page.goto('/index.html')
    const falsch = await page.locator('img').evaluateAll(bilder => bilder
      .filter(b => b.getAttribute('width') && b.naturalWidth)
      .filter(b => {
        const a = +b.getAttribute('width') / +b.getAttribute('height')
        return Math.abs(a - b.naturalWidth / b.naturalHeight) > 0.01
      })
      .map(b => `${b.src}: angegeben ${b.getAttribute('width')}x${b.getAttribute('height')}, ` +
                `tatsächlich ${b.naturalWidth}x${b.naturalHeight}`))
    expect(falsch, 'Seitenverhältnis passt nicht zur Datei').toEqual([])
  })
})

test.describe('nichts springt beim Laden', () => {
  // Nur die Seiten, die wirklich nachladen. Reine Textseiten haben
  // keine bewegten Teile und würden nur Laufzeit kosten.
  const SEITEN = ['/index.html', '/jobs.html', '/job-finder.html']

  for (const pfad of SEITEN) {
    test(`${pfad} lädt ohne Layoutsprung`, async ({ page }) => {
      // Antworten verzögern, sonst ist der Ladezustand nie zu sehen und
      // der Test würde auch mit kaputtem Markup grün.
      await page.route(`**${SUPABASE_HOST}/**`, async route => {
        await new Promise(r => setTimeout(r, 700))
        await route.fallback()
      })

      await page.goto(pfad, { waitUntil: 'commit' })
      await page.evaluate(() => {
        window.__cls = 0
        window.__quellen = []
        new PerformanceObserver(liste => {
          for (const e of liste.getEntries()) {
            if (e.hadRecentInput) continue
            window.__cls += e.value
            for (const q of e.sources || []) {
              const n = q.node
              window.__quellen.push((n && n.tagName ? n.tagName : '?') +
                (n && typeof n.className === 'string' && n.className
                  ? '.' + n.className.trim().split(/\s+/)[0] : ''))
            }
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })
      await page.waitForTimeout(2200)

      const { cls, quellen } = await page.evaluate(() =>
        ({ cls: window.__cls, quellen: [...new Set(window.__quellen)] }))

      // 0,1 gilt allgemein als Grenze für "gut". Hier steht 0,01,
      // weil alle drei Seiten gemessen bei 0,0000 liegen – wer den
      // Wert wieder hochtreibt, soll es merken.
      expect(cls, `verschoben hat sich: ${quellen.join(', ') || '(nichts benannt)'}`)
        .toBeLessThan(0.01)
    })
  }

  test('der Fragebereich des Finders hält seine Höhe', async ({ page }) => {
    // Er ist im HTML leer und wird per JS gefüllt. Ohne reservierte Höhe
    // wächst er von 0 auf 266px – und weil alle Fragen gleich hoch sind,
    // hält dieselbe Reservierung die Karte auch beim Weiterklicken ruhig.
    await page.goto('/job-finder.html')
    const hoehen = []
    for (let i = 0; i < 5; i++) {
      hoehen.push(await page.locator('#finder-inhalt')
        .evaluate(e => e.getBoundingClientRect().height))
      const knopf = page.locator('#finder-inhalt button').first()
      if (await knopf.count()) await knopf.click()
      await page.waitForTimeout(120)
    }
    const spanne = Math.max(...hoehen) - Math.min(...hoehen)
    expect(spanne, `Fragen unterschiedlich hoch: ${hoehen.map(h => Math.round(h)).join(', ')}`)
      .toBeLessThan(2)
  })

  test('die Platzhalterkarte ist so hoch wie eine echte Jobkarte', async ({ page }) => {
    // War sie nicht: 210px gegen 286px. Beim Austausch wuchs das Gitter
    // um 386px und schob die Fußzeile aus dem Bild.
    // Ohne Verzoegerung sind die Platzhalter schon ersetzt, bevor der
    // Test sie messen kann - dann wuerde er nichts pruefen.
    await page.route(`**${SUPABASE_HOST}/**`, async route => {
      await new Promise(r => setTimeout(r, 900))
      await route.fallback()
    })

    await page.goto('/jobs.html', { waitUntil: 'domcontentloaded' })
    const platzhalter = await page.locator('.skeleton-card').first()
      .evaluate(e => e.getBoundingClientRect().height)

    await page.waitForSelector('.job-card', { timeout: 15000 })
    const echt = await page.locator('.job-card').first()
      .evaluate(e => e.getBoundingClientRect().height)

    expect(Math.abs(platzhalter - echt),
      `Platzhalter ${Math.round(platzhalter)}px, echte Karte ${Math.round(echt)}px`)
      .toBeLessThan(30)
  })
})
