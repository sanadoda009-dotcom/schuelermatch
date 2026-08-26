// Ratgeber-Übersicht und Auffindbarkeit (26.8.).
//
// Anlass: Beim Zählen der Links auf der Startseite kam heraus, dass
// `ferienjob.html`, `taschengeld.html` und `fairer-lohn.html` von dort
// aus NUR über den Footer erreichbar waren — kein einziger Link aus dem
// Inhalt. Beide Seiten hatte ich am selben Tag selbst gebaut und
// jeweils bloß in den Footer gehängt. Dort sterben Links.
//
// Besonders unglücklich beim Ferienjob: Wenn im Oktober die
// Herbstferien anfangen, findet die Seite niemand.
//
// Gelöst über einen eigenen Eintrag in der Hauptnavigation statt über
// eine fünfte Kachel auf der Startseite — das Wege-Raster hat vier
// Spalten, eine fünfte Karte hätte allein in der zweiten Zeile
// gestanden.
//
// Der letzte Test hier ist der eigentliche Gewinn: Er zwingt dazu, jede
// neue Ratgeberseite auch einzutragen.
const { test, expect } = require('./helpers/basis')

// Jede Seite, die in die Übersicht gehört. Neue Ratgeberseiten hier
// eintragen — dann meckert der Test, bis sie auch verlinkt ist.
const RATGEBERSEITEN = [
  'jugendarbeitsschutz.html',
  'fairer-lohn.html',
  'ferienjob.html',
  'jobideen.html',
  'lebenslauf.html',
  'eltern.html',
  'taschengeld.html',
]

test('die Übersicht verlinkt jede Ratgeberseite', async ({ page }) => {
  await page.goto('/ratgeber.html')
  const fehlend = []
  for (const ziel of RATGEBERSEITEN) {
    if (await page.locator(`main a[href="${ziel}"]`).count() === 0) fehlend.push(ziel)
  }
  expect(fehlend,
    'Diese Seiten fehlen in ratgeber.html und sind damit schwer zu finden: ' + fehlend.join(', ')
  ).toEqual([])
})

test('jede Kachel sagt, was einen dort erwartet', async ({ page }) => {
  await page.goto('/ratgeber.html')
  const karten = page.locator('.ratgeber-karte')
  expect(await karten.count()).toBeGreaterThanOrEqual(RATGEBERSEITEN.length)

  // Eine Überschrift allein hilft niemandem bei der Auswahl.
  //
  // `> span` statt `span`: Seit dem Vermerk „Konto nötig" gibt es ein
  // zweites span INNERHALB des <b>. Ohne den direkten Kindselektor
  // trifft die Auswahl beide und Playwright bricht ab.
  for (const k of await karten.all()) {
    await expect(k.locator('b')).not.toBeEmpty()
    const text = await k.locator('> span').innerText()
    expect(text.length, 'Kachel ohne Erklärung: ' + await k.locator('b').innerText())
      .toBeGreaterThan(40)
  }
})

test('sie trennt nach Zielgruppe', async ({ page }) => {
  await page.goto('/ratgeber.html')
  const text = await page.locator('main').innerText()
  expect(text).toContain('Für Schüler')
  expect(text).toContain('Für Eltern')
})

test('sie nennt zuerst das Wichtigste', async ({ page }) => {
  // Wer nur eine Sache liest, soll die richtige lesen.
  await page.goto('/ratgeber.html')
  const zuerst = await page.locator('.legal-highlight').first().innerText()
  expect(zuerst).toMatch(/nur eine Sache/i)
  await expect(page.locator('.legal-highlight').first().locator('a[href="jugendarbeitsschutz.html"]'))
    .toHaveCount(1)
})

test('die Kacheln sind nicht unterstrichen wie Fließtext-Links', async ({ page }) => {
  // .legal-page a unterstreicht alle Verweise — bei einer Kachel wäre
  // das falsch. Dieselbe Falle wie bei den Knöpfen.
  await page.goto('/ratgeber.html')
  const deko = await page.locator('.ratgeber-karte').first()
    .evaluate(el => getComputedStyle(el).textDecorationLine)
  expect(deko).toBe('none')
})

// -----------------------------------------------------------------------
// Auffindbarkeit — der Test, der den Fehler dieser Runde verhindert.
// -----------------------------------------------------------------------
test('der Ratgeber steht in der Hauptnavigation, nicht nur im Footer', async ({ page }) => {
  for (const seite of ['/index.html', '/jobs.html', '/ferienjob.html', '/taschengeld.html']) {
    await page.goto(seite)
    await expect(page.locator('nav .nav-links a[href="ratgeber.html"]'),
      `${seite}: Ratgeber fehlt in der Navigation`).toHaveCount(1)
  }
})

test('jede Ratgeberseite ist von der Startseite aus in zwei Klicks erreichbar', async ({ page }) => {
  // Erster Klick: Navigation -> Ratgeber. Zweiter: die Kachel.
  // Vorher waren Ferienjob, Taschengeld und Fairer Lohn nur im Footer.
  await page.goto('/index.html')
  await expect(page.locator('nav .nav-links a[href="ratgeber.html"]')).toHaveCount(1)

  await page.locator('nav .nav-links a[href="ratgeber.html"]').click()
  await expect(page).toHaveURL(/ratgeber\.html/)

  for (const ziel of RATGEBERSEITEN) {
    await expect(page.locator(`main a[href="${ziel}"]`).first(),
      `${ziel} ist von der Übersicht aus nicht erreichbar`).toBeVisible()
  }
})

test('sie steht in der sitemap', async ({ page }) => {
  const res = await page.request.get('/sitemap.xml')
  expect(await res.text()).toContain('ratgeber.html')
})
