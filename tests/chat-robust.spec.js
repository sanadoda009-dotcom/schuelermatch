// Chat: Was passiert, wenn beim Senden oder Laden etwas schiefgeht?
//
// Anlass (Durchsicht am 24.8.): Der Chat war der letzte Bereich, den keine
// Runde angefasst hatte. Gefunden - zwei belegte Fehler, eine widerlegte
// Vermutung und eine Verbesserung:
//   1. Das Eingabefeld wurde SOFORT geleert, noch bevor gesendet war.
//      Schlug das Senden fehl, war der getippte Text weg.
//   2. (Vermutung, die sich NICHT bestätigte: ein fehlendes Abfangen von
//      Netzfehlern beim Senden. Gegengeprüft gegen den alten Code – das
//      Eingabefeld blieb auch dort bedienbar, weil supabase-js solche
//      Fehler als Wert zurückgibt statt zu werfen. Das Abfangen bleibt
//      als Vorsichtsmaßnahme drin, der Test als Absicherung.)
//   3. Ein Ladefehler wurde als "Noch keine Nachrichten – schreib die
//      erste!" angezeigt. Es sah aus, als sei der Verlauf gelöscht.
//   4. Der 8-Sekunden-Takt riss einen beim Zurückscrollen immer wieder
//      nach unten.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, warteAufDashboard } = require('./helpers/supabase-fake')

const HOST = 'blufrvuskqiloslyxjkx.supabase.co'

function chatDb(anzahl = 2) {
  const db = defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] })
  db.bewerbungen = [{
    id: 'bw-chat', job_id: db.jobs[0].id, schueler_id: SCHUELER.id,
    status: 'angenommen', erstellt_am: '2026-08-01T10:00:00Z',
  }]
  db.nachrichten = Array.from({ length: anzahl }, (_, i) => ({
    id: 'n-' + i,
    bewerbung_id: 'bw-chat',
    absender_id: FIRMA.id,
    text: 'Nachricht Nummer ' + (i + 1),
    gelesen: true,
    erstellt_am: `2026-08-01T10:0${i}:00Z`,
  }))
  return db
}

async function oeffneChat(page) {
  await warteAufDashboard(page)
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="nachrichten"]').click()
  await page.locator('.konv-item').first().click()
  await expect(page.locator('.chat-thread')).toBeVisible({ timeout: 30_000 })
}

test('getippter Text geht beim Fehlschlag nicht verloren', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: chatDb() })
  await page.goto('/dashboard-schueler.html')
  await oeffneChat(page)

  // Ab jetzt scheitert jedes Senden.
  await page.route(`https://${HOST}/rest/v1/nachrichten*`, async (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 500, contentType: 'application/json',
        body: JSON.stringify({ message: 'kaputt' }) })
    }
    return route.fallback()
  })

  const eingabe = page.locator('.chat-input')
  await eingabe.fill('Diesen Satz habe ich muehsam getippt')
  await page.locator('.chat-form button[type=submit]').click()
  await page.waitForTimeout(800)

  // Der Text muss noch da sein – sonst müsste man alles neu schreiben.
  await expect(eingabe).toHaveValue('Diesen Satz habe ich muehsam getippt')
})

// Absicherung ohne Fehlerbeleg: Dieser Test war auch gegen den alten Code
// gruen. Er haelt fest, dass das Feld bedienbar bleiben MUSS.
test('Eingabefeld bleibt nach einem Netzfehler bedienbar', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: chatDb() })
  await page.goto('/dashboard-schueler.html')
  await oeffneChat(page)

  // Netz komplett tot.
  await page.route(`https://${HOST}/rest/v1/nachrichten*`, async (route) => {
    if (route.request().method() === 'POST') return route.abort('failed')
    return route.fallback()
  })

  await page.locator('.chat-input').fill('Test')
  await page.locator('.chat-form button[type=submit]').click()
  await page.waitForTimeout(1500)

  await expect(page.locator('.chat-input')).toBeEnabled()
})

test('Ladefehler sieht nicht aus wie ein leerer Chat', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: chatDb(0) })
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)

  // Erst ab jetzt scheitert das Laden der Nachrichten.
  await page.route(`https://${HOST}/rest/v1/nachrichten*`, async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 500, contentType: 'application/json',
        body: JSON.stringify({ message: 'kaputt' }) })
    }
    return route.fallback()
  })

  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="nachrichten"]').click()
  const konv = page.locator('.konv-item').first()
  if (await konv.count()) {
    await konv.click()
    await expect(page.locator('.chat-thread')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(1200)
    const text = await page.locator('.chat-thread').innerText()
    // Darf NICHT behaupten, es gäbe noch keine Nachrichten.
    expect(text).not.toContain('schreib die erste')
  }
})

test('erfolgreiches Senden leert das Feld', async ({ page }) => {
  // Gegenprobe zum ersten Test: Im Normalfall soll das Feld leer werden.
  await setupDashboard(page.context(), { user: SCHUELER, db: chatDb() })
  await page.goto('/dashboard-schueler.html')
  await oeffneChat(page)

  await page.locator('.chat-input').fill('Hallo, wann kann ich anfangen?')
  await page.locator('.chat-form button[type=submit]').click()
  await expect(page.locator('.chat-input')).toHaveValue('', { timeout: 10_000 })
  await expect(page.locator('.chat-thread')).toContainText('Hallo, wann kann ich anfangen?')
})
