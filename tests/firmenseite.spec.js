// Die öffentliche Firmenseite (2.9.2026).
//
// ANLASS: Sanad – „wir müssen uns mal ums Firmenprofil kümmern […] auf ein
// neues Level bringen". Der Ist-Zustand: Das Firmenprofil bestand aus
// Firmenname, Standort und einer Mail-Einstellung. Eine öffentliche Seite
// gab es nicht. Ein Schüler sah auf einer Anzeige einen Namen und einen
// Buchstaben im Kreis — weniger als bei einem Kleinanzeigen-Inserat.
//
// WICHTIG FÜR DAS VERSTÄNDNIS DIESER TESTS: Ein Firmenprofil darf heute
// niemand lesen außer der Firma selbst. `supabase/firma-oeffentlich.sql`
// legt dafür eine Sicht mit genau den öffentlichen Spalten an — bewusst
// eine Sicht und keine RLS-Regel, weil RLS auf ZEILEN wirkt und die Zeile
// auch `email` enthält.
//
// Bis die Datei eingespielt ist, muss die Seite trotzdem funktionieren:
// Anzeigen und Bewertungen sind längst öffentlich lesbar. Der letzte Block
// prüft genau diesen Fall.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const FIRMA_ID = 'ffffffff-0000-4000-8000-000000000001'

const JOBS = [
  { id: 'fj1', titel: 'Eisverkäufer/in', beschreibung: 'Eis verkaufen.', ort: 'München',
    stundenlohn: 12, mindestalter: 15, kategorie: 'Verkauf', arbeitszeit: 'Wochenende',
    aktiv: true, aufrufe: 4, erstellt_am: '2026-08-30T10:00:00Z',
    firma_id: FIRMA_ID, firma_name: 'Eiscafé Sonne', firma_logo_url: null, lat: null, lon: null,
    verfuegbarkeit: 'Sa & So' },
  { id: 'fj2', titel: 'Aushilfe Theke', beschreibung: 'Theke.', ort: 'München',
    stundenlohn: 13, mindestalter: 16, kategorie: 'Gastronomie', arbeitszeit: 'Nachmittags',
    aktiv: true, aufrufe: 1, erstellt_am: '2026-08-28T10:00:00Z',
    firma_id: FIRMA_ID, firma_name: 'Eiscafé Sonne', firma_logo_url: null, lat: null, lon: null,
    verfuegbarkeit: null },
]

// Antworten frei zusammenstellen: Die Seite fragt drei Tabellen ab, und
// eine davon (`firmen_oeffentlich`) gibt es in der echten Datenbank noch
// gar nicht.
async function seite(page, { profil, bewertungen = [], jobs = JOBS } = {}) {
  await page.route('**/rest/v1/jobs*', route => route.fulfill({
    status: 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify(jobs),
  }))
  await page.route('**/rest/v1/bewertungen*', route => route.fulfill({
    status: 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify(bewertungen),
  }))
  await page.route('**/rest/v1/firmen_oeffentlich*', route => {
    if (profil === undefined) {
      // So verhält sich Supabase, solange es die Sicht nicht gibt.
      return route.fulfill({
        status: 404,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ code: '42P01', message: 'relation "firmen_oeffentlich" does not exist' }),
      })
    }
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify(profil),
    })
  })
  await page.goto(`/firma.html?id=${FIRMA_ID}`)
}

test.describe('mit der Sicht firmen_oeffentlich', () => {
  const PROFIL = {
    id: FIRMA_ID, name: 'Eiscafé Sonne', ort: 'München', foto_url: null,
    ueber_mich: 'Wir sind ein kleines Eiscafé am Marktplatz.\nBei uns meldet sich Frau Kern.',
    erstellt_am: '2026-03-04T10:00:00Z',
  }

  test('zeigt Name, Ort, geprüft-Kennzeichen und seit wann', async ({ page }) => {
    await seite(page, { profil: PROFIL })
    await expect(page.locator('h1')).toHaveText('Eiscafé Sonne', { timeout: 20_000 })
    await expect(page.locator('.firma-kopf')).toContainText('München')
    await expect(page.locator('.firma-marke').first()).toContainText('geprüft')
    await expect(page.locator('.firma-marken')).toContainText('März 2026')
  })

  test('„Wer wir sind" steht da', async ({ page }) => {
    await seite(page, { profil: PROFIL })
    await expect(page.locator('main')).toContainText('Wer wir sind', { timeout: 20_000 })
    await expect(page.locator('main')).toContainText('Frau Kern')
  })

  test('alle offenen Stellen der Firma stehen darauf', async ({ page }) => {
    await seite(page, { profil: PROFIL })
    await expect(page.locator('.job-card')).toHaveCount(2, { timeout: 20_000 })
    await expect(page.locator('main')).toContainText('Offene Stellen (2)')
  })

  test('der Titel der Seite trägt den Firmennamen', async ({ page }) => {
    // Sonst steht in einem geteilten Link und im Tab nur "Arbeitgeber".
    await seite(page, { profil: PROFIL })
    await expect(page.locator('h1')).toHaveText('Eiscafé Sonne', { timeout: 20_000 })
    await expect(page).toHaveTitle(/Eiscafé Sonne/)
  })

  test('fremder Text wird nicht als HTML eingesetzt', async ({ page }) => {
    await seite(page, { profil: { ...PROFIL,
      name: '<img src=x onerror="window.__aua=1">',
      ueber_mich: '<b>fett</b>' } })
    await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 })
    expect(await page.evaluate(() => window.__aua)).toBeUndefined()
    await expect(page.locator('main')).toContainText('<b>fett</b>')
  })
})

