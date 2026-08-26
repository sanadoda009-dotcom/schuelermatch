// Taschengeldtabelle (26.8.).
//
// Anlass: Der Wettbewerber schuelerjobs.de hat genau diese Seite, und
// „Taschengeldtabelle" wird stark gesucht — vor allem von ELTERN. Die
// sind bei Minderjährigen ohnehin die Instanz, die zustimmen muss
// (Art. 8 DSGVO). Eine ernsthafte Seite für sie ist deshalb doppelt
// wertvoll.
//
// Beim Recherchieren fiel auf, dass drei Quellen drei verschiedene
// Tabellen zeigen — auch der Wettbewerber weicht ab. Das liegt daran,
// dass es keine amtliche Tabelle gibt, sondern Empfehlungen. Diese
// Seite nennt deshalb ausdrücklich Quelle und Stand, statt eine Zahl
// als gesetzt hinzustellen. Genau das prüfen diese Tests.
const { test, expect } = require('./helpers/basis')

test.beforeEach(async ({ page }) => {
  await page.goto('/taschengeld.html')
})

test('die Tabelle deckt alle Altersstufen ab', async ({ page }) => {
  const tabelle = page.locator('.lohn-tabelle').first()
  const text = await tabelle.innerText()

  // Die Stufen der DJI-Empfehlung.
  for (const stufe of ['Unter 6', '6 bis 7', '8 bis 9', '10 bis 11',
                       '12 bis 13', '14 bis 15', '16 bis 17', 'Ab 18']) {
    expect(text, `Altersstufe fehlt: ${stufe}`).toContain(stufe)
  }
})

test('sie nennt Quelle und Stand der Zahlen', async ({ page }) => {
  const text = await page.locator('main').innerText()
  expect(text, 'ohne Quelle ist eine Tabelle wertlos').toContain('Deutschen Jugendinstituts')
  expect(text, 'der Stand muss dastehen').toMatch(/September 2025/)
  // Und ein Verweis, wo man es nachlesen kann.
  await expect(page.locator('main a[href*="dji.de"]')).toHaveCount(1)
})

test('sie sagt, dass es keine Pflicht ist', async ({ page }) => {
  // Der häufigste Irrtum: Eltern hielten die Tabelle für bindend.
  const text = await page.locator('main').innerText()
  expect(text).toMatch(/keine gesetzliche Pflicht/i)
  expect(text, 'Empfehlung, nicht Gesetz').toMatch(/Empfehlung/)
})

test('sie erklärt, warum andere Seiten andere Zahlen zeigen', async ({ page }) => {
  // Wer vergleicht, soll den Unterschied einordnen können, statt zu
  // denken, eine der Seiten habe sich verrechnet.
  const text = await page.locator('main').innerText()
  expect(text).toMatch(/andere Zahlen/i)
  expect(text).toMatch(/keine amtliche Tabelle|keine Vorschrift/i)
})

test('der Wechsel von wöchentlich auf monatlich wird begründet', async ({ page }) => {
  const text = await page.locator('main').innerText()
  expect(text).toMatch(/Woche/)
  expect(text).toMatch(/Monat/)
  expect(text, 'die Begründung fehlt sonst').toMatch(/planen/i)
})

test('sie schlägt die Brücke zum eigenen Verdienst — ohne Taschengeld schlechtzureden',
  async ({ page }) => {
    const text = await page.locator('main').innerText()
    expect(text, 'der Vergleich ist der Grund, warum die Seite hierher gehört')
      .toMatch(/Nebenjob|selbst verdien/i)
    // Wichtig: kein „Taschengeld ist überflüssig". Beide haben ihren Zweck.
    expect(text).toMatch(/kein Argument gegen Taschengeld/i)
  })

test('die Geldangaben stimmen mit dem Rest der Seite überein', async ({ page }) => {
  const text = await page.locator('main').innerText()
  // Minijob-Grenze: am 26.8. auf allen Seiten von 556 auf 603 korrigiert.
  expect(text, 'veralteter Wert').not.toContain('556')
  expect(text).toContain('603')
})

test('sie verweist auf die Rechtsseiten statt sie nachzuerzählen', async ({ page }) => {
  await expect(page.locator('main a[href="jugendarbeitsschutz.html"]')).toHaveCount(1)
  await expect(page.locator('main a[href="fairer-lohn.html"]')).toHaveCount(1)
  await expect(page.locator('main a[href="eltern.html"]')).toHaveCount(1)
})

test('sie macht klar, dass sie keine Beratung ersetzt', async ({ page }) => {
  await expect(page.locator('main')).toContainText(/keine Rechts- oder Erziehungsberatung/)
})

test('die Seite ist von der Startseite aus erreichbar', async ({ page }) => {
  await page.goto('/index.html')
  await expect(page.locator('footer a[href="taschengeld.html"]')).toHaveCount(1)
})

test('sie steht in der sitemap', async ({ page }) => {
  const res = await page.request.get('/sitemap.xml')
  expect((await res.text())).toContain('taschengeld.html')
})
