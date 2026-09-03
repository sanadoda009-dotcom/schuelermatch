// Lange deutsche Wörter am schmalen Rand (27.8.).
//
// ANLASS: der Blick auf schuelerjobs.de. Dort stehen weiche
// Trennstriche von Hand in den Überschriften —
// „Einverständnis&shy;erklärung", „Jugend&shy;arbeits&shy;schutz&shy;gesetz".
// Deutsche Komposita sind dafür berüchtigt: Auf einem 320px breiten
// Bildschirm passt „Einverständniserklärung" in keine Spalte.
//
// Ihre Lösung funktioniert, muss aber bei jedem Wort einzeln gemacht
// werden — und wer es vergisst, hat das Problem wieder.
//
// Hier macht es der Browser: `hyphens: auto` zusammen mit `lang="de"`
// trennt an echten Silbengrenzen und setzt einen sichtbaren Strich.
//
// GEMESSEN VORHER (bei 320px): Im Fliesstext stand `hyphens: manual`,
// also gar keine Trennung. Gegriffen hat nur `overflow-wrap:
// break-word` — das bricht hart mitten im Wort, ohne Strich, und liest
// sich wie ein Fehler. Nur h1–h3 hatten `hyphens: auto`.
const { test, expect } = require('./helpers/basis')

const SEITEN = ['/index.html', '/jobs.html', '/ratgeber.html', '/jugendarbeitsschutz.html',
  '/taschengeld.html', '/gesundheitszeugnis.html', '/firma.html?id=ffffffff-0000-4000-8000-000000000001', '/arbeitsvertrag.html', '/bewerbungsfoto.html', '/eltern.html', '/fuer-firmen.html', '/ferienjob.html']

test.use({ viewport: { width: 320, height: 800 } })

test.describe('lange Wörter dürfen den Rand nicht sprengen', () => {
  for (const seite of SEITEN) {
    test(`Silbentrennung greift im Fliesstext: ${seite}`, async ({ page }) => {
      await page.goto(seite)
      await page.waitForTimeout(300)

      const ohne = await page.evaluate(() => {
        const raus = []
        for (const el of document.querySelectorAll('p, li, a, span, b, label, td, th, summary')) {
          if (!el.offsetParent || el.children.length) continue
          const text = (el.textContent || '').trim()
          if (!text) continue
          // Erst ab dieser Länge wird es an schmalen Rändern eng.
          const laengstes = text.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '')
          if (laengstes.length < 18) continue
          if (getComputedStyle(el).hyphens !== 'auto') {
            raus.push(`${el.tagName}: „${laengstes}"`)
          }
        }
        return [...new Set(raus)]
      })

      expect(ohne, 'lange Wörter ohne Silbentrennung').toEqual([])
    })
  }
})

test('die Seiten sind als deutsch ausgezeichnet', async ({ page }) => {
  // Ohne `lang="de"` trennt der Browser nach englischen Regeln oder gar
  // nicht — `hyphens: auto` allein nützt dann nichts.
  for (const seite of SEITEN) {
    await page.goto(seite)
    const lang = await page.evaluate(() => document.documentElement.lang)
    expect(lang, `${seite}: falsche Sprache`).toBe('de')
  }
})

test.describe('wo Trennstriche NICHT hingehören', () => {
  test('nicht in Eingabefelder', async ({ page }) => {
    // Ein Trennstrich mitten in einer eingetippten E-Mail-Adresse wäre
    // schlimmer als der Überlauf.
    await page.goto('/register.html')
    const stile = await page.evaluate(() =>
      [...document.querySelectorAll('input, textarea, select')]
        .filter(el => el.offsetParent)
        .map(el => getComputedStyle(el).hyphens))
    expect(stile.length).toBeGreaterThan(0)
    expect([...new Set(stile)]).toEqual(['none'])
  })

  test('nicht in Chips und Abzeichen', async ({ page }) => {
    // Die sind kurz und stehen für sich; ein Trennstrich darin sieht
    // nach Fehler aus.
    await page.goto('/jobs.html')
    await page.waitForTimeout(500)
    const schlecht = await page.evaluate(() =>
      [...document.querySelectorAll('[class*="chip"], .job-badge')]
        .filter(el => el.offsetParent)
        .filter(el => getComputedStyle(el).hyphens !== 'none')
        .map(el => el.className))
    expect(schlecht).toEqual([])
  })
})

test('nichts läuft seitlich aus dem Kasten', async ({ page }) => {
  // Die Probe aufs Exempel: Trennung hin oder her — am Ende darf kein
  // sichtbarer Text über seinen Kasten hinausragen.
  // `.sr-only` ist ausgenommen: Diese Elemente sind absichtlich auf
  // 1px geklemmt und nur für Screenreader da.
  for (const seite of SEITEN) {
    await page.goto(seite)
    await page.waitForTimeout(300)
    const ueber = await page.evaluate(() => {
      const raus = []
      for (const el of document.querySelectorAll('h1,h2,h3,h4,p,li,a,button,label,td,th,summary')) {
        if (!el.offsetParent || el.children.length) continue
        if (el.closest('.sr-only') || el.classList.contains('sr-only')) continue
        if (el.scrollWidth > el.clientWidth + 1) {
          raus.push(`${el.tagName}.${el.className}: ${(el.textContent || '').trim().slice(0, 40)}`)
        }
      }
      return raus
    })
    expect(ueber, `${seite}: läuft über`).toEqual([])
  }
})