test.describe('Bewertungen', () => {
  test('stehen gebündelt auf der Firmenseite', async ({ page }) => {
    // Sie gab es längst – aber nur je Anzeige. Wer wissen wollte, ob eine
    // Firma insgesamt in Ordnung ist, musste jede Anzeige einzeln öffnen.
    await seite(page, {
      profil: null,
      bewertungen: [
        { id: 'bw1', firma_id: FIRMA_ID, schueler_name: 'Lena', kommentar: 'Sehr nett dort.', erstellt_am: '2026-08-01T10:00:00Z' },
        { id: 'bw2', firma_id: FIRMA_ID, schueler_name: 'Ali', kommentar: 'Pünktlich bezahlt.', erstellt_am: '2026-07-01T10:00:00Z' },
      ],
    })
    await expect(page.locator('.firma-bewertung')).toHaveCount(2, { timeout: 20_000 })
    await expect(page.locator('main')).toContainText('Pünktlich bezahlt')
  })

  test('ohne Bewertungen steht da, warum es keine gibt', async ({ page }) => {
    await seite(page, { profil: null, bewertungen: [] })
    await expect(page.locator('main')).toContainText('Noch keine Bewertungen', { timeout: 20_000 })
    await expect(page.locator('main')).toContainText('angenommen')
  })
})

test.describe('ohne die Sicht funktioniert die Seite trotzdem', () => {
  test('Name und Stellen kommen aus den Anzeigen', async ({ page }) => {
    // supabase/firma-oeffentlich.sql ist noch nicht eingespielt.
    await seite(page)                       // profil undefined -> 404 wie bei Supabase
    await expect(page.locator('h1')).toHaveText('Eiscafé Sonne', { timeout: 20_000 })
    await expect(page.locator('.job-card')).toHaveCount(2)
    // „Wer wir sind" bleibt weg, statt leer dazustehen.
    await expect(page.locator('main')).not.toContainText('Wer wir sind')
  })

  test('ohne Anzeigen und ohne Profil: ehrliche Auskunft statt leerer Seite', async ({ page }) => {
    await seite(page, { jobs: [] })
    await expect(page.locator('main')).toContainText('gibt es hier nicht', { timeout: 20_000 })
  })
})

test('die SQL-Datei nennt nur öffentliche Spalten', async () => {
  // Der Kern der Entscheidung: eine Sicht statt einer RLS-Regel. RLS wirkt
  // auf Zeilen – wer die Zeile lesen darf, liest auch `email`.
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'firma-oeffentlich.sql'), 'utf8')
  const kopf = sql.slice(sql.indexOf('create or replace view'), sql.indexOf('grant select'))

  for (const spalte of ['id', 'name', 'ort', 'foto_url', 'ueber_mich', 'erstellt_am']) {
    expect(kopf, `Spalte ${spalte} fehlt`).toContain(spalte)
  }
  for (const geheim of ['email', 'benachrichtigung', 'schuelerausweis_url', 'alter_jahre']) {
    expect(kopf.includes(geheim), `${geheim} darf nicht öffentlich sein`).toBe(false)
  }
  // Und nur freigegebene Firmen.
  expect(kopf).toContain("role = 'firma'")
  expect(kopf).toContain('freigegeben')
})

