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
  'gesundheitszeugnis.html',
  'arbeitsvertrag.html',
  'bewerbungsfoto.html',
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

// ---------------------------------------------------------------------
// Der Ratgeber als Weg (27.8.)
//
// Anlass war der Blick auf schuelerjobs.de: Dort ist der Ratgeber eine
// Artikelliste. Hier sind die Artikel aber KEINE Kategorien, sondern
// eine Reihenfolge — „darf ich das überhaupt" → „was gibt es" → „was
// ist das wert" → „brauche ich was dafür" → „wie bewerbe ich mich" →
// „und in den Ferien". Weil die Reihenfolge wirklich Information trägt,
// sind es nummerierte Stationen.
//
// Und die Titel sind Fragen. So kommt ein Fünfzehnjähriger an: mit
// einer Frage, nicht mit einem Stichwort.
test.describe('der Weg durch den Ratgeber', () => {
  test('die Stationen stehen in der Reihenfolge, in der die Fragen kommen', async ({ page }) => {
    await page.goto('/ratgeber.html')
    const ziele = await page.locator('.weg-station a.ratgeber-karte')
      .evaluateAll(as => as.map(a => a.getAttribute('href')))

    expect(ziele).toEqual([
      'jugendarbeitsschutz.html',   // darf ich das überhaupt
      'jobideen.html',              // was gibt es
      'fairer-lohn.html',           // was ist das wert
      'gesundheitszeugnis.html',    // brauche ich was dafür
      'lebenslauf.html',            // wie bewerbe ich mich
      'bewerbungsfoto.html',        // gehört ein Bild dazu
      'arbeitsvertrag.html',        // was unterschreibe ich da
      'ferienjob.html',             // und in den Ferien
    ])
  })

  test('jede Station stellt eine Frage', async ({ page }) => {
    // Der Kern der Umstellung. „Fairer Lohn" ist ein Stichwort, „Was ist
    // das wert?" ist die Frage, mit der jemand ankommt.
    await page.goto('/ratgeber.html')
    const titel = await page.locator('.weg-station .ratgeber-karte b')
      .evaluateAll(bs => bs.map(b => b.textContent.trim()))
    const ohneFrage = titel.filter(t => !t.includes('?'))
    expect(ohneFrage, 'Station ohne Frage').toEqual([])
  })

  test('die Stationen sind nummeriert — und die Reihenfolge steht im Markup', async ({ page }) => {
    // Die sichtbaren Ziffern kommen aus einem CSS-Zähler; Chromium gibt
    // dort `counter(weg)` zurück statt der aufgelösten Ziffer, die lässt
    // sich also nicht direkt auslesen.
    //
    // Wichtiger ist ohnehin, dass die Reihenfolge nicht bloss gemalt
    // ist: Es muss eine echte <ol> sein. Dann liest ein Screenreader
    // „Liste mit 8 Einträgen, Eintrag 1 von 8" — und die Nummerierung
    // trägt für alle dieselbe Information, nicht nur für Sehende.
    await page.goto('/ratgeber.html')

    const liste = page.locator('.weg')
    expect(await liste.evaluate(el => el.tagName)).toBe('OL')
    await expect(liste.locator('> li.weg-station')).toHaveCount(8)

    const zaehler = await page.evaluate(() =>
      [...document.querySelectorAll('.weg-station')].map(el => ({
        erhoeht: getComputedStyle(el).counterIncrement,
        zeigt: getComputedStyle(el, '::after').content,
      })))
    for (const z of zaehler) {
      expect(z.erhoeht, 'Station erhöht den Zähler nicht').toMatch(/weg/)
      expect(z.zeigt, 'Station zeigt keine Nummer').toMatch(/counter\(weg\)|^"\d+"$/)
    }
  })

  test('die Linie verbindet, endet aber an der letzten Station', async ({ page }) => {
    // Eine Linie, die ins Leere weiterläuft, sieht nach Fehler aus.
    await page.goto('/ratgeber.html')
    const linien = await page.evaluate(() =>
      [...document.querySelectorAll('.weg-station')]
        .map(el => getComputedStyle(el, '::before').display))
    expect(linien.slice(0, -1).every(d => d === 'block'), 'Linie fehlt zwischen Stationen').toBe(true)
    expect(linien[linien.length - 1], 'Linie läuft über die letzte Station hinaus').toBe('none')
  })

  test('Eltern stehen NEBEN dem Weg, nicht darauf', async ({ page }) => {
    // Sie sind andere Leser mit anderen Fragen — deshalb ohne Nummern.
    await page.goto('/ratgeber.html')
    await expect(page.locator('.eltern-block .weg-station')).toHaveCount(0)
    await expect(page.locator('.eltern-block .ratgeber-karte')).toHaveCount(2)
  })

  test('die Bildzeichen stehen nicht im Linktext', async ({ page }) => {
    // Ein Bildzeichen gehört nicht in den vorgelesenen Namen des Links.
    // Es sitzt deshalb in der Station, nicht in der Karte.
    await page.goto('/ratgeber.html')
    await expect(page.locator('.ratgeber-karte .weg-marke')).toHaveCount(0)
    await expect(page.locator('.weg-station > .weg-marke')).toHaveCount(8)

    const versteckt = await page.locator('.weg-marke')
      .evaluateAll(els => els.every(e => e.getAttribute('aria-hidden') === 'true'))
    expect(versteckt, 'Bildzeichen müssen aria-hidden sein').toBe(true)
  })
})

test.describe('Gesundheitszeugnis', () => {
  test('sagt gleich, dass es keine Untersuchung ist', async ({ page }) => {
    // Der verbreitetste Irrtum: Der Name klingt nach Arztbesuch. Seit
    // 2001 ist es eine Belehrung.
    await page.goto('/gesundheitszeugnis.html')
    const text = await page.locator('main').innerText()
    expect(text).toMatch(/keine ärztliche Untersuchung/i)
    expect(text).toMatch(/§ 43/)
  })

  test('sagt, wer eine braucht — und wer nicht', async ({ page }) => {
    // Ohne die zweite Liste fragt sich jeder Nachhilfelehrer, ob er
    // jetzt zum Amt muss.
    await page.goto('/gesundheitszeugnis.html')
    const text = await page.locator('main').innerText()
    expect(text).toMatch(/Ja, du brauchst eine/)
    expect(text).toMatch(/Nein, brauchst du nicht/)
    expect(text, 'Nachhilfe gehört zu „nicht nötig"').toMatch(/Nachhilfe/)
  })

  test('nennt die drei Monate und die zwei Jahre', async ({ page }) => {
    await page.goto('/gesundheitszeugnis.html')
    const text = await page.locator('main').innerText()
    expect(text).toMatch(/drei Monate/i)
    expect(text).toMatch(/zwei Jahre/i)
  })

  test('sagt, dass es Geld kostet und wer es übernimmt', async ({ page }) => {
    await page.goto('/gesundheitszeugnis.html')
    const text = await page.locator('main').innerText()
    expect(text).toMatch(/Euro/)
    expect(text, 'der Arbeitgeber zahlt es oft').toMatch(/übernimmt|übernehmen/i)
  })
})
