// Elternseite mit Einverständniserklärung zum Ausdrucken.
//
// Warum es sie gibt (25.8.): Beim Vergleich mit schuelerjobs.de fiel deren
// Rubrik "Informationen für Eltern" auf – samt Einverständniserklärung
// zum Download. Bei uns fehlte beides, obwohl Eltern hier gleich doppelt
// gebraucht werden: für die Anmeldung unter 16 (Art. 8 DSGVO) und für den
// Job selbst, den jeder seriöse Arbeitgeber schriftlich bestätigt haben
// will. Dazu sind Eltern oft diejenigen, die die Plattform prüfen, bevor
// das Kind sich überhaupt anmeldet.
const { test, expect, setupDashboard } = require('./helpers/supabase-fake')

test.beforeEach(async ({ page }) => {
  await setupDashboard(page.context(), {})
  await page.goto('/eltern.html')
  await page.waitForTimeout(800)
})

test('die Einverständniserklärung ist da und ausfüllbar', async ({ page }) => {
  const vorlage = page.locator('.druck-vorlage')
  await expect(vorlage).toBeVisible()

  // Die Felder, die ein Arbeitgeber erwartet.
  const text = await vorlage.innerText()
  for (const feld of ['Name des Kindes', 'Geburtsdatum', 'Name des Arbeitgebers',
                      'Art der Tätigkeit', 'Arbeitszeiten', 'Unterschrift']) {
    expect(text, `Feld "${feld}"`).toContain(feld)
  }
})

test('die Vorlage sagt, dass sie keine Rechtsberatung ist', async ({ page }) => {
  // Wichtig: Wir sind keine Anwälte, und das muss auf dem Papier stehen –
  // nicht nur auf der Webseite daneben.
  const text = await page.locator('.druck-vorlage').innerText()
  expect(text.toLowerCase()).toContain('keine rechtsberatung')
})

test('beim Drucken bleibt nur die Vorlage übrig', async ({ page }) => {
  // Sonst druckt man drei Seiten Erklärtext mit, den niemand auf Papier
  // braucht.
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(200)
  const sichtbar = await page.evaluate(() => ({
    nav: !!document.querySelector('nav')?.offsetParent,
    footer: !!document.querySelector('footer')?.offsetParent,
    vorlage: !!document.querySelector('.druck-vorlage')?.offsetParent,
    abschnitte: [...document.querySelectorAll('.legal-page section')].filter(s => s.offsetParent).length,
  }))
  expect(sichtbar.vorlage, 'Vorlage wird gedruckt').toBe(true)
  expect(sichtbar.nav, 'Navigation wird nicht gedruckt').toBe(false)
  expect(sichtbar.footer, 'Footer wird nicht gedruckt').toBe(false)
  expect(sichtbar.abschnitte, 'Erklärtext wird nicht gedruckt').toBe(0)
})

test('die zwei Arten von Einwilligung werden auseinandergehalten', async ({ page }) => {
  // Häufige Verwechslung: Die Zustimmung zum Konto (DSGVO) ist etwas
  // anderes als die Einverständniserklärung für den Job.
  const text = await page.locator('main').innerText()
  expect(text).toContain('Für das Konto bei uns')
  expect(text).toContain('Für den Job selbst')
})

test('die Altersgrenzen stimmen mit der Jugendarbeitsschutz-Seite überein', async ({ page }) => {
  // Zwei Seiten, die dasselbe Gesetz erklären, dürfen sich nicht
  // widersprechen.
  const eltern = await page.locator('main').innerText()
  expect(eltern).toContain('13')
  expect(eltern).toContain('2 Stunden')
  expect(eltern).toContain('4 Wochen')
  expect(eltern).toContain('22 Uhr')
})

test('die Sicherheitsmerkmale werden konkret benannt', async ({ page }) => {
  // Eltern entscheiden mit. Allgemeine Beteuerungen helfen ihnen nicht –
  // sie wollen wissen, was tatsächlich passiert.
  const text = await page.locator('main').innerText()
  for (const punkt of ['geprüft', 'verifiz', 'Chat', 'melden']) {
    expect(text.toLowerCase(), `Sicherheitspunkt "${punkt}"`).toContain(punkt.toLowerCase())
  }
})

test('die Seite ist von den öffentlichen Seiten aus erreichbar', async ({ page }) => {
  for (const pfad of ['/index.html', '/jobs.html', '/jugendarbeitsschutz.html']) {
    await page.goto(pfad)
    await page.waitForTimeout(500)
    await expect(page.locator('a[href="eltern.html"]').first(),
      `Link auf ${pfad}`).toHaveCount(1)
  }
})
