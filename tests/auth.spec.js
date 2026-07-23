// Login + Registrierung (js/auth.js) — die Supabase-Auth-Endpunkte sind
// vollständig gemockt: es entstehen KEINE echten Accounts und KEINE E-Mails.
const { test, expect, standardAntworten } = require('./helpers/basis')

test.describe('Login', () => {
  test('falsche Zugangsdaten zeigen eine freundliche Fehlermeldung', async ({ page }) => {
    await page.goto('/login.html')
    await page.locator('#email').fill('gibtsnicht@example.com')
    await page.locator('#password').fill('falschespasswort')
    await page.getByRole('button', { name: 'Einloggen' }).click()
    await expect(page.locator('.auth-msg--error')).toHaveText('Falsche E-Mail oder Passwort.')
    // Button ist wieder benutzbar
    await expect(page.getByRole('button', { name: 'Einloggen' })).toBeEnabled()
  })

  test.describe('mit unbestätigter E-Mail', () => {
    const antworten = standardAntworten()
    antworten.token = { status: 400, body: { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed', message: 'Email not confirmed' } }
    test.use({ antworten })

    test('wird klar vom falschen Passwort unterschieden', async ({ page }) => {
      await page.goto('/login.html')
      await page.locator('#email').fill('neu@example.com')
      await page.locator('#password').fill('richtigespasswort')
      await page.getByRole('button', { name: 'Einloggen' }).click()
      await expect(page.locator('.auth-msg--error')).toContainText('bestätige zuerst deine E-Mail-Adresse')
    })
  })

  test('Passwort anzeigen/verbergen-Toggle funktioniert', async ({ page }) => {
    await page.goto('/login.html')
    const pw = page.locator('#password')
    await pw.fill('geheim123')
    await expect(pw).toHaveAttribute('type', 'password')
    await page.locator('.pw-toggle').click()
    await expect(pw).toHaveAttribute('type', 'text')
    await page.locator('.pw-toggle').click()
    await expect(pw).toHaveAttribute('type', 'password')
  })
})

test.describe('Registrierung – Validierung (kein Request nötig)', () => {
  test('leeres Formular zeigt Inline-Fehler an allen Pflichtfeldern', async ({ page }) => {
    await page.goto('/register.html')
    await page.getByRole('button', { name: 'Account erstellen' }).click()
    await expect(page.locator('.field-error')).toHaveCount(5) // E-Mail, Passwort, Name, Alter, Einwilligung
    await expect(page.locator('#reg-email')).toHaveClass(/invalid/)
  })

  test('unter 16: Eltern-Einwilligung ist Pflicht, ab 16 nicht', async ({ page }) => {
    await page.goto('/register.html')
    await page.locator('#name').fill('Lena')
    await page.locator('#alter').selectOption('14')
    await page.locator('#reg-email').fill('lena@example.com')
    await page.locator('#reg-password').fill('superlanges-pw')
    await page.getByRole('button', { name: 'Account erstellen' }).click()
    await expect(page.locator('.field-error')).toHaveText(['Bitte bestätige die Einwilligung deiner Eltern.'])

    // Ab 16 verschwindet die Checkbox komplett
    await page.locator('#alter').selectOption('17')
    await expect(page.locator('#consent-group')).toBeHidden()
  })

  test('Passwort-Stärke-Meter reagiert live', async ({ page }) => {
    await page.goto('/register.html')
    const label = page.locator('.pw-meter-label')
    await page.locator('#reg-password').fill('kurz')
    await expect(label).toHaveText('Zu kurz (min. 8 Zeichen)')
    await page.locator('#reg-password').fill('LangesPasswort123!')
    await expect(label).toHaveText('Stark')
  })

  test('Rollen-Tabs wechseln die Formularfelder', async ({ page }) => {
    await page.goto('/register.html')
    await expect(page.locator('#schueler-fields')).toBeVisible()
    await page.locator('#tab-firma').click()
    await expect(page.locator('#schueler-fields')).toBeHidden()
    await expect(page.locator('#firma-name')).toBeVisible()
    // Deep-Link ?rolle=firma landet direkt im Firmen-Formular
    await page.goto('/register.html?rolle=firma')
    await expect(page.locator('#firma-fields')).toBeVisible()
  })
})

test.describe('Registrierung – SignUp (gemockt)', () => {
  test('erfolgreiches Schüler-SignUp zeigt die „Fast geschafft"-Ansicht', async ({ page }) => {
    await page.goto('/register.html')
    await page.locator('#name').fill('Jonas')
    await page.locator('#alter').selectOption('16')
    await page.locator('#ort').fill('München')
    await page.locator('#reg-email').fill('jonas@example.com')
    await page.locator('#reg-password').fill('sicheres-passwort-1')
    await page.getByRole('button', { name: 'Account erstellen' }).click()

    const box = page.locator('.auth-bestaetigen')
    await expect(box).toBeVisible()
    await expect(box).toContainText('Fast geschafft!')
    await expect(box).toContainText('jonas@example.com')
    await expect(box.locator('a[href="login.html"]')).toBeVisible()
  })
})
