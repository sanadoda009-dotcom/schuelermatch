// Die Benachrichtigungs-Glocke (js/notifications.js).
//
// ANLASS (1.9.2026): Die Frage "welche Datei kommt in keinem Test vor"
// zeigte auf notifications.js – 119 Zeilen, null Tests. Darin steckte ein
// Fehler, den ein Nutzer sofort merkt und ich nie gesehen hätte:
//
// Für Firmen wurden nur *frische* Bewerbungen in die Liste gelegt
// (`if (frisch) items.push(...)`). Das Öffnen der Glocke markiert aber
// alles als gesehen und zeichnet danach neu. Ergebnis: Das Abzeichen sagte
// "2", man klickte, und im Menü stand "Keine neuen Benachrichtigungen 🎉".
// Gemessen: Abzeichen 2, Einträge 0.
//
// Behoben, indem der Firmenzweig es hält wie der Schülerzweig: immer
// anzeigen, `frisch` steuert nur die Zahl. Und beim Öffnen wird nicht mehr
// neu gezeichnet – das hätte die Liste unter den Augen des Lesers getauscht.

const { test, expect, setupDashboard, defaultDb, FIRMA, SCHUELER } = require('./helpers/supabase-fake')

const JOB = {
  id: 'job-glocke', titel: 'Eisverkäufer/in', beschreibung: 'Eis verkaufen.',
  ort: 'München', stundenlohn: 12, mindestalter: 15, kategorie: 'Verkauf',
  arbeitszeit: 'Wochenende', aktiv: true, aufrufe: 3,
  erstellt_am: '2026-08-01T10:00:00Z', firma_id: FIRMA.id,
}

function bewerbung(n, status = 'offen') {
  return {
    id: `b${n}`, job_id: JOB.id, schueler_id: SCHUELER.id, status,
    erstellt_am: `2026-08-${String(10 + n).padStart(2, '0')}T10:00:00Z`,
  }
}

async function oeffneDashboard(page, seite, user, bewerbungen, extra = {}) {
  await setupDashboard(page.context(), {
    user,
    db: defaultDb({ jobs: [JOB], bewerbungen, ...extra }),
  })
  await page.goto(seite)
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
}

test.describe('Glocke bei der Firma', () => {
  test('was das Abzeichen zählt, steht auch im Menü', async ({ page }) => {
    // Der eigentliche Fehler. Vorher: Abzeichen 2, Menü leer.
    await oeffneDashboard(page, '/dashboard-firma.html', FIRMA, [bewerbung(1), bewerbung(2)])

    await expect(page.locator('#glocke-badge')).toHaveText('2')
    await page.locator('#glocke-btn').click()
    // Warten, bis sich nichts mehr tut. Ohne das lief dieser Test auch
    // gegen den alten Code grün: Das Leeren passierte asynchron, und
    // Playwright fand die zwei Einträge im Moment davor.
    await page.waitForTimeout(1200)
    await expect(page.locator('.benachr-item')).toHaveCount(2)
    await expect(page.locator('#glocke-dropdown')).not.toContainText('Keine neuen')
  })

  test('die Einträge bleiben stehen, solange das Menü offen ist', async ({ page }) => {
    // Beim Öffnen wurde alles als gesehen markiert und sofort neu
    // gezeichnet – die Liste verschwand unter den Augen des Lesers.
    await oeffneDashboard(page, '/dashboard-firma.html', FIRMA, [bewerbung(1), bewerbung(2)])
    await page.locator('#glocke-btn').click()
    await page.waitForTimeout(1500)
    await expect(page.locator('.benachr-item')).toHaveCount(2)
  })

  test('nach dem Öffnen ist das Abzeichen leer, die Liste aber nicht', async ({ page }) => {
    await oeffneDashboard(page, '/dashboard-firma.html', FIRMA, [bewerbung(1), bewerbung(2)])
    await page.locator('#glocke-btn').click()
    await expect(page.locator('#glocke-badge')).toHaveText('0')
    await expect(page.locator('#glocke-badge')).not.toHaveClass(/aktiv/)

    // Neu laden: gesehen ist gemerkt, die Bewerbungen stehen trotzdem da.
    await page.reload()
    await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
    await expect(page.locator('#glocke-badge')).toHaveText('0')
    await page.locator('#glocke-btn').click()
    await expect(page.locator('.benachr-item')).toHaveCount(2)
    await expect(page.locator('#glocke-dropdown')).toContainText('Eisverkäufer/in')
  })

  test('ohne Bewerbungen steht da, dass nichts da ist', async ({ page }) => {
    await oeffneDashboard(page, '/dashboard-firma.html', FIRMA, [])
    await page.locator('#glocke-btn').click()
    await expect(page.locator('#glocke-dropdown')).toContainText('Keine neuen Benachrichtigungen')
    await expect(page.locator('#glocke-badge')).toHaveText('0')
  })

  test('das Menü wird nicht länger als der Bildschirm', async ({ page }) => {
    // Ohne Grenze wächst die Liste mit jeder Bewerbung.
    const viele = Array.from({ length: 20 }, (_, i) => bewerbung(i + 1))
    await oeffneDashboard(page, '/dashboard-firma.html', FIRMA, viele)
    await page.locator('#glocke-btn').click()
    const anzahl = await page.locator('.benachr-item').count()
    expect(anzahl, 'Glocke zeigt zu viele Einträge auf einmal').toBeLessThanOrEqual(8)
    expect(anzahl, 'Glocke zeigt gar nichts').toBeGreaterThan(0)
  })
})

test.describe('Glocke beim Schüler', () => {
  test('eine Zusage und eine Absage stehen beide im Menü', async ({ page }) => {
    await oeffneDashboard(page, '/dashboard-schueler.html', SCHUELER,
      [bewerbung(1, 'angenommen'), bewerbung(2, 'abgelehnt'), bewerbung(3, 'offen')])

    await page.locator('#glocke-btn').click()
    const dd = page.locator('#glocke-dropdown')
    await expect(dd).toContainText('Angenommen!')
    await expect(dd).toContainText('nicht geklappt')
    // Eine noch offene Bewerbung ist keine Nachricht wert.
    await expect(page.locator('.benachr-item')).toHaveCount(2)
  })

  test('eine offene Bewerbung allein löst keine Benachrichtigung aus', async ({ page }) => {
    await oeffneDashboard(page, '/dashboard-schueler.html', SCHUELER, [bewerbung(1, 'offen')])
    await page.locator('#glocke-btn').click()
    await expect(page.locator('#glocke-dropdown')).toContainText('Keine neuen Benachrichtigungen')
  })

  test('der Jobtitel wird nicht als HTML eingesetzt', async ({ page }) => {
    // Der Titel kommt von einer Firma, also aus fremder Hand. Er landet
    // per innerHTML im Menü – escapeHtml muss ihn entschärfen.
    const boeserJob = { ...JOB, titel: '<img src=x onerror="window.__aua=1">Job' }
    await setupDashboard(page.context(), {
      user: SCHUELER,
      db: defaultDb({ jobs: [boeserJob], bewerbungen: [bewerbung(1, 'angenommen')] }),
    })
    await page.goto('/dashboard-schueler.html')
    await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
    await page.locator('#glocke-btn').click()
    await page.waitForTimeout(400)

    expect(await page.evaluate(() => window.__aua), 'Jobtitel wurde als HTML ausgeführt').toBeUndefined()
    await expect(page.locator('#glocke-dropdown')).toContainText('onerror')
  })
})
