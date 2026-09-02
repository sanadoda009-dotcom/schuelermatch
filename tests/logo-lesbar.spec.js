// Die Wortmarke muss lesbar bleiben (2.9.2026).
//
// ANLASS: Sanad — „kannst du dieses gefüllte e und Match fixen, weil da
// sieht man ja nicht klar den Buchstaben". Gemeint war die Fußzeile.
//
// Die Wortmarke ist ein Bild (480×91). In der Fußzeile stand sie auf 26px
// Höhe — das sind rund 8px pro Buchstabe. Bei der Größe fällt die Punze
// im „e" und im „a" zu, und „SchülerMatch" liest sich als Klumpen. Auf
// dunklem Grund fällt es zusätzlich auf, weil weiße Schrift dort ausläuft.
//
// Wichtig für später: Eine höher aufgelöste Datei hilft dagegen NICHT.
// Die Quelle ist bereits 3,5-mal so groß wie die Anzeige — die
// ANZEIGEGRÖSSE ist die Grenze, nicht die Auflösung.
//
// Gemessen: 26px zu · 32px grenzwertig · ab 34px offen.

const { test, expect } = require('./helpers/basis')

// Unter diesen Höhen war die Wortmarke im Versuch nicht mehr lesbar.
const MIN_FUSS = 30
const MIN_KOPF = 28

test('die Wortmarke in der Fußzeile ist groß genug zum Lesen', async ({ page }) => {
  await page.goto('/index.html')
  const h = await page.locator('.footer-logo-img')
    .evaluate(el => el.getBoundingClientRect().height)
  expect(Math.round(h), 'Fußzeilen-Logo zu klein – das „e" fällt zu')
    .toBeGreaterThanOrEqual(MIN_FUSS)
})

test('die Wortmarke in der Kopfzeile ist groß genug – auch auf dem Handy', async ({ page }) => {
  for (const breite of [1280, 390]) {
    await page.setViewportSize({ width: breite, height: 800 })
    await page.goto('/index.html')
    const h = await page.locator('.logo-img').first()
      .evaluate(el => el.getBoundingClientRect().height)
    expect(Math.round(h), `Kopfzeilen-Logo bei ${breite}px zu klein`)
      .toBeGreaterThanOrEqual(MIN_KOPF)
  }
})

test('die Marke behält ihr Seitenverhältnis', async ({ page }) => {
  // Ein verzerrtes Logo ist schlimmer als ein kleines.
  await page.goto('/index.html')
  const schief = await page.locator('img.logo-img, img.footer-logo-img').evaluateAll(bilder =>
    bilder.filter(b => b.naturalWidth && b.getBoundingClientRect().height)
      .filter(b => {
        const r = b.getBoundingClientRect()
        return Math.abs(r.width / r.height - b.naturalWidth / b.naturalHeight) > 0.02
      })
      .map(b => `${b.className}: ${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`))
  expect(schief, 'Logo verzerrt').toEqual([])
})
