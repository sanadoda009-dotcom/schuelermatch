// Formular-Fehlermeldungen: versteht man, was schiefging?
//
// Anlass (Messung am 24.8.): Das Registrierungsformular verlangte 8 Zeichen,
// Supabase aber 10. Wer 8 oder 9 eintippte, kam durch die Formularprüfung,
// wurde vom Server abgelehnt und bekam nur "Bitte prüfe deine Eingaben" –
// ohne je den Grund zu erfahren. Eine Sackgasse im wichtigsten Trichter.
// Beim Passwort-Zurücksetzen wurde stattdessen der rohe englische
// Supabase-Text angezeigt.
const { test, expect, setupDashboard } = require('./helpers/supabase-fake')

test.describe('Passwort-Mindestlänge stimmt mit dem Server überein', () => {
  // Supabase ist auf 10 eingestellt. Weicht das Formular davon ab, entsteht
  // genau die Sackgasse von oben – deshalb hier festgenagelt.
  for (const [seite, feld] of [['/register.html', '#reg-password'], ['/reset-password.html', '#password']]) {
    test(seite, async ({ page }) => {
      await setupDashboard(page.context(), {})
      await page.goto(seite)
      const eingabe = page.locator(feld)
      expect(await eingabe.getAttribute('minlength')).toBe('10')
      expect(await eingabe.getAttribute('placeholder')).toContain('10')
    })
  }

  test('Registrierung nennt den Grund am Feld', async ({ page }) => {
    await setupDashboard(page.context(), {})
    await page.goto('/register.html')
    await page.fill('#name', 'Test')
    await page.fill('#reg-email', 'test@example.de')
    await page.fill('#reg-password', 'kurz1234')   // 8 Zeichen – zu wenig
    await page.selectOption('#alter', { index: 1 }).catch(() => {})
    await page.click('button[type=submit]')
    // Die Meldung muss AM FELD stehen (nicht irgendwo) und die Zahl nennen.
    await expect(page.locator('#reg-password')).toHaveClass(/invalid/)
    const amFeld = page.locator('#reg-password').locator('xpath=ancestor::div[contains(@class,"form-group")]').locator('.field-error')
    await expect(amFeld).toContainText('10')
  })
})

test('Passwort zurücksetzen zeigt keinen englischen Rohtext', async ({ page }) => {
  // Das Feld hat minlength=10, der Browser blockt also schon vorher – gut so.
  // Hier geht es um den Fall danach: Der Server lehnt trotzdem ab und
  // antwortet englisch. Dieser Text darf nie ungefiltert beim Nutzer landen.
  await setupDashboard(page.context(), {})
  await page.route('**/auth/v1/user*', r => r.fulfill({ status: 422,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Password should be at least 10 characters.' }) }))
  await page.goto('/reset-password.html')
  await page.fill('#password', 'langgenug123')
  await page.click('button[type=submit]')
  const meldung = page.locator('.auth-msg--error')
  await expect(meldung).toBeVisible({ timeout: 15_000 })
  const text = (await meldung.textContent()).toLowerCase()
  expect(text).not.toMatch(/password should|at least 10 characters/)
  expect(text).toMatch(/zu kurz|zu einfach|nicht geklappt/)
})
