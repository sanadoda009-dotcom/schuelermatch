// Job-Detailseite (job.html + js/job-detail.js):
// Rendern, dynamischer Titel/Meta, JSON-LD JobPosting (Google Jobs), Fehlerfälle.
const { test, expect, standardAntworten } = require('./helpers/basis')

const JOB_ID = 'aaaaaaaa-0000-4000-8000-000000000002' // Mathe-Nachhilfe

test('rendert Job mit Titel, Lohn, Aufrufen und Bewerben-CTA', async ({ page }) => {
  // Aufbau geändert am 2.9.2026: Verdienst, Mindestalter, Zeit und Ort
  // standen in einer flachen Reihe zwischen Aufrufzahl und Anzeigenalter,
  // alle gleich gewichtet. Jetzt stehen sie als Eckdaten oben – das sind
  // die vier Angaben, die die Entscheidung tragen. Gesucht wird deshalb
  // nach dem Inhalt, nicht mehr nach der alten Reihe.
  await page.goto(`/job.html?id=${JOB_ID}`)
  await expect(page.locator('h1')).toHaveText('Mathe-Nachhilfe für 7. Klasse')
  await expect(page.locator('.job-eckdaten')).toContainText('16 €/Std')
  await expect(page.locator('.job-frische')).toContainText('17 Aufrufe')
  // Seit dem 2.9. steht der Bewerben-Knopf ZWEIMAL auf der Seite: oben
  // der schnelle, unten der mit Erklaerung. Bei langen Anzeigenseiten
  // ist das ueblich - wer unten ankommt, soll nicht zurueckscrollen.
  await expect(page.getByRole('link', { name: /Kostenlos registrieren/ })).toHaveCount(2)
  await expect(page.getByRole('link', { name: /Kostenlos registrieren/ }).first()).toBeVisible()
  await expect(page).toHaveTitle('Mathe-Nachhilfe für 7. Klasse – SchülerMatch')
})

test('die Eckdaten stehen VOR der Beschreibung, der Bewerben-Knopf auch', async ({ page }) => {
  // Der Kern des Umbaus. Vorher stand die Handlung ganz unten – nach
  // Beschreibung UND Bewertungen. Wer über Google auf einer Anzeige
  // landet, scrollte auf dem Handy lange, bevor er sie überhaupt sah.
  await page.goto(`/job.html?id=${JOB_ID}`)
  await expect(page.locator('h1')).toHaveText(/Mathe-Nachhilfe/)

  const reihenfolge = await page.evaluate(() => {
    const y = sel => document.querySelector(sel)?.getBoundingClientRect().top ?? Infinity
    return {
      eckdaten: y('.job-eckdaten'),
      cta: y('.job-cta-oben'),
      beschreibung: y('section h2'),
    }
  })
  expect(reihenfolge.eckdaten).toBeLessThan(reihenfolge.beschreibung)
  expect(reihenfolge.cta).toBeLessThan(reihenfolge.beschreibung)
})

test('alle vier Eckdaten sind ausgefüllt – auch wenn die Anzeige lückenhaft ist', async ({ page }) => {
  // Ein leeres Feld in einer Tabelle sieht aus wie ein Fehler. Fehlt eine
  // Angabe, steht dort "nach Absprache" oder "auf Anfrage".
  await page.route('**/rest/v1/jobs*', route => {
    const einzeln = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object')
    const job = { id: 'j-luecke', titel: 'Anzeige ohne Angaben', beschreibung: null,
      ort: null, stundenlohn: null, mindestalter: null, kategorie: null,
      arbeitszeit: null, verfuegbarkeit: null, aktiv: true, aufrufe: 0,
      erstellt_am: '2026-08-30T10:00:00Z', firma_id: 'f1', firma_name: null,
      firma_logo_url: null, lat: null, lon: null }
    return route.fulfill({ status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify(einzeln ? job : [job]) })
  })
  await page.goto('/job.html?id=j-luecke')
  await expect(page.locator('h1')).toHaveText('Anzeige ohne Angaben', { timeout: 15_000 })

  const leer = await page.locator('.job-eckdaten dd')
    .evaluateAll(els => els.filter(e => !e.textContent.trim()).length)
  expect(leer, 'leeres Feld in den Eckdaten').toBe(0)
  await expect(page.locator('.job-eckdaten')).toContainText('nach Absprache')
  await expect(page.locator('.job-eckdaten')).not.toContainText('null')
})

