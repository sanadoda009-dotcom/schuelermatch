// Arbeitgeber-Seite.
//
// Warum es sie gibt (25.8.): Für Unternehmen gab es bisher nur einen
// kleinen Kasten auf der Startseite mit vier Stichpunkten. Dabei hängt
// der Start der Plattform an ihnen – ohne Anzeigen ist die Jobbörse leer.
//
// Das stärkste Argument stand nirgends: Wer Minderjährige beschäftigt,
// haftet nach dem Jugendarbeitsschutzgesetz (Bußgelder bis 30.000 €).
// Die Mindestalter-Prüfung nimmt dem Arbeitgeber genau dieses Risiko ab –
// das ist der Unterschied zu einem Aushang oder einer allgemeinen
// Jobbörse.
const { test, expect, setupDashboard } = require('./helpers/supabase-fake')

test.beforeEach(async ({ page }) => {
  await setupDashboard(page.context(), {})
  await page.goto('/fuer-firmen.html')
  await page.waitForTimeout(800)
})

test('der Jugendarbeitsschutz wird konkret erklärt', async ({ page }) => {
  // Allgemeine Beteuerungen helfen einem Café-Besitzer nicht – er will
  // wissen, was er falsch machen kann.
  const text = await page.locator('main').innerText()
  expect(text).toContain('Jugendarbeitsschutz')
  expect(text, 'Bußgeldhöhe genannt').toContain('30.000')
  for (const grenze of ['13', '2 Stunden', '20 Uhr', '22 Uhr', '4 Wochen']) {
    expect(text, `Grenze "${grenze}"`).toContain(grenze)
  }
})

test('der eigene Nutzen wird an den Jugendschutz geknüpft', async ({ page }) => {
  // Der Kern des Arguments: Sie tragen ein Mindestalter ein, wir filtern.
  const text = await page.locator('main').innerText()
  expect(text).toContain('Mindestalter')
})

test('es steht dabei, dass das keine Rechtsberatung ist', async ({ page }) => {
  const text = await page.locator('main').innerText()
  expect(text.toLowerCase()).toContain('keine rechtsberatung')
  // Und wohin man sich stattdessen wendet.
  expect(text).toMatch(/Gewerbeaufsicht|Handelskammer/)
})

test('die Seite verspricht keine Nutzerzahlen', async ({ page }) => {
  // Die Plattform startet gerade. Erfundene Reichweite wäre der schnellste
  // Weg, das Vertrauen eines Arbeitgebers zu verlieren.
  const text = await page.locator('main').innerText()
  expect(text, 'sagt offen, dass es gerade losgeht').toMatch(/startet gerade/i)
  expect(text).not.toMatch(/\d{3,}\s*(Schüler|Nutzer|Unternehmen|Firmen)/)
})

test('der Preis wird ehrlich benannt', async ({ page }) => {
  const text = await page.locator('main').innerText()
  expect(text).toMatch(/kostenlos|kostet Sie nichts|Zurzeit nichts/i)
  // Und der Hinweis, dass das nicht ewig so bleibt – lieber jetzt sagen
  // als später überraschen.
  expect(text).toMatch(/nicht für immer|rechtzeitig/i)
})

test('der Ablauf ist in Schritte gegliedert', async ({ page }) => {
  await expect(page.locator('.firma-schritte li')).toHaveCount(3)
})

test('es geht direkt zur Registrierung als Firma', async ({ page }) => {
  const knopf = page.locator('a[href="register.html?rolle=firma"]').first()
  await expect(knopf).toBeVisible()
})

test('die Vorlage für die Elterneinwilligung ist verlinkt', async ({ page }) => {
  // Arbeitgeber müssen sie einholen – und sollen nicht selbst suchen.
  await expect(page.locator('a[href="eltern.html#einverstaendnis"]')).toHaveCount(1)
})

test('die Seite sagt auch, für wen sie NICHT passt', async ({ page }) => {
  // Ehrlichkeit spart beiden Seiten Zeit.
  const text = await page.locator('main').innerText()
  expect(text).toMatch(/Weniger geeignet/i)
})

test('von den öffentlichen Seiten aus erreichbar', async ({ page }) => {
  for (const pfad of ['/index.html', '/jobs.html', '/eltern.html']) {
    await page.goto(pfad)
    await page.waitForTimeout(500)
    await expect(page.locator('a[href="fuer-firmen.html"]').first(),
      `Link auf ${pfad}`).toHaveCount(1)
  }
})

test('die Altersangaben widersprechen der Elternseite nicht', async ({ page }) => {
  // Drei Seiten erklären inzwischen dasselbe Gesetz. Sie dürfen sich
  // nicht widersprechen.
  const firmen = await page.locator('main').innerText()
  await page.goto('/eltern.html')
  await page.waitForTimeout(500)
  const eltern = await page.locator('main').innerText()

  for (const wert of ['2 Stunden', '4 Wochen', '22 Uhr']) {
    expect(firmen, `Arbeitgeber-Seite nennt "${wert}"`).toContain(wert)
    expect(eltern, `Elternseite nennt "${wert}"`).toContain(wert)
  }
})
