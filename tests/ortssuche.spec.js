// Die Ortssuche lieferte Orte aus aller Welt (8.9.2026).
//
// DER BEFUND — gegen den echten Dienst gemessen, nicht vermutet.
//
// `js/geo.js` hängte `country=DE` an die Abfrage. Open-Meteo kennt diesen
// Parameter nicht und lieferte ungerührt weiter. Zehn deutsche
// Postleitzahlen probiert:
//
//   80331 → München (DE)          ← als einzige richtig
//   10115 → New York City (US)
//   51103 → Sioux City (US)
//   04109 → Portland (US)
//   90402 → Santa Monica (US)
//   66111 → Kansas City (US)
//   28195 → Serrada de la Fuente (ES)
//   20095 · 70173 · 99084 → gar nichts
//
// Diese Koordinaten landeten ungeprüft im Profil. **Ein Schüler aus
// Berlin, der 10115 eintippt, stand danach in New York** — und fand in
// der Umkreissuche für immer nichts, ohne je zu erfahren, warum. Ein
// falscher Ort ist schlimmer als kein Ort: Kein Ort sagt die Wahrheit.
//
// Und die Eingabefelder versprachen genau das: „z.B. München oder 80331".
//
// ZWEITER BEFUND: Ohne Umlaute fand der Dienst nichts Deutsches.
// „muenchen" ergab Münchendorf in ÖSTERREICH, 350 km daneben. Auf dem
// Handy tippt man aber genau so.
//
// WAS SICH GEÄNDERT HAT
//   1. Das Land wird an der ANTWORT geprüft (`country_code`), nicht an
//      der Anfrage. Alles außerhalb Deutschlands gilt als „nicht
//      gefunden" — was wahr und behebbar ist.
//   2. Findet der erste Versuch nichts Deutsches, folgt einer mit
//      zurückgesetzten Umlauten. Gemessen: koeln, tuebingen, osnabrueck,
//      wuerzburg, saarbruecken — alle gefunden.
//   3. Bei einer Postleitzahl sagt der Hinweis, was wirklich los ist.
//      „Prüf die Schreibweise" wäre da ein sinnloser Rat.
//   4. Die Felder versprechen keine Postleitzahlen mehr.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = p => fs.readFileSync(path.join(WURZEL, p), 'utf8')

// Der echte Dienst wird nicht befragt: Ein Test, der vom Netz abhängt,
// schlägt irgendwann aus Gründen fehl, die nichts mit dem Code zu tun
// haben. Stattdessen wird die Antwort nachgestellt — mit genau den
// Daten, die die Messung ergeben hat.
async function mitAntwort(page, ergebnisse) {
  await page.route('**/geocoding-api.open-meteo.com/**', route => {
    const url = new URL(route.request().url())
    const name = (url.searchParams.get('name') || '').toLowerCase()
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ results: ergebnisse[name] || [] }),
    })
  })
  await page.goto('/index.html')
}

async function suche(page, ort) {
  return page.evaluate(async (o) => {
    const m = await import('/js/geo.js')
    return m.geocode(o)
  }, ort)
}

const BERLIN_US = [{ name: 'New York City', country_code: 'US', latitude: 40.71, longitude: -74.01 }]
const MUENCHEN = [{ name: 'München', country_code: 'DE', latitude: 48.14, longitude: 11.58 }]
const MUENCHENDORF_AT = [{ name: 'Münchendorf', country_code: 'AT', latitude: 48.03, longitude: 16.38 }]

test.describe('ein Ort im Ausland zählt nicht als Treffer', () => {
  test('eine deutsche PLZ, die New York ergibt, gilt als nicht gefunden', async ({ page }) => {
    await mitAntwort(page, { '10115': BERLIN_US })
    const r = await suche(page, '10115')
    expect(r.status).toBe('unbekannt')
    expect(r.lat).toBeUndefined()
  })

  test('und wird als Postleitzahl erkannt', async ({ page }) => {
    // Damit der Hinweis sagen kann, was wirklich los ist.
    await mitAntwort(page, { '10115': BERLIN_US })
    expect((await suche(page, '10115')).plz).toBe(true)
  })

  test('Österreich zählt auch nicht', async ({ page }) => {
    await mitAntwort(page, { muenchendorf: MUENCHENDORF_AT })
    expect((await suche(page, 'Münchendorf')).status).toBe('unbekannt')
  })
})

test.describe('der zweite Versuch mit Umlauten', () => {
  test('„muenchen" findet München statt Münchendorf', async ({ page }) => {
    // Erster Versuch: nur der österreichische Ort. Zweiter: München.
    await mitAntwort(page, { muenchen: MUENCHENDORF_AT, münchen: MUENCHEN })
    const r = await suche(page, 'muenchen')
    expect(r.status).toBe('ok')
    expect(Math.round(r.lat)).toBe(48)
    expect(Math.round(r.lon)).toBe(12)
  })

  test('er läuft nur, wenn er etwas ändern kann', async ({ page }) => {
    // „Berlin" enthält kein ue/oe/ae — ein zweiter Aufruf wäre reine
    // Wartezeit für den Nutzer.
    let aufrufe = 0
    await page.route('**/geocoding-api.open-meteo.com/**', route => {
      aufrufe++
      route.fulfill({ status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ results: [] }) })
    })
    await page.goto('/index.html')
    await suche(page, 'Berlin')
    expect(aufrufe).toBe(1)
  })
})

test.describe('was sich nicht ändern durfte', () => {
  test('eine Störung löscht vorhandene Koordinaten nicht', async ({ page }) => {
    // Der Fund von früher: Wer nur seinen Namen ändert, während der
    // Dienst klemmt, verlor seine Koordinaten.
    await page.route('**/geocoding-api.open-meteo.com/**', r => r.fulfill({ status: 500, body: '' }))
    await page.goto('/index.html')
    expect((await suche(page, 'München')).status).toBe('gestoert')

    const ziel = await page.evaluate(async () => {
      const m = await import('/js/geo.js')
      const z = { lat: 48.1, lon: 11.5 }
      m.uebernehmeKoordinaten(z, { status: 'gestoert' })
      return z
    })
    expect(ziel).toEqual({ lat: 48.1, lon: 11.5 })
  })

  test('ein deutscher Treffer geht weiter durch', async ({ page }) => {
    await mitAntwort(page, { münchen: MUENCHEN })
    const r = await suche(page, 'München')
    expect(r.status).toBe('ok')
  })
})

test.describe('die Seite verspricht keine Postleitzahlen mehr', () => {
  for (const datei of ['dashboard-schueler.html', 'register.html']) {
    test(datei, async () => {
      const html = lies(datei)
      expect(html, 'wirbt weiter mit einer PLZ als Beispiel').not.toContain('80331')
      expect(html).not.toContain('Wohnort / PLZ')
    })
  }

  test('und der Hinweis nennt bei einer PLZ den wahren Grund', async () => {
    // „Prüf die Schreibweise" ist bei 10115 ein sinnloser Rat.
    for (const datei of ['js/dashboard-firma.js', 'js/dashboard-schueler.js']) {
      expect(lies(datei), `${datei} unterscheidet den PLZ-Fall nicht`)
        .toContain('geo.plz')
    }
  })
})
