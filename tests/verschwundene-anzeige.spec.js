// Was passiert, wenn eine Anzeige nicht mehr da ist (26.8.).
//
// Anschluss an die Google-Jobs-Runde. Das Problem: `job.html` ist eine
// statische Datei und liefert IMMER HTTP 200 — der Job kommt erst per
// Abfrage dazu. Google sieht also nie eine 404 und behält die Adresse im
// Index. Bei Stellenanzeigen ist das ausdrücklich unerwünscht: Wer aus
// der Google-Jobsuche kommt, landet auf einer Anzeige, die es nicht mehr
// gibt.
//
// Abhilfe ist ein nachträglich gesetztes `noindex` — Google wertet die
// robots-Angabe nach dem Ausführen des JavaScripts aus.
//
// Wichtig ist die Unterscheidung: Bei einer STÖRUNG darf kein noindex
// gesetzt werden. Die Anzeige gibt es vermutlich noch, nur die
// Verbindung klemmt. Sie deswegen aus dem Index zu werfen wäre schlimmer
// als das Problem.
const { test, expect } = require('./helpers/basis')
const { JOBS } = require('./helpers/fixtures')

async function robots(page) {
  return page.evaluate(() =>
    document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null)
}

test('eine pausierte oder gelöschte Anzeige wird auf noindex gesetzt', async ({ page }) => {
  await page.route('**/rest/v1/jobs*', route =>
    route.fulfill({
      status: 406, contentType: 'application/json',
      body: JSON.stringify({ code: 'PGRST116', message: 'no rows' }),
    }))

  await page.goto('/job.html?id=aaaaaaaa-0000-4000-8000-00000000dead')
  await expect(page.locator('main')).toContainText('nicht verfügbar')

  expect(await robots(page), 'sonst bleibt die tote Anzeige in Google').toBe('noindex')
  // Titel ehrlich halten - sonst steht in Tab und Suchergebnis weiter
  // "Minijob für Schüler".
  expect(await page.title()).toMatch(/nicht mehr verfügbar/i)
})

test('ohne Kennung in der Adresse ebenfalls', async ({ page }) => {
  await page.goto('/job.html')
  await expect(page.locator('main')).toContainText('nicht gefunden')
  expect(await robots(page)).toBe('noindex')
  expect(await page.title()).toMatch(/nicht gefunden/i)
})

test('bei einer Störung wird NICHT auf noindex gesetzt', async ({ page }) => {
  // Der wichtigste Test hier: Die Anzeige gibt es vermutlich noch.
  await page.route('**/rest/v1/jobs*', route => route.abort())

  await page.goto('/job.html?id=' + JOBS[0].id)
  await expect(page.locator('main')).toContainText(/nicht geladen|Verbindung|erneut/i)

  expect(await robots(page),
    'eine vorübergehende Störung darf die Anzeige nicht aus dem Index werfen').toBeNull()
})

test('eine vorhandene Anzeige bleibt indexierbar', async ({ page }) => {
  await page.goto('/job.html?id=' + JOBS[0].id)
  await page.waitForTimeout(800)

  expect(await robots(page)).toBeNull()
  expect(await page.title()).toContain(JOBS[0].titel)
})

// -----------------------------------------------------------------------
// Ehrlichkeit im Ratgeber: Ein Klick darf nicht unangekündigt in einer
// Anmelde-Sperre landen.
// -----------------------------------------------------------------------
test('der Ratgeber sagt dazu, wofür man ein Konto braucht', async ({ page }) => {
  // `lebenslauf.html` ruft requireAuth('schueler') auf und leitet
  // Nichtangemeldete zum Login um. Beim Bauen der Übersicht stand das
  // nicht dabei — ein Klick landete ohne Vorwarnung im Formular.
  await page.goto('/ratgeber.html')

  const karte = page.locator('.ratgeber-karte[href="lebenslauf.html"]')
  await expect(karte).toHaveCount(1)
  await expect(karte, 'der Hinweis muss in der Überschrift stehen, nicht nur im Kleingedruckten')
    .toContainText('Konto nötig')
  await expect(karte.locator('.ratgeber-hinweis')).toBeVisible()
})

test('alle anderen Ratgeber-Kacheln führen ohne Anmeldung ans Ziel', async ({ page }) => {
  // Wenn eine weitere Kachel dazukommt, die eine Anmeldung verlangt,
  // muss sie denselben Vermerk tragen.
  const MIT_ANMELDUNG = ['lebenslauf.html']

  await page.goto('/ratgeber.html')
  const karten = await page.locator('.ratgeber-karte').all()

  for (const k of karten) {
    const ziel = await k.getAttribute('href')
    const hatVermerk = await k.locator('.ratgeber-hinweis').count() > 0
    expect(hatVermerk, `${ziel}: Vermerk passt nicht zur Anmeldepflicht`)
      .toBe(MIT_ANMELDUNG.includes(ziel))
  }
})
