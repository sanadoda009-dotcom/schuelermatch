// Die Startseiten-Regel für <section> gehört nicht in die Arbeitsbereiche (13.9.2026).
//
// `css/style.css` hat `section { padding: 130px 24px }` — für die großen
// Abschnitte der Startseite. Jedes andere <section> erbt das, sofern der
// Rahmen es nicht zurücksetzt.
//
// Zwei Funde am selben Tag:
//   - Die Bewerbungsansicht der Firma (von Sanad als Bildschirmfoto
//     gemeldet): ein leerer Streifen unter den Filtern, jede
//     Anzeigen-Gruppe eingerückt. Dazu die Reiter im Betreiber-Bereich.
//   - Danach gezielt gesucht und im Lebenslauf-Editor gefunden: Beide
//     Spalten begannen 130px unter der Kopfzeile; auf dem Handy blieb
//     unter „Bearbeiten | Vorschau" ein Viertel des Bildschirms leer.
//
// Der Wächter unten ist die Suche, die den zweiten Fund gebracht hat,
// als Test: Jede Seite mit <section> muss in einem Rahmen stecken, der
// den Abstand zurücksetzt — oder die Startseite sein.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER } = require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')

test('jede Seite mit <section> steckt in einem Rahmen, der den Abstand zurücksetzt', async () => {
  const css = fs.readFileSync(path.join(WURZEL, 'css', 'style.css'), 'utf8')

  // Welche Rahmen setzen ihn zurück? Aus der CSS gelesen, nicht hier
  // abgeschrieben – sonst würde der Test eine eigene Wahrheit pflegen.
  const zurueck = new Set()
  for (const m of css.matchAll(/:where\(([^)]*)\)\s*section\s*\{\s*padding:\s*0/g)) {
    m[1].split(',').forEach(k => zurueck.add(k.trim().replace(/^\./, '')))
  }
  if (/\.legal-page section\s*\{\s*padding:\s*0/.test(css)) zurueck.add('legal-page')
  expect(zurueck.size, 'keine zurücksetzende Regel gefunden – dann prüft der Test nichts')
    .toBeGreaterThan(2)

  const ohne = []
  for (const datei of fs.readdirSync(WURZEL).filter(f => f.endsWith('.html'))) {
    if (datei === 'index.html') continue      // für sie ist die Regel gemacht
    const html = fs.readFileSync(path.join(WURZEL, datei), 'utf8')
    if (!/<section\b/.test(html)) continue
    const main = (html.match(/<main\b[^>]*class="([^"]*)"/) || [])[1] || ''
    if (!main.split(/\s+/).some(k => zurueck.has(k))) ohne.push(`${datei} (<main class="${main}">)`)
  }
  expect(ohne, 'Diese Seiten erben 130px Abstand über jedem <section>').toEqual([])
})

test.describe('Lebenslauf-Editor', () => {
  async function editor(page, breite, hoehe) {
    await page.setViewportSize({ width: breite, height: hoehe })
    await setupDashboard(page.context(), { user: SCHUELER, db: defaultDb({ profiles: [profilZeile(SCHUELER)] }) })
    await page.goto('/lebenslauf.html')
    await expect(page.locator('#ll-schritt-name')).not.toBeEmpty({ timeout: 30_000 })
  }

  test('beide Spalten ohne Startseiten-Abstand', async ({ page }) => {
    await editor(page, 1440, 900)
    const oben = await page.evaluate(() =>
      ['ll-editor', 'll-vorschau'].map(id => getComputedStyle(document.getElementById(id)).paddingTop))
    expect(oben).toEqual(['0px', '0px'])
  })

  test('auf dem Handy steht der Inhalt bündig unter „Bearbeiten | Vorschau"', async ({ page }) => {
    await editor(page, 390, 844)
    const m = await page.evaluate(() => {
      const knopf = document.querySelector('.ll-mobil-toggle button').getBoundingClientRect()
      const inhalt = document.getElementById('ll-editor').firstElementChild.getBoundingClientRect()
      return { links: Math.round(inhalt.left - knopf.left), luecke: Math.round(inhalt.top - knopf.bottom) }
    })
    expect(m.links, 'Inhalt weiter eingerückt als die Knöpfe darüber').toBe(0)
    expect(m.luecke, `leerer Streifen unter den Knöpfen: ${m.luecke}px`).toBeLessThan(60)
  })
})

/* Die Gegenrichtung: Eine Regel für <section> darf keine eigene Klasse
 * überstimmen (13.9.2026).
 *
 * Beim Durchfotografieren der öffentlichen Seiten gefunden:
 * `.legal-page section { padding: 0 }` wog mehr als
 * `.legal-highlight { padding: 22px 24px }`. Die 20 grünen
 * Hervorhebungskästen auf Ratgeber- und Infoseiten hatten deshalb keinen
 * Innenabstand – der Text stieß an den Rand. Derselbe Kasten als <div>
 * auf job.html sah richtig aus, darum fiel es dort nie auf.
 *
 * Beide Rücksetz-Regeln stehen jetzt in `:where(...)` und haben kein
 * Gewicht mehr. Dieser Test prüft, dass das so bleibt.
 */
const HERVORHEBUNG = ['arbeitsvertrag', 'bewerbungsfoto', 'datenschutz', 'eltern', 'fairer-lohn',
  'ferienjob', 'fuer-firmen', 'jobideen', 'jugendarbeitsschutz', 'ratgeber', 'taschengeld']

test('keine Rücksetz-Regel für <section> hat mehr Gewicht als eine Klasse', async () => {
  const css = fs.readFileSync(path.join(WURZEL, 'css', 'style.css'), 'utf8')
  // „.irgendwas section { … padding: 0" ohne :where – genau die Form, die
  // eine Klasse am <section> überstimmt.
  const schwer = [...css.matchAll(/^([^\n{}]*[.#][\w-]+\s+section)\s*\{[^}]*padding:\s*0/gm)]
    .map(m => m[1].trim())
    .filter(sel => !sel.startsWith(':where('))
    .filter(sel => !/@media print/.test(sel))
  expect(schwer, 'diese Regeln nehmen jedem <section class="…"> seinen Innenabstand').toEqual([])
})

for (const seite of HERVORHEBUNG) {
  test(`${seite}: der grüne Kasten hat Innenabstand`, async ({ page }) => {
    await page.goto(`/${seite}.html`)
    const innen = await page.locator('section.legal-highlight').first()
      .evaluate(el => parseFloat(getComputedStyle(el).paddingLeft))
    expect(innen, 'Text stößt an den Rand des Kastens').toBeGreaterThan(10)
  })
}

test('auf der Anzeigenseite bleibt das Firmenlogo quadratisch – auch neben langem Titel', async ({ page }) => {
  // Auf dem Handy wurde es neben einem umbrechenden Titel zu einem
  // schmalen hohen Streifen gequetscht.
  await page.setViewportSize({ width: 390, height: 844 })
  const { JOBS } = require('./helpers/fixtures')
  await setupDashboard(page.context(), { db: defaultDb() })
  await page.goto('/job.html?id=' + JOBS[0].id)
  const logo = page.locator('#job-detail .company-logo')
  await expect(logo).toBeVisible({ timeout: 20_000 })
  const { breite, hoehe } = await logo.evaluate(el => {
    const r = el.getBoundingClientRect()
    return { breite: Math.round(r.width), hoehe: Math.round(r.height) }
  })
  expect(breite, `Logo ${breite}×${hoehe}`).toBe(hoehe)
})
