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
  //
  // Der Knopf hiess bis zum 26.8. „Jobs in meiner Nähe" und führte auf
  // die ungefilterte Börse. Jetzt „Jobs für mein Alter", mit dem Alter
  // in der Adresse — die Beschriftung soll sagen, was passiert.
  await durchklicken(page, ['15', 'Lieber drinnen', 'Sehr gern', 'Ferien', 'verdienen'])
  await expect(page.getByRole('link', { name: /Jobs für mein Alter/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Profil anlegen/i })).toBeVisible()
})

test('ohne JavaScript gibt es einen Hinweis auf die Jobideen', async ({ page }) => {
  // Der Test läuft komplett im Browser – ohne JS bliebe sonst eine
  // leere Seite stehen.
  const html = await page.content()
  expect(html).toContain('noscript')
  expect(html).toContain('jobideen.html')
})

// -----------------------------------------------------------------------
// Vom Ergebnis in die Jobbörse (26.8. ergänzt).
//
// Vorher endete der Test mit vier Vorschlägen und einem Knopf auf die
// UNGEFILTERTE Börse — die fünf Antworten waren damit umsonst. Wer als
// 13-Jähriger durchklickte, landete anschließend zwischen Anzeigen ab 16.
// -----------------------------------------------------------------------
test('der Hauptknopf nimmt das Alter mit in die Jobbörse', async ({ page }) => {
  await durchklicken(page, ['13 oder 14', 'Lieber draußen', 'lieber für mich', 'nach der Schule', 'Flexibel'])

  const ziel = await page.locator('.finder-weiter a.btn-green').getAttribute('href')
  expect(ziel, 'ohne Alter landet ein 13-Jähriger zwischen Anzeigen ab 16')
    .toContain('alter=13')
})

test('jede Ergebniskarte führt zu genau solchen Jobs', async ({ page }) => {
  await durchklicken(page, ['16 oder älter', 'Ist mir egal', 'Kommt drauf an', 'Wochenende', 'verdienen'])

  const links = page.locator('.finder-ergebnis .idee-suche')
  expect(await links.count(), 'jede der vier Karten braucht einen Weg weiter').toBe(4)

  for (const l of await links.all()) {
    const ziel = await l.getAttribute('href')
    expect(ziel).toContain('alter=16')
    expect(ziel, 'ohne Kategorie ist der Link nicht besser als der Hauptknopf')
      .toMatch(/kategorie=/)
  }
})

test('die Kategorien im Finder gibt es auch wirklich in der Jobbörse', async ({ page }) => {
  // Schreibt sich eine Kategorie im Finder anders als in jobs.html,
  // greift der Filter nicht und die Liste bleibt leer — ohne dass
  // irgendetwas kaputt aussieht.
  const ausJobs = await page.evaluate(async () => {
    const html = await (await fetch('/jobs.html')).text()
    return [...html.matchAll(/data-kat="([^"]+)"/g)]
      .map(m => m[1].replace(/&amp;/g, '&'))
      .filter(Boolean)
  })

  const ausFinder = await page.evaluate(async () => {
    const quelle = await (await fetch('/js/job-finder.js')).text()
    return [...new Set([...quelle.matchAll(/kategorie:\s*'([^']+)'/g)].map(m => m[1]))]
  })

  expect(ausFinder.length, 'keine Kategorien im Finder gefunden').toBeGreaterThan(0)
  const unbekannt = ausFinder.filter(k => !ausJobs.includes(k))
  expect(unbekannt, 'diese Kategorien kennt die Jobbörse nicht: ' + unbekannt.join(', '))
    .toEqual([])
})

test('der Link zur Jobbörse filtert dort wirklich', async ({ page }) => {
  // Nicht nur die Adresse prüfen, sondern dass sie ankommt.
  await durchklicken(page, ['13 oder 14', 'Lieber drinnen', 'Sehr gern', 'nach der Schule', 'lernen'])

  await page.locator('.finder-weiter a.btn-green').click()
  await expect(page).toHaveURL(/jobs\.html\?.*alter=13/)
  await expect(page.locator('#filter-alter')).toHaveValue('13')
})
