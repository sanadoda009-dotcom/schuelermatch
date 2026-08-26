// Strukturierte Daten für Google Jobs (26.8.).
//
// In der Launch-Liste steht „sitemap.xml einreichen → Jobs erscheinen in
// Google Jobs". Ob das klappt, entscheidet sich an der JSON-LD-Auszeichnung
// auf der Job-Detailseite — und das Tückische daran: Fehlt eine Pflicht-
// angabe, erscheint die Anzeige einfach nicht. Google meldet sich nicht.
//
// Zwei Befunde vom 26.8., die dieser Test festhält:
//   1. `jobLocation` fiel still weg, wenn ein Job keinen Ort hatte.
//      Damit wären ungültige Daten ausgeliefert worden.
//   2. `validThrough` fehlte immer. Google zeigt Anzeigen sonst
//      unbegrenzt weiter, auch längst besetzte.
const { test, expect } = require('./helpers/basis')
const { JOBS } = require('./helpers/fixtures')

// Die fünf Angaben, ohne die Google eine Stellenanzeige verwirft.
const PFLICHT = ['title', 'description', 'datePosted', 'hiringOrganization', 'jobLocation']

async function strukturierteDaten(page) {
  const roh = await page.evaluate(() => {
    const s = document.querySelector('script[type="application/ld+json"]')
    return s ? s.textContent : null
  })
  return roh ? JSON.parse(roh) : null
}

async function oeffneJob(page, job) {
  await page.route('**/rest/v1/jobs*', async route => {
    const url = new URL(route.request().url())
    if ((url.searchParams.get('id') || '').includes(job.id)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(job) })
    }
    await route.fallback()
  })
  await page.goto('/job.html?id=' + job.id)
  await page.waitForFunction(() => document.title !== '' && !document.title.startsWith('Minijob für'))
}

test('ein vollständiger Job bringt alle Pflichtangaben mit', async ({ page }) => {
  await page.goto('/job.html?id=' + JOBS[0].id)
  await page.waitForTimeout(900)

  const ld = await strukturierteDaten(page)
  expect(ld, 'keine strukturierten Daten gefunden').toBeTruthy()
  expect(ld['@type']).toBe('JobPosting')

  const fehlend = PFLICHT.filter(f => !ld[f])
  expect(fehlend, `Google verwirft die Anzeige ohne: ${fehlend.join(', ')}`).toEqual([])

  // Der Ort muss als Place mit Adresse dastehen, nicht als bloßer Text.
  expect(ld.jobLocation['@type']).toBe('Place')
  expect(ld.jobLocation.address.addressLocality).toBe(JOBS[0].ort)
  expect(ld.jobLocation.address.addressCountry).toBe('DE')

  // Datumsangaben im Format, das Google erwartet.
  expect(ld.datePosted).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(ld.validThrough, 'ohne validThrough zeigt Google alte Anzeigen ewig weiter')
    .toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(new Date(ld.validThrough) > new Date(ld.datePosted),
    'validThrough muss NACH datePosted liegen').toBe(true)
})

test('der Stundenlohn steht als Betrag pro Stunde da', async ({ page }) => {
  await page.goto('/job.html?id=' + JOBS[0].id)
  await page.waitForTimeout(900)
  const ld = await strukturierteDaten(page)

  expect(ld.baseSalary['@type']).toBe('MonetaryAmount')
  expect(ld.baseSalary.currency).toBe('EUR')
  expect(ld.baseSalary.value.value).toBe(JOBS[0].stundenlohn)
  expect(ld.baseSalary.value.unitText, 'sonst liest Google es als Jahresgehalt').toBe('HOUR')
})

test('ohne Ort werden lieber gar keine strukturierten Daten ausgeliefert', async ({ page }) => {
  // Unvollständige Auszeichnung kann der ganzen Seite schaden; eine
  // fehlende kostet nur diesen einen Job.
  await oeffneJob(page, { ...JOBS[0], id: 'aaaaaaaa-0000-4000-8000-0000000000ff', ort: null })
  await page.waitForTimeout(400)
  expect(await strukturierteDaten(page), 'lieber nichts als etwas Ungültiges').toBeNull()
})

test('ohne Beschreibung tritt der Titel ein', async ({ page }) => {
  // Eine leere description würde die Anzeige ungültig machen.
  const job = { ...JOBS[0], id: 'aaaaaaaa-0000-4000-8000-0000000000fe', beschreibung: null }
  await oeffneJob(page, job)
  await page.waitForTimeout(400)

  const ld = await strukturierteDaten(page)
  expect(ld).toBeTruthy()
  expect(ld.description).toBe(job.titel)
  expect(PFLICHT.filter(f => !ld[f])).toEqual([])
})

test('ohne Stundenlohn bleibt die Anzeige gültig', async ({ page }) => {
  // baseSalary ist optional — es darf nur nicht leer dastehen.
  const job = { ...JOBS[0], id: 'aaaaaaaa-0000-4000-8000-0000000000fd', stundenlohn: null }
  await oeffneJob(page, job)
  await page.waitForTimeout(400)

  const ld = await strukturierteDaten(page)
  expect(ld).toBeTruthy()
  expect(PFLICHT.filter(f => !ld[f])).toEqual([])
  expect('baseSalary' in ld, 'lieber weglassen als leer angeben').toBe(false)
})

test('der Firmenname steht drin, wenn es einen gibt', async ({ page }) => {
  // Seit dem 25.8. wird firma_name beim Posten mitgeschrieben. Ohne ihn
  // stand in Google „Arbeitgeber auf SchülerMatch" statt des echten
  // Namens — die alten Testanzeigen sehen noch so aus.
  const job = { ...JOBS[0], id: 'aaaaaaaa-0000-4000-8000-0000000000fc', firma_name: 'Café Sonnenschein GmbH' }
  await oeffneJob(page, job)
  await page.waitForTimeout(400)

  const ld = await strukturierteDaten(page)
  expect(ld.hiringOrganization['@type']).toBe('Organization')
  expect(ld.hiringOrganization.name).toBe('Café Sonnenschein GmbH')
})

test('ein pausierter Job liefert gar keine strukturierten Daten', async ({ page }) => {
  // Sonst führte Google Interessenten auf eine Anzeige, die es nicht
  // mehr gibt.
  //
  // Der Schutz sitzt in der Abfrage: job-detail.js fragt mit
  // .eq('aktiv', true), ein pausierter Job kommt also gar nicht erst
  // zurück. Genau das wird hier nachgebildet — PostgREST antwortet in
  // dem Fall mit PGRST116 („no rows"). Ein Mock, der den Job trotzdem
  // herausgibt, würde am echten Schutz vorbei testen.
  await page.route('**/rest/v1/jobs*', async route => {
    const url = new URL(route.request().url())
    if ((url.searchParams.get('id') || '').includes('0000000000fb')) {
      expect(url.searchParams.get('aktiv'), 'die Seite muss auf aktiv=true filtern').toBe('eq.true')
      return route.fulfill({
        status: 406, contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST116', message: 'no rows' }),
      })
    }
    await route.fallback()
  })

  await page.goto('/job.html?id=aaaaaaaa-0000-4000-8000-0000000000fb')
  await page.waitForTimeout(900)

  expect(await strukturierteDaten(page)).toBeNull()
  await expect(page.locator('main')).toContainText(/nicht verfügbar|nicht gefunden/)
})
