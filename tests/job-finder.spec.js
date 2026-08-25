// Job-Finder: der Orientierungstest auf job-finder.html.
//
// Warum es ihn gibt (25.8.): Beim Vergleich mit ausbildung.de fiel deren
// "Berufscheck" auf – ein kurzer Test für alle, die noch nicht wissen,
// was sie wollen. Die Plattform heißt SchülerMatch, gematcht wurde aber
// bisher nur nach Alter und Ort.
//
// Diese Tests halten die Regeln fest, die wirklich zählen: Das Alter ist
// eine harte Grenze (nie einen Job vorschlagen, den man nicht machen
// darf), und es kommt immer ein Ergebnis heraus – auch bei ungewöhnlichen
// Antwortkombinationen.
const { test, expect, setupDashboard } = require('./helpers/supabase-fake')

// Beantwortet den Test, indem jeweils die Antwort mit dem passenden Text
// angetippt wird.
async function durchklicken(page, antworten) {
  for (const text of antworten) {
    const knopf = page.locator('.finder-antwort').filter({ hasText: text }).first()
    await expect(knopf).toBeVisible({ timeout: 10_000 })
    await knopf.click()
    await page.waitForTimeout(150)
  }
  await expect(page.locator('.finder-ergebnis')).toBeVisible({ timeout: 10_000 })
}

async function vorschlaege(page) {
  return page.locator('.finder-ergebnis .idee h3').allTextContents()
}

// Liest das Mindestalter aus den Ergebnis-Karten ("ab 15").
async function mindestalter(page) {
  const texte = await page.locator('.finder-ergebnis .idee-alter').allTextContents()
  return texte.map(t => parseInt(t.replace(/\D/g, ''), 10))
}

test.beforeEach(async ({ page }) => {
  await setupDashboard(page.context(), {})
  await page.goto('/job-finder.html')
  await expect(page.locator('.finder-antwort').first()).toBeVisible({ timeout: 15_000 })
})

test('mit 13 wird nichts vorgeschlagen, was erst ab 15 erlaubt ist', async ({ page }) => {
  // Das ist die wichtigste Regel: Ein Vorschlag, den man gar nicht machen
  // darf, ist schlimmer als kein Vorschlag.
  await durchklicken(page, ['13 oder 14', 'Ist mir egal', 'Kommt drauf an', 'Wochenende', 'verdienen'])
  const alter = await mindestalter(page)
  expect(alter.length).toBeGreaterThan(0)
  expect(Math.max(...alter), 'kein Vorschlag über dem eigenen Alter').toBeLessThanOrEqual(13)
})

test('mit 16 stehen auch die Jobs ab 16 zur Auswahl', async ({ page }) => {
  await durchklicken(page, ['16 oder älter', 'Lieber drinnen', 'Sehr gern', 'Wochenende', 'verdienen'])
  const alter = await mindestalter(page)
  expect(Math.max(...alter), 'Jobs ab 16 werden erreicht').toBeGreaterThanOrEqual(15)
})

test('es kommt immer mindestens ein Vorschlag heraus', async ({ page }) => {
  // Punkte statt harter Filter – sonst bleibt bei ungewöhnlichen
  // Kombinationen nichts übrig, und ein leeres Ergebnis hilft niemandem.
  await durchklicken(page, ['13 oder 14', 'Lieber draußen', 'Sehr gern', 'Ferien', 'lernen'])
  expect((await vorschlaege(page)).length).toBeGreaterThan(0)
})

test('die Vorschläge passen zur Antwort', async ({ page }) => {
  // Draußen + wenig Kontakt darf nicht zu "Service im Café" führen.
  await durchklicken(page, ['15', 'Lieber draußen', 'lieber für mich', 'Ferien', 'verdienen'])
  const namen = await vorschlaege(page)
  expect(namen.join(' ')).not.toContain('Service im Café')
  expect(namen.length).toBeGreaterThanOrEqual(3)
})

test('der beste Treffer ist als solcher gekennzeichnet', async ({ page }) => {
  await durchklicken(page, ['15', 'Lieber drinnen', 'Sehr gern', 'Wochenende', 'verdienen'])
  await expect(page.locator('.idee-top-marke')).toHaveCount(1)
  await expect(page.locator('.finder-ergebnis .idee--top')).toHaveCount(1)
})

test('das Ergebnis nennt die Altersregel', async ({ page }) => {
  // Ohne den Hinweis wirkt die Auswahl willkürlich.
  await durchklicken(page, ['15', 'Ist mir egal', 'Kommt drauf an', 'Ferien', 'verdienen'])
  const text = await page.locator('.finder-box').innerText()
  expect(text).toContain('4 Wochen')
})

test('man kommt eine Frage zurück', async ({ page }) => {
  await page.locator('.finder-antwort').first().click()
  await expect(page.locator('#finder-zurueck')).toBeVisible()
  await page.locator('#finder-zurueck').click()
  await expect(page.locator('#finder-schritt')).toHaveText('Frage 1 von 5')
})

test('nach dem Ergebnis kann man neu starten', async ({ page }) => {
  await durchklicken(page, ['15', 'Lieber drinnen', 'Sehr gern', 'Ferien', 'verdienen'])
  await page.locator('#finder-neu').click()
  await expect(page.locator('#finder-schritt')).toHaveText('Frage 1 von 5')
  await expect(page.locator('.finder-antwort').first()).toBeVisible()
})

test('das Ergebnis führt weiter zu Jobs und Registrierung', async ({ page }) => {
  // Ein Ergebnis ohne nächsten Schritt wäre eine Sackgasse.
  await durchklicken(page, ['15', 'Lieber drinnen', 'Sehr gern', 'Ferien', 'verdienen'])
  await expect(page.getByRole('link', { name: /Jobs in meiner Nähe/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Profil anlegen/i })).toBeVisible()
})

test('ohne JavaScript gibt es einen Hinweis auf die Jobideen', async ({ page }) => {
  // Der Test läuft komplett im Browser – ohne JS bliebe sonst eine
  // leere Seite stehen.
  const html = await page.content()
  expect(html).toContain('noscript')
  expect(html).toContain('jobideen.html')
})
