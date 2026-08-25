// Wer inseriert hier eigentlich? Firmenname und Alter der Anzeige.
//
// Anlass (25.8.): Die Datenbank hat seit jeher eine Spalte `firma_name`
// in der Jobs-Tabelle – aber in der Produktionsdatenbank war sie bei
// KEINEM der Jobs gefüllt. Grund: Beim Posten wurde sie nie geschrieben.
//
// Folgen: Schüler sahen nie, bei wem sie sich bewerben (für Minderjährige
// eine Vertrauensfrage – und die Elternseite verspricht ausdrücklich
// geprüfte Unternehmen). Und die strukturierten Daten für Google Jobs
// meldeten "Arbeitgeber auf SchülerMatch" statt des echten Namens.
//
// Dazu fehlte das Alter der Anzeige. Eine Stelle von vor einem halben
// Jahr ist meist längst vergeben – das sollte man sehen, bevor man Zeit
// in eine Bewerbung steckt.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, warteAufDashboard } = require('./helpers/supabase-fake')

function dbMitFirma(zusatz = {}) {
  const db = defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] })
  Object.assign(db.jobs[0], { firma_name: 'Café Sonnenschein GmbH' }, zusatz)
  return db
}

test('die Jobbörse nennt den Arbeitgeber', async ({ page }) => {
  await setupDashboard(page.context(), { db: dbMitFirma() })
  await page.goto('/jobs.html')
  await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.job-firma').first()).toContainText('Café Sonnenschein')
})

test('die Job-Detailseite nennt den Arbeitgeber', async ({ page }) => {
  const db = dbMitFirma()
  await setupDashboard(page.context(), { db })
  await page.goto('/job.html?id=' + db.jobs[0].id)
  await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.job-firma')).toContainText('Café Sonnenschein')
})

test('ohne Firmenname bricht nichts', async ({ page }) => {
  // Die vier bestehenden Jobs in der Produktionsdatenbank haben keinen
  // Namen (sie stammen aus der Zeit davor). Die Seite muss trotzdem
  // sauber aussehen – nur ohne die Zeile.
  const db = defaultDb({ profiles: [profilZeile(SCHUELER), profilZeile(FIRMA)] })
  await setupDashboard(page.context(), { db })
  await page.goto('/job.html?id=' + db.jobs[0].id)
  await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.job-firma')).toHaveCount(0)
  // Kein "bei undefined" oder leeres "bei".
  const text = await page.locator('main').innerText()
  expect(text).not.toMatch(/bei\s*(undefined|null)?\s*$/m)
})

test.describe('Alter der Anzeige', () => {
  async function datumstext(page, tageAlt) {
    const db = dbMitFirma({
      erstellt_am: new Date(Date.now() - tageAlt * 86400000).toISOString(),
    })
    await setupDashboard(page.context(), { db })
    await page.goto('/job.html?id=' + db.jobs[0].id)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    return (await page.locator('.job-datum').innerText()).toLowerCase()
  }

  test('frisch eingestellt', async ({ page }) => {
    expect(await datumstext(page, 0)).toContain('heute')
  })

  test('ein paar Tage alt', async ({ page }) => {
    expect(await datumstext(page, 3)).toContain('3 tagen')
  })

  test('mehrere Wochen alt', async ({ page }) => {
    expect(await datumstext(page, 21)).toContain('wochen')
  })

  test('alte Anzeigen werden hervorgehoben', async ({ page }) => {
    // Ab zwei Monaten: Dann lohnt eine Nachfrage, ob die Stelle noch
    // frei ist – statt eine Bewerbung ins Leere zu schreiben.
    const db = dbMitFirma({
      erstellt_am: new Date(Date.now() - 100 * 86400000).toISOString(),
    })
    await setupDashboard(page.context(), { db })
    await page.goto('/job.html?id=' + db.jobs[0].id)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.job-datum')).toHaveClass(/job-alt/)
    expect((await page.locator('.job-datum').innerText()).toLowerCase()).toContain('monaten')
  })

  test('junge Anzeigen werden nicht hervorgehoben', async ({ page }) => {
    const db = dbMitFirma({
      erstellt_am: new Date(Date.now() - 5 * 86400000).toISOString(),
    })
    await setupDashboard(page.context(), { db })
    await page.goto('/job.html?id=' + db.jobs[0].id)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.job-datum')).not.toHaveClass(/job-alt/)
  })
})

test('Google bekommt den echten Firmennamen', async ({ page }) => {
  // Die strukturierten Daten entscheiden darüber, was in der Google-
  // Jobsuche steht. "Arbeitgeber auf SchülerMatch" hilft niemandem.
  const db = dbMitFirma()
  await setupDashboard(page.context(), { db })
  await page.goto('/job.html?id=' + db.jobs[0].id)
  await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })

  const daten = await page.evaluate(() => {
    const el = document.querySelector('script[type="application/ld+json"]')
    return el ? JSON.parse(el.textContent) : null
  })
  expect(daten?.hiringOrganization?.name).toBe('Café Sonnenschein GmbH')
})
