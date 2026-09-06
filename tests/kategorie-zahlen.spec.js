// Wie viele Anzeigen stehen hinter einem Kategorie-Knopf? (4.9.2026)
//
// DER ANLASS: Sanad, sinngemäß — „was wurde an Jobs verändert, ich sehe
// kaum Unterschied". Am 4.9. auf der laufenden Datenbank nachgezählt:
//
//   5 aktive Anzeigen · 1 Firma · 3 Orte · 3 Kategorien
//
// Die Leiste bietet aber ELF Kategorien an. Acht davon führten direkt in
// den leeren Trefferfall, und welche das sind, sah man erst nach dem
// Klick. Bei so wenig Angebot ist das der Unterschied zwischen „hier ist
// nichts los" und „hier sind drei Bereiche, in denen etwas geht".
//
// GEZÄHLT WIRD UNTER DEN ÜBRIGEN FILTERN. Eine Zahl, die den gesetzten
// Ort ignoriert, wäre eine Lüge: Sie verspräche „Verkauf 2", während mit
// dem Ort null erreichbar sind. `zaehleNach` nimmt deshalb das gezählte
// Feld selbst aus dem Filter — dieselbe Überlegung wie bei
// `entlastungen` (tests/leerer-treffer.spec.js).

const { test, expect } = require('./helpers/basis')

// Die Testdaten (tests/helpers/fixtures.js): vier Anzeigen —
//   Café Sonnenschein  München   Gastronomie
//   Mathe-Nachhilfe    München   Nachhilfe
//   Getränkemarkt      Augsburg  Verkauf
//   Hunde ausführen    München   Tierbetreuung

const JOBS = [
  { id: 'a', titel: 'Kellnern', ort: 'München', mindestalter: 16, stundenlohn: 13, kategorie: 'Gastronomie', arbeitszeit: 'Wochenende' },
  { id: 'b', titel: 'Nachhilfe', ort: 'München', mindestalter: 15, stundenlohn: 15, kategorie: 'Nachhilfe', arbeitszeit: 'Nachmittags' },
  { id: 'c', titel: 'Regale', ort: 'Augsburg', mindestalter: 14, stundenlohn: 12, kategorie: 'Verkauf', arbeitszeit: 'Wochenende' },
  { id: 'd', titel: 'Regale 2', ort: 'Augsburg', mindestalter: 14, stundenlohn: 12, kategorie: 'Verkauf', arbeitszeit: 'Wochenende' },
]

async function modul(page, fn, arg) {
  return page.evaluate(async ({ code, arg }) => {
    const m = await import('/js/filter-vorschlag.js')
    return new Function('m', 'a', 'return (' + code + ')(m, a)')(m, arg)
  }, { code: fn.toString(), arg })
}

test.describe('die Zählung selbst', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/index.html') })

  test('zählt je Kategorie', async ({ page }) => {
    const r = await modul(page, (m, a) => m.zaehleNach(a.jobs, {}, 'kategorie'), { jobs: JOBS })
    expect(r).toEqual({ Gastronomie: 1, Nachhilfe: 1, Verkauf: 2 })
  })

  test('lässt die eigene Kategorie aus dem Filter heraus', async ({ page }) => {
    // Sonst stünde bei gewählter Kategorie überall 0 außer bei einer.
    const r = await modul(page, (m, a) => m.zaehleNach(a.jobs, { kategorie: 'Verkauf' }, 'kategorie'),
      { jobs: JOBS })
    expect(r).toEqual({ Gastronomie: 1, Nachhilfe: 1, Verkauf: 2 })
  })

  test('rechnet die übrigen Filter aber mit', async ({ page }) => {
    // Das ist der Punkt: Mit dem Ort Augsburg sind Gastronomie und
    // Nachhilfe nicht erreichbar — die Zahl muss das sagen.
    const r = await modul(page, (m, a) => m.zaehleNach(a.jobs, { ort: 'augsburg' }, 'kategorie'),
      { jobs: JOBS })
    expect(r).toEqual({ Verkauf: 2 })
  })

  test('Anzeigen ohne Kategorie zählen nirgends mit', async ({ page }) => {
    const r = await modul(page, (m, a) => m.zaehleNach(a.jobs, {}, 'kategorie'), {
      jobs: [...JOBS, { id: 'x', titel: 'Ohne', ort: 'München', kategorie: null, stundenlohn: 9, mindestalter: 13 }],
    })
    expect(r.null).toBeUndefined()
    expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(4)
  })
})