/* „Wer wir sind" gehört auch auf die Anzeige (11.9.2026).
 *
 * DER BEFUND: Unter dem Feld im Firmen-Dashboard steht wörtlich:
 *
 *   „Steht auf deiner Firmenseite und bei jeder Anzeige. Für Schüler ist
 *    das oft die einzige Möglichkeit, vorher zu erfahren, bei wem sie
 *    sich bewerben."
 *
 * Nachgesehen: `ueber_mich` kam in `js/job-detail.js` überhaupt nicht
 * vor. Die zweite Hälfte des Satzes war falsch — und zwar die, auf die
 * es ankommt: Die Firmenseite muss man erst aufrufen, die Anzeige liest
 * man ohnehin. Wer über Google oder einen geteilten Link auf eine
 * Anzeige kommt, sah von der Firma nur den Namen.
 */
test.describe('„Wer wir sind" auf der Anzeigenseite', () => {
  const PROFIL = {
    id: FIRMA_ID, name: 'Eiscafé Sonne', ort: 'München', foto_url: null,
    ueber_mich: 'Wir sind ein kleines Eiscafé am Marktplatz.\nBei uns meldet sich Frau Kern.',
    erstellt_am: '2026-03-04T10:00:00Z',
  }

  // Wie `seite()` weiter oben, nur für job.html. `.single()` erwartet ein
  // Objekt, keine Liste.
  async function anzeige(page, { profil } = {}) {
    const json = koerper => ({
      status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify(koerper),
    })
    await page.route('**/rest/v1/jobs*', route => route.fulfill(json(JOBS[0])))
    await page.route('**/rest/v1/bewertungen*', route => route.fulfill(json([])))
    await page.route('**/rest/v1/firmen_oeffentlich*', route => {
      if (profil === undefined) {
        // So verhält sich Supabase, solange es die Sicht nicht gibt.
        return route.fulfill({
          status: 404,
          headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
          body: JSON.stringify({ code: '42P01', message: 'relation "firmen_oeffentlich" does not exist' }),
        })
      }
      return route.fulfill(json(profil))
    })
    await page.goto(`/job.html?id=${JOBS[0].id}`)
    await expect(page.locator('#job-detail h1')).toBeVisible({ timeout: 20_000 })
  }

  test('der Text steht unter der Beschreibung', async ({ page }) => {
    await anzeige(page, { profil: PROFIL })
    await expect(page.locator('#job-detail')).toContainText('Wer wir sind')
    await expect(page.locator('#job-detail')).toContainText('Frau Kern')
  })

  test('solange es die Sicht nicht gibt, fehlt der Abschnitt — sonst nichts', async ({ page }) => {
    // Genau der Zustand der echten Datenbank am 11.9.2026. Die Anzeige
    // muss vollständig bleiben; ein Schüler soll von der halbfertigen
    // Baustelle nichts mitbekommen.
    await anzeige(page)
    await expect(page.locator('#job-detail')).not.toContainText('Wer wir sind')
    await expect(page.locator('#job-detail')).toContainText('Beschreibung')
    await expect(page.locator('#job-detail')).toContainText('Eis verkaufen')
    await expect(page.locator('[data-cta-link]').first()).toBeVisible()
  })

  test('ein leeres Feld erzeugt keine leere Überschrift', async ({ page }) => {
    await anzeige(page, { profil: { ...PROFIL, ueber_mich: '   ' } })
    await expect(page.locator('#job-detail')).toContainText('Beschreibung')
    await expect(page.locator('#job-detail')).not.toContainText('Wer wir sind')
  })

  test('fremder Text wird nicht als HTML eingesetzt', async ({ page }) => {
    await anzeige(page, { profil: { ...PROFIL, ueber_mich: '<img src=x onerror="window.__aua=1">' } })
    await expect(page.locator('#job-detail')).toContainText('Wer wir sind')
    expect(await page.evaluate(() => window.__aua)).toBeUndefined()
    await expect(page.locator('#job-detail')).toContainText('<img src=x')
  })

  test('das Versprechen im Formular und die Anzeige gehören zusammen', async () => {
    // Der Wächter: Wer den Satz im Dashboard stehen lässt, muss den Text
    // auch auf der Anzeige zeigen. Umgekehrt darf man den Satz gern
    // umschreiben — dann greift diese Prüfung von selbst nicht mehr.
    const html = fs.readFileSync(path.join(__dirname, '..', 'dashboard-firma.html'), 'utf8')
    if (!/bei jeder Anzeige/.test(html)) return
    const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'job-detail.js'), 'utf8')
    expect(quelle,
      'das Feld verspricht „bei jeder Anzeige", die Anzeigenseite kennt ueber_mich aber nicht')
      .toContain('ueber_mich')
  })
})
