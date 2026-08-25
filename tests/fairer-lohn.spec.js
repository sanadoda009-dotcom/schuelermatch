// Seite über faire Bezahlung.
//
// Anlass (25.8.): Im Ratgeber von schuelerjobs.de stand ein Satz, der bei
// uns nirgends vorkam: "Ein Recht auf einen bestimmten Stundenlohn hast du
// als Schüler nicht – auch nicht auf den Mindestlohn."
//
// Das stimmt (§ 22 Abs. 2 Mindestlohngesetz: gilt nicht für Personen unter
// 18 ohne abgeschlossene Berufsausbildung) und ist für eine Plattform, die
// Minderjährige schützen will, ein Kernthema: Wer das nicht weiß, hält ein
// schlechtes Angebot womöglich für gesetzlich garantiert.
//
// Nebenbei fiel auf, dass unser Filter "Mindestlohn" hieß – was genau den
// falschen Eindruck erweckt. Er heißt jetzt "Stundenlohn ab".
const { test, expect, setupDashboard } = require('./helpers/supabase-fake')

test.beforeEach(async ({ page }) => {
  await setupDashboard(page.context(), {})
  await page.goto('/fairer-lohn.html')
  await page.waitForTimeout(800)
})

test('die Mindestlohn-Ausnahme steht klar da', async ({ page }) => {
  const text = await page.locator('main').innerText()
  expect(text).toContain('Mindestlohn')
  expect(text, 'sagt, dass er nicht gilt').toMatch(/gilt für dich .{0,10}nicht|nicht.{0,20}Mindestlohn/i)
  expect(text, 'nennt die Fundstelle').toContain('22')
})

test('sie sagt auch, was daraus NICHT folgt', async ({ page }) => {
  // Wichtig: "Kein Mindestlohn" heißt nicht "du musst alles annehmen".
  const text = await page.locator('main').innerText()
  expect(text).toMatch(/nicht.{0,40}alles annehmen/i)
})

test('es gibt konkrete Zahlen statt Allgemeinplätzen', async ({ page }) => {
  const zeilen = page.locator('.lohn-zeile')
  // Kopfzeile plus mindestens acht Tätigkeiten.
  expect(await zeilen.count()).toBeGreaterThanOrEqual(9)
  const text = await page.locator('.lohn-tabelle').innerText()
  expect(text).toContain('Nachhilfe')
  expect(text).toMatch(/\d+–\d+ €/)
})

test('die Warnzeichen sind konkret', async ({ page }) => {
  // Ein Schüler soll erkennen, wann etwas nicht stimmt.
  const text = await page.locator('main').innerText()
  for (const zeichen of ['Probearbeit', 'Trinkgeld', 'Vorkasse']) {
    expect(text, `Warnzeichen "${zeichen}"`).toContain(zeichen)
  }
})

test('es stehen Sätze da, die man wirklich sagen kann', async ({ page }) => {
  // Nachfragen ist mit 15 unangenehm – fertige Formulierungen helfen mehr
  // als der Rat "verhandle einfach".
  const text = await page.locator('main').innerText()
  expect(text).toMatch(/„.{20,}"/)
})

test('die Löhne stimmen mit der Jobideen-Seite überein', async ({ page }) => {
  // Zwei Seiten mit Zahlen dürfen sich nicht widersprechen.
  const lohn = await page.locator('.lohn-tabelle').innerText()
  await page.goto('/jobideen.html')
  await page.waitForTimeout(600)
  const ideen = await page.locator('main').innerText()

  // Stichproben: Nachhilfe und Kasse im Einzelhandel
  expect(lohn).toContain('10–15')
  expect(ideen).toContain('10–15')
  expect(lohn).toContain('13–15')
  expect(ideen).toContain('13–15')
})

test('der Filter heißt nicht mehr irreführend "Mindestlohn"', async ({ page }) => {
  await page.goto('/jobs.html')
  await page.waitForTimeout(800)
  const label = await page.locator('label[for="filter-gehalt"]').innerText()
  expect(label, 'kein falscher Eindruck eines gesetzlichen Anspruchs').not.toBe('Mindestlohn')
  expect(label).toContain('Stundenlohn')
})

test('von der Jobideen-Seite aus verlinkt', async ({ page }) => {
  await page.goto('/jobideen.html')
  await page.waitForTimeout(600)
  await expect(page.locator('main a[href="fairer-lohn.html"]')).toHaveCount(1)
})