test('eine mehrzeilige Beschreibung wird zu Punkten', async ({ page }) => {
  // Untersuchungen zu Stellenanzeigen sind sich einig: Wer eine Anzeige
  // liest, überfliegt sie. Ein Textblock zwingt zum Lesen.
  await page.route('**/rest/v1/jobs*', route => {
    const einzeln = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object')
    const job = { id: 'j-punkte', titel: 'Mit Punkten',
      // Bewusst ein Template-Literal mit echten Umbruechen: Eine
      // maskierte Zeilenschaltung ueberlebt den Weg durch die Shell
      // nicht zuverlaessig - genau daran ist dieser Test schon
      // einmal gescheitert.
      beschreibung: `Eis verkaufen
- Kasse bedienen
Theke sauber halten`,
      ort: 'München', stundenlohn: 12, mindestalter: 15, kategorie: 'Verkauf',
      arbeitszeit: 'Wochenende', verfuegbarkeit: 'Sa & So', aktiv: true, aufrufe: 3,
      erstellt_am: '2026-08-30T10:00:00Z', firma_id: 'f1', firma_name: 'Sonne',
      firma_logo_url: null, lat: null, lon: null }
    return route.fulfill({ status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify(einzeln ? job : [job]) })
  })
  await page.goto('/job.html?id=j-punkte')
  await expect(page.locator('h1')).toHaveText('Mit Punkten', { timeout: 15_000 })

  await expect(page.locator('.job-punkte li')).toHaveCount(3)
  // Der Strich am Zeilenanfang gehört zur Aufzählung, nicht in den Text.
  await expect(page.locator('.job-punkte li').nth(1)).toHaveText('Kasse bedienen')
})

test('JSON-LD JobPosting ist vorhanden und korrekt befüllt', async ({ page }) => {
  await page.goto(`/job.html?id=${JOB_ID}`)
  await expect(page.locator('h1')).toHaveText(/Mathe-Nachhilfe/)

  const ld = await page.locator('script[type="application/ld+json"]').textContent()
  const daten = JSON.parse(ld)
  expect(daten['@type']).toBe('JobPosting')
  expect(daten.title).toBe('Mathe-Nachhilfe für 7. Klasse')
  expect(daten.employmentType).toBe('PART_TIME')
  expect(daten.jobLocation.address.addressLocality).toBe('München')
  expect(daten.baseSalary.value.value).toBe(16)
  expect(daten.directApply).toBe(true)
})

test('zeigt den Bewertungs-Leerzustand, wenn es keine Bewertungen gibt', async ({ page }) => {
  await page.goto(`/job.html?id=${JOB_ID}`)
  await expect(page.locator('body')).toContainText('Noch keine Bewertungen.')
})

test.describe('mit Bewertungen', () => {
  const antworten = standardAntworten()
  antworten.bewertungen = [
    { sterne: 5, kommentar: 'Super nette Familie!', schueler_name: 'Mia', erstellt_am: '2026-06-01T10:00:00Z' },
    { sterne: 4, kommentar: null, schueler_name: null, erstellt_am: '2026-05-01T10:00:00Z' },
  ]
  test.use({ antworten })

  test('zeigt Durchschnitt und Einzelbewertungen', async ({ page }) => {
    await page.goto(`/job.html?id=${JOB_ID}`)
    await expect(page.locator('.bewertung-summary .schnitt')).toHaveText('4.5')
    await expect(page.locator('.bewertung-card')).toHaveCount(2)
    await expect(page.locator('.bewertung-card').first()).toContainText('Super nette Familie!')
    await expect(page.locator('.bewertung-card').first()).toContainText('Mia')
  })
})

test('unbekannte Job-ID zeigt eine hilfreiche Fehlerseite', async ({ page }) => {
  await page.goto('/job.html?id=gibt-es-nicht')
  await expect(page.locator('h1')).toHaveText('Job nicht verfügbar')
  await expect(page.getByRole('link', { name: /Alle aktuellen Jobs/ })).toBeVisible()
})

test('ganz ohne ID: „Job nicht gefunden" mit Rückweg', async ({ page }) => {
  await page.goto('/job.html')
  await expect(page.locator('h1')).toHaveText('Job nicht gefunden')
})
