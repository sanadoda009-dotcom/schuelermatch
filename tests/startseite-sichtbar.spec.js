// 68 % der Startseite hingen an einer Zierde (4.9.2026).
//
// DER BEFUND, gemessen mit blockiertem `js/reveal.js`:
//
//   /index.html        22 von 22 .reveal-Abschnitten unsichtbar
//                      3286 von 4835 Zeichen weg  → 68 %
//   /fuer-firmen.html  keine .reveal-Elemente
//   /ratgeber.html     keine
//   /eltern.html       keine
//
// `.reveal` startete mit `opacity: 0`, und sichtbar wurde es erst, wenn
// `js/reveal.js` lief. Kam die Datei nicht an — Netzwerkaussetzer,
// blockiertes Skript, JavaScript aus —, blieb der halbe Seiteninhalt
// dauerhaft unsichtbar. Nicht eingeschränkt: weg. Und das für eine
// reine Einblend-Animation.
//
// Ein `<noscript>` gab es im ganzen Projekt nicht.
//
// DIE UMKEHRUNG
// `.reveal` ist jetzt per CSS SICHTBAR. Ausgeblendet wird erst unter
// `html.js-reveal`, und diese Klasse setzt der Kopf von index.html —
// mit einer Notbremse: Meldet sich `js/reveal.js` nicht innerhalb von
// 2,5 Sekunden mit `window.__revealBereit`, kommt die Klasse wieder weg
// und alles ist da.
//
// Die Klasse steht im KOPF, nicht im Skript: sonst wäre der Inhalt kurz
// zu sehen und würde dann zuklappen.

const { test, expect } = require('./helpers/basis')

async function sichtbarkeit(page) {
  return page.evaluate(() => {
    const alle = [...document.querySelectorAll('.reveal')]
    const unsichtbar = alle.filter(e => parseFloat(getComputedStyle(e).opacity) < 0.05)
    return { alle: alle.length, unsichtbar: unsichtbar.length }
  })
}

test.describe('ohne js/reveal.js', () => {
  test('bleibt die Startseite lesbar', async ({ page }) => {
    await page.route('**/js/reveal.js', r => r.abort())
    await page.goto('/index.html')
    // Die Notbremse braucht ihre 2,5 Sekunden.
    await expect.poll(async () => (await sichtbarkeit(page)).unsichtbar,
      { timeout: 15_000 }).toBe(0)

    const z = await sichtbarkeit(page)
    expect(z.alle, 'keine .reveal-Elemente mehr? Dann prüft der Test nichts')
      .toBeGreaterThan(10)
  })

  test('und der Text steht wirklich da', async ({ page }) => {
    // Die Zahl aus der Messung: rund 4800 Zeichen insgesamt, davon
    // hingen 3286 an der Animation.
    await page.route('**/js/reveal.js', r => r.abort())
    await page.goto('/index.html')
    await expect.poll(async () => (await sichtbarkeit(page)).unsichtbar,
      { timeout: 15_000 }).toBe(0)
    const zeichen = await page.evaluate(() => document.body.innerText.length)
    expect(zeichen).toBeGreaterThan(3000)
  })

  test('die Notbremse nimmt die Klasse wieder weg', async ({ page }) => {
    await page.route('**/js/reveal.js', r => r.abort())
    await page.goto('/index.html')
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.classList.contains('js-reveal')),
      { timeout: 15_000 }).toBe(false)
  })
})

test.describe('mit js/reveal.js', () => {
  test('läuft die Animation weiter wie bisher', async ({ page }) => {
    await page.goto('/index.html')
    await expect.poll(async () =>
      page.evaluate(() => window.__revealBereit === true), { timeout: 15_000 }).toBe(true)
    await expect(page.locator('html')).toHaveClass(/js-reveal/)
  })

  test('beim Scrollen blendet sich der Inhalt ein', async ({ page }) => {
    // Nachgemessen: Im Testfenster liegt KEIN .reveal von Anfang an im
    // Bild — der erste ist eine Abschnittsüberschrift unterhalb des
    // Kopfbereichs. „Sofort sichtbar" wäre also die falsche Erwartung.
    // Geprüft gehört, dass der Beobachter beim Scrollen wirklich greift;
    // täte er das nicht, bliebe die Seite mit Skript halb leer.
    await page.goto('/index.html')
    await expect(page.locator('html')).toHaveClass(/js-reveal/)
    expect(await page.locator('.reveal.in-view').count()).toBe(0)

    await page.locator('.reveal').first().scrollIntoViewIfNeeded()
    await expect(page.locator('.reveal.in-view').first()).toBeVisible({ timeout: 15_000 })
  })

  test('die Klasse bleibt, solange das Skript da ist', async ({ page }) => {
    // Gegenstück zur Notbremse: Sie darf nicht auch dann zuschlagen,
    // wenn alles in Ordnung ist — sonst wäre die Animation immer aus.
    await page.goto('/index.html')
    await page.waitForTimeout(3500)
    await expect(page.locator('html')).toHaveClass(/js-reveal/)
  })
})

test('kein Layoutsprung durch die Umstellung', async ({ page }) => {
  // opacity und transform verschieben nichts im Layout — aber das ist
  // eine Annahme, und layoutsprung.spec.js misst nur den Ladezustand.
  await page.goto('/index.html')
  const hoehe = async () => page.evaluate(() => document.body.scrollHeight)
  const vorher = await hoehe()
  await page.waitForTimeout(1500)
  expect(Math.abs(await hoehe() - vorher)).toBeLessThan(30)
})
