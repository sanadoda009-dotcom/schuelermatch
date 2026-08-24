// Bestätigungs-E-Mail: Was tun, wenn sie nicht ankommt?
//
// Anlass (Durchsicht am 25.8.): Nach der Registrierung stand "Wir haben
// dir eine E-Mail geschickt … schau im Spam-Ordner nach" – und das war
// alles. Kam die Mail nicht an (Zustellproblem, Tippfehler in der
// Adresse), gab es **keinen Weg weiter**: kein erneutes Senden, keine
// Korrektur. Der Account war damit unbrauchbar, ohne dass jemand etwas
// tun konnte. Dieselbe Sackgasse beim Login, wenn die Mail noch nicht
// bestätigt war.
const { test, expect } = require('./helpers/basis')

const HOST = 'blufrvuskqiloslyxjkx.supabase.co'

// Registrierung, die eine Bestätigungsmail auslöst (also KEINE Session
// zurückgibt) – so verhält sich Supabase mit aktivierter Bestätigung.
function registrierungOhneSession() {
  return {
    signup: { status: 200, body: { user: { id: 'neu-1', email: 'kind@example.de' }, session: null } },
  }
}

test.describe('nach der Registrierung', () => {
  test.use({ antworten: { ...require('./helpers/basis').standardAntworten(), ...registrierungOhneSession() } })

  async function registriere(page) {
    await page.goto('/register.html')
    await page.fill('#name', 'Test')
    await page.fill('#reg-email', 'kind@example.de')
    await page.fill('#reg-password', 'langgenug123')
    await page.selectOption('#alter', { index: 1 }).catch(() => {})
    // Einwilligung ist unter 16 Pflicht – anhaken, falls sichtbar.
    const box = page.locator('#eltern-einwilligung')
    if (await box.isVisible().catch(() => false)) await box.check()
    await page.click('button[type=submit]')
    await expect(page.locator('.auth-bestaetigen')).toBeVisible({ timeout: 15_000 })
  }

  test('es gibt einen Weg, die Mail erneut anzufordern', async ({ page }) => {
    await registriere(page)
    // Ohne diesen Knopf steckt jemand fest, dessen Mail nicht ankommt.
    await expect(page.locator('#mail-erneut')).toBeVisible()
  })

  test('erneut senden meldet Erfolg', async ({ page }) => {
    await page.route(`https://${HOST}/auth/v1/resend*`, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    await registriere(page)
    await page.click('#mail-erneut')
    await expect(page.locator('#erneut-status')).toContainText(/unterwegs/i, { timeout: 10_000 })
  })

  test('zu häufiges Anfordern wird verständlich erklärt', async ({ page }) => {
    // Supabase begrenzt das zeitlich und antwortet englisch.
    await page.route(`https://${HOST}/auth/v1/resend*`, r =>
      r.fulfill({ status: 429, contentType: 'application/json',
        body: JSON.stringify({ message: 'For security purposes, you can only request this after 51 seconds.' }) }))
    await registriere(page)
    await page.click('#mail-erneut')

    const status = page.locator('#erneut-status')
    await expect(status).not.toBeEmpty({ timeout: 10_000 })
    const text = (await status.textContent()).toLowerCase()
    // Kein durchgereichter englischer Text.
    expect(text).not.toMatch(/security purposes|seconds/)
    expect(text).toMatch(/warte|nicht geklappt/)
  })

  test('der Knopf sperrt sich nach dem Senden kurz', async ({ page }) => {
    // Sonst tippt man ungeduldig mehrfach und läuft in die Sperre des
    // Anbieters.
    await page.route(`https://${HOST}/auth/v1/resend*`, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    await registriere(page)
    await page.click('#mail-erneut')
    await expect(page.locator('#erneut-status')).toContainText(/unterwegs/i, { timeout: 10_000 })
    await expect(page.locator('#mail-erneut')).toBeDisabled()
  })
})

test('Login mit unbestätigter Mail bietet erneutes Senden an', async ({ page }) => {
  await page.route(`https://${HOST}/auth/v1/token*`, r =>
    r.fulfill({ status: 400, contentType: 'application/json',
      body: JSON.stringify({ error_code: 'email_not_confirmed', msg: 'Email not confirmed', message: 'Email not confirmed' }) }))
  await page.goto('/login.html')
  await page.fill('#email', 'kind@example.de')
  await page.fill('#password', 'langgenug123')
  await page.click('button[type=submit]')

  await expect(page.locator('.auth-msg--error')).toBeVisible({ timeout: 15_000 })
  // Ohne den Knopf wäre der Login hier eine Sackgasse.
  await expect(page.locator('#mail-erneut')).toBeVisible()
})
