// Die Altersgrenze gilt auch in der Jobbörse (4.9.2026).
//
// DER BEFUND: Am 26.8. wurde das Mindestalter auf 13 gezogen — in
// `register.html`, in `dashboard-firma.html` (Mindestalter der Anzeige)
// und in `dashboard-schueler.html` (Profil). Die vierte Liste blieb
// stehen: der Altersfilter auf `jobs.html` bot weiter **10, 11 und 12**
// Jahre an. Ein Zwölfjähriger stellte dort sein Alter ein und bekam eine
// Trefferliste — auf der Seite, die auf `jugendarbeitsschutz.html` selbst
// schreibt, dass unter 13 nicht gearbeitet werden darf.
//
// DIE URSACHE ist nicht der eine vergessene Ort. Es gibt VIER von Hand
// gepflegte Kopien derselben Liste. `ALTERSOPTIONEN` in
// `js/jugendschutz.js` existiert genau dafür — und wurde von keiner
// einzigen Seite benutzt, nur von Tests. Ohne Build-Schritt kann eine
// HTML-Datei das Modul nicht importieren; deshalb hält dieser Test die
// vier Listen gegen das Modul. Läuft eine davon wieder weg, wird er rot.
//
// § 5 Abs. 1 JArbSchG verbietet die Beschäftigung von Kindern; ab 13 sind
// leichte Tätigkeiten mit Einwilligung der Eltern erlaubt (§ 5 Abs. 3).

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const wurzel = path.join(__dirname, '..')
const lies = datei => fs.readFileSync(path.join(wurzel, datei), 'utf8')

// Die Grenzen kommen aus dem Modul selbst — nicht noch einmal abgetippt.
function altersoptionen() {
  const quelle = lies('js/jugendschutz.js')
  const zahl = name => {
    const t = quelle.match(new RegExp(`export const ${name} = (\\d+)`))
    if (!t) throw new Error(`${name} steht nicht mehr in js/jugendschutz.js`)
    return Number(t[1])
  }
  const min = zahl('MIN_ALTER')
  const max = zahl('MAX_ALTER')
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

// Holt die Zahlen aus einem <select> heraus. Leere Werte („Egal",
// „Bitte wählen") zählen nicht mit.
function optionenVon(html, id) {
  const auf = html.indexOf(`id="${id}"`)
  expect(auf, `<select id="${id}"> gibt es nicht mehr`).toBeGreaterThan(-1)
  const zu = html.indexOf('</select>', auf)
  expect(zu, `</select> zu ${id} fehlt`).toBeGreaterThan(auf)
  const block = html.slice(auf, zu)

  const zahlen = []
  for (const m of block.matchAll(/<option[^>]*>([^<]*)<\/option>/g)) {
    // Der Wert steht entweder im value= oder als Text dazwischen.
    const wert = (m[0].match(/value="([^"]*)"/) || [null, m[1]])[1]
    const t = String(wert).trim()
    if (t === '') continue
    zahlen.push(Number(t))
  }
  return zahlen
}

// Jede Alters-Auswahl im Projekt. Wer eine fünfte baut, trägt sie hier ein.
const LISTEN = [
  ['jobs.html', 'filter-alter', 'Altersfilter der Jobbörse'],
  ['register.html', 'alter', 'Alter bei der Anmeldung'],
  ['dashboard-schueler.html', 'profile-alter', 'Alter im Schülerprofil'],
  ['dashboard-firma.html', 'job-mindestalter', 'Mindestalter einer Anzeige'],
]

test.describe('alle Alters-Auswahllisten halten sich an js/jugendschutz.js', () => {
  for (const [datei, id, was] of LISTEN) {
    test(`${was} (${datei})`, async () => {
      const soll = altersoptionen()
      const ist = optionenVon(lies(datei), id)
      expect(ist, `${datei}#${id} weicht von ALTERSOPTIONEN ab`).toEqual(soll)
    })
  }

  test('keine einzige Liste bietet noch 10, 11 oder 12 an', async () => {
    // Der ursprüngliche Fund, ausdrücklich benannt: Diese drei Zahlen
    // dürfen nirgends mehr wählbar sein.
    for (const [datei, id] of LISTEN) {
      const zahlen = optionenVon(lies(datei), id)
      for (const kind of [10, 11, 12]) {
        expect(zahlen.includes(kind), `${datei}#${id} bietet ${kind} Jahre an`).toBe(false)
      }
    }
  })
})

test.describe('der Filter in der Jobbörse', () => {
  test('lässt sich nicht auf 12 stellen', async ({ page }) => {
    await page.goto('/jobs.html')
    const werte = await page.locator('#filter-alter option').evaluateAll(
      os => os.map(o => o.value))
    expect(werte).not.toContain('12')
    expect(werte).toContain('13')
  })

  test('mit 15 bleiben nur Anzeigen ab höchstens 15 übrig', async ({ page }) => {
    // Gegenprobe, dass der Filter überhaupt noch tut, was er soll.
    await page.goto('/jobs.html?alter=15')
    await expect(page.locator('.job-card')).toHaveCount(3, { timeout: 20_000 })
  })

  test('ein Link mit ?alter=12 filtert nicht heimlich', async ({ page }) => {
    // Ein alter geteilter Link, oder jemand tippt es selbst in die Adresse.
    // Der Filter darf so einen Wert nicht übernehmen — sonst gilt die
    // Grenze überall, nur nicht für den, der die Adresse ändert.
    await page.goto('/jobs.html?alter=12')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('#filter-alter')).toHaveValue('')
  })

  test('und sagt ehrlich, warum es für unter 13 nichts gibt', async ({ page }) => {
    // Kommentarlos auf „Egal" zurückspringen wäre die schlechtere
    // Antwort: Dann wirkt es wie ein Fehler der Seite.
    await page.goto('/jobs.html?alter=12')
    const hinweis = page.locator('#alter-filter-hinweis')
    await expect(hinweis).toBeVisible({ timeout: 20_000 })
    await expect(hinweis).toContainText('13')
    await expect(hinweis).toContainText('Jugendarbeitsschutz')
  })

  test('bei einem erlaubten Alter steht der Hinweis nicht da', async ({ page }) => {
    await page.goto('/jobs.html?alter=15')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('#alter-filter-hinweis')).toBeHidden()
  })
})