test.describe('in der Jobbörse', () => {
  async function zahlVon(page, kategorie) {
    const pill = kategorie
      ? page.locator(`#kategorie-pills .pill[data-kat="${kategorie}"]`)
      : page.locator('#kategorie-pills .pill[data-kat=""]')
    return (await pill.locator('.pill-zahl').textContent()).trim()
  }

  test('jeder Knopf trägt seine Zahl', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
    expect(await zahlVon(page, null)).toBe('4')          // „Alle"
    expect(await zahlVon(page, 'Nachhilfe')).toBe('1')
    expect(await zahlVon(page, 'Verkauf')).toBe('1')
  })

  test('leere Kategorien sind als solche erkennbar', async ({ page }) => {
    // Acht der elf Knöpfe führten ins Leere, ohne dass man es vorher sah.
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
    expect(await zahlVon(page, 'Technik & Computer')).toBe('0')
    await expect(page.locator('#kategorie-pills .pill[data-kat="Technik & Computer"]'))
      .toHaveClass(/pill--leer/)
    await expect(page.locator('#kategorie-pills .pill[data-kat="Nachhilfe"]'))
      .not.toHaveClass(/pill--leer/)
  })

  test('die Zahlen folgen den übrigen Filtern', async ({ page }) => {
    // Mit dem Ort Augsburg ist in den Testdaten nur Verkauf erreichbar.
    await page.goto('/jobs.html?ort=Augsburg')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
    expect(await zahlVon(page, 'Verkauf')).toBe('1')
    expect(await zahlVon(page, 'Nachhilfe')).toBe('0')
    expect(await zahlVon(page, null)).toBe('1')
  })

  test('die Zahl steht auch nach einem Klick richtig da', async ({ page }) => {
    // Beim Wählen einer Kategorie darf die eigene Zahl nicht auf 1
    // zusammenfallen und die anderen nicht auf 0 – sonst wäre die Leiste
    // nach dem ersten Klick wertlos.
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
    await page.locator('#kategorie-pills .pill[data-kat="Nachhilfe"]').click()
    await expect(page.locator('.job-card')).toHaveCount(1)
    expect(await zahlVon(page, 'Verkauf')).toBe('1')
    expect(await zahlVon(page, 'Nachhilfe')).toBe('1')
  })

  test('ein Screenreader hört nicht nur „Nachhilfe 1"', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('#kategorie-pills .pill[data-kat="Nachhilfe"]'))
      .toHaveAttribute('aria-label', 'Nachhilfe: 1 Anzeige')
    await expect(page.locator('#kategorie-pills .pill[data-kat="Technik & Computer"]'))
      .toHaveAttribute('aria-label', 'Technik & Computer: 0 Anzeigen')
  })

  test('die Beschriftung wird beim zweiten Durchlauf nicht doppelt', async ({ page }) => {
    // Die Zahl steckt IM Knopf. Wer beim nächsten Mal `textContent`
    // ausliest, um die Beschriftung zu bilden, liest die eigene Zahl mit.
    await page.goto('/jobs.html')
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
    await page.locator('#filter-suche').fill('nachhilfe')
    await expect(page.locator('.job-card')).toHaveCount(1)
    await expect(page.locator('#kategorie-pills .pill[data-kat="Nachhilfe"]'))
      .toHaveAttribute('aria-label', 'Nachhilfe: 1 Anzeige')
  })
})
