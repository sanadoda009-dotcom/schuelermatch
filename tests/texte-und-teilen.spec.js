// Verständlichkeit der Texte + Vorschau beim Teilen.
//
// Anlass (Messung am 24.8.): Die Satzlängen sind durchweg gut (5–8 Wörter
// im Schnitt) – da war fast nichts zu tun. Gefunden wurden dafür zwei
// andere Dinge: einzelne Amtswörter in Texten, die Schüler lesen, und
// eine fehlende Teilen-Vorschau auf ausgerechnet der Seite, die einen
// "Link kopieren"-Knopf hat.
const { test, expect, setupDashboard } = require('./helpers/supabase-fake')

// Sammelt sichtbare Fließtexte und misst die Satzlänge.
const SAETZE = `(() => {
  const sichtbar = el => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  }
  const raus = []
  document.querySelectorAll('main p, main h1, main h2, main h3, main li').forEach(el => {
    if (!sichtbar(el) || el.children.length) return
    const t = (el.textContent || '').replace(/\\s+/g, ' ').trim()
    if (t.length < 15) return
    t.split(/(?<=[.!?])\\s+/).forEach(s => {
      const n = s.trim().split(/\\s+/).filter(Boolean).length
      if (n >= 3) raus.push({ satz: s.trim(), n })
    })
  })
  return raus
})()`

// Seiten, die sich an Schüler richten. Rechtstexte (Impressum,
// Datenschutz) sind bewusst NICHT dabei: Die müssen juristisch genau
// sein, nicht einfach.
const FUER_SCHUELER = [
  ['Startseite', '/index.html'],
  ['Jobbörse', '/jobs.html'],
  ['Jugendarbeitsschutz', '/jugendarbeitsschutz.html'],
]

for (const [name, pfad] of FUER_SCHUELER) {
  test(`Sätze bleiben kurz: ${name}`, async ({ page }) => {
    await setupDashboard(page.context(), {})
    await page.goto(pfad)
    await page.waitForTimeout(1200)
    const saetze = await page.evaluate(SAETZE)
    expect(saetze.length, 'Text gefunden').toBeGreaterThan(3)

    // Ein Satz mit über 25 Wörtern ist für 13-Jährige zu lang.
    const zuLang = saetze.filter(s => s.n > 25).map(s => `[${s.n} Wörter] ${s.satz}`)
    expect(zuLang).toEqual([])

    // Und im Schnitt soll es deutlich darunter bleiben.
    const schnitt = saetze.reduce((s, x) => s + x.n, 0) / saetze.length
    expect(schnitt, 'durchschnittliche Satzlänge').toBeLessThan(15)
  })
}

test('kein Amtsdeutsch in Schüler-Texten', async ({ page }) => {
  // "Verfügbarkeit" stand im Lebenslauf-Baustein und auf der Startseite.
  // Für einen 13-Jährigen ist das ein Amtswort – "Wann ich Zeit habe"
  // sagt dasselbe. In den Firmen-Formularen darf es stehen bleiben
  // (Erwachsene), in den Rechtstexten sowieso.
  await setupDashboard(page.context(), {})
  await page.goto('/index.html')
  await page.waitForTimeout(1000)
  const text = await page.evaluate(() => document.querySelector('main').innerText)
  expect(text).not.toContain('Verfügbarkeit')
})

test.describe('Teilen-Vorschau', () => {
  // Ohne diese Angaben erscheint beim Teilen in WhatsApp nur die nackte URL.
  for (const [name, pfad] of [
    ['Startseite', '/index.html'],
    ['Jobbörse', '/jobs.html'],
    ['Job-Detail', '/job.html?id=aaaaaaaa-0000-4000-8000-000000000001'],
    ['Jugendarbeitsschutz', '/jugendarbeitsschutz.html'],
  ]) {
    test(`vorhanden auf: ${name}`, async ({ page }) => {
      await setupDashboard(page.context(), {})
      await page.goto(pfad)
      await page.waitForTimeout(1200)
      const meta = await page.evaluate(() => ({
        titel: document.querySelector('meta[property="og:title"]')?.content || '',
        text: document.querySelector('meta[property="og:description"]')?.content || '',
      }))
      expect(meta.titel.length, 'og:title gesetzt').toBeGreaterThan(10)
      expect(meta.text.length, 'og:description gesetzt').toBeGreaterThan(30)
    })
  }

  test('Job-Detail übernimmt den echten Jobtitel', async ({ page }) => {
    await setupDashboard(page.context(), {})
    await page.goto('/job.html?id=aaaaaaaa-0000-4000-8000-000000000001')
    await page.waitForTimeout(1500)
    const titel = await page.evaluate(() =>
      document.querySelector('meta[property="og:title"]')?.content || '')
    // Nicht mehr der allgemeine Platzhalter, sondern die echte Anzeige.
    expect(titel).not.toBe('Minijob für Schüler – SchülerMatch')
    const h1 = await page.locator('h1').first().textContent()
    expect(titel).toContain(h1.trim().split('\n')[0].slice(0, 12))
  })
})
