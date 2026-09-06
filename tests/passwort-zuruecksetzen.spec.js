// Passwort zurücksetzen: der Weg zurück ins eigene Konto (4.9.2026).
//
// DER BEFUND: `reset-password.html` ist die Seite hinter dem Link aus der
// E-Mail. Der Link gilt kurze Zeit und genau einmal. Wer die Seite OHNE
// gültigen Link öffnete — abgelaufener Link, alte Mail, Lesezeichen,
// Zurück-Taste — bekam trotzdem das Formular, tippte ein neues Passwort
// ein und las danach:
//
//   „Das hat gerade nicht geklappt. Versuch es in einem Moment nochmal."
//
// Gemessen, wörtlich. Ein Versprechen, das nie eintritt: Es fehlt nicht
// die Geduld, es fehlt der Link. Wer sein Passwort vergessen hat, dreht
// sich damit im Kreis und kommt nie wieder in sein Konto — auf einer
// Seite, auf der Minderjährige ihre Bewerbungen liegen haben.
//
// Zweiter Fund im selben Zug: `forgot-password.html` stapelte die
// Meldungen. Dreimal abgeschickt hieß dreimal derselbe Satz
// untereinander, die älteste oben — also die falsche zuerst.

const { test, expect } = require('./helpers/basis')

// So sieht ein echter Link von Supabase aus. Der Anhang wird von
// js/reset-password.js gelesen, bevor supabase-js überhaupt läuft.
const ECHTER_LINK = '#access_token=eyJtest&refresh_token=r1&type=recovery'
const ABGELAUFEN = '#error=access_denied&error_code=otp_expired'
  + '&error_description=Email+link+is+invalid+or+has+expired'

test.describe('ohne gültigen Link', () => {
  test('kommt gar kein Formular mehr, sondern eine Auskunft', async ({ page }) => {
    await page.goto('/reset-password.html')
    await expect(page.locator('h1')).toHaveText('Dieser Link funktioniert nicht mehr', { timeout: 20_000 })
    await expect(page.locator('#reset-form')).toHaveCount(0)
  })

  test('und der Weg zum neuen Link steht daneben', async ({ page }) => {
    // Ohne diesen Knopf ist die Auskunft auch nur eine Sackgasse.
    await page.goto('/reset-password.html')
    const knopf = page.locator('a[href="forgot-password.html"]')
    await expect(knopf).toBeVisible({ timeout: 20_000 })
    await expect(knopf).toContainText('Neuen Link')
    await expect(page.locator('a[href="login.html"]')).toBeVisible()
  })

  test('niemand wird mehr zum Abwarten aufgefordert', async ({ page }) => {
    // Der eigentliche Fehler war der Rat, es „in einem Moment" nochmal zu
    // versuchen — und der kam erst NACH dem Absenden. Ein Test, der nur
    // die frisch geladene Seite ansieht, bestand deshalb auch gegen den
    // alten Code und prüfte gar nichts. Also den ganzen Weg gehen: Wenn
    // es noch ein Formular gibt, wird es abgeschickt.
    await page.goto('/reset-password.html')
    await expect(page.locator('.auth-box')).toBeVisible({ timeout: 20_000 })

    const formular = page.locator('#reset-form')
    if (await formular.count()) {
      await page.locator('#password').fill('einLangesPasswort1')
      await formular.locator('button[type=submit]').click()
      await expect(page.locator('.auth-msg--error, h1')).toBeVisible({ timeout: 20_000 })
    }

    await expect(page.locator('.auth-box')).not.toContainText('Moment nochmal')
  })
})

test.describe('bei einem abgelaufenen Link', () => {
  test('steht der Grund da, nicht nur „hat nicht geklappt"', async ({ page }) => {
    // Supabase hängt den Grund an die Adresse. Gelesen hat den bisher
    // niemand — die Seite zeigte stur das Formular.
    await page.goto(`/reset-password.html${ABGELAUFEN}`)
    await expect(page.locator('h1')).toHaveText('Dieser Link funktioniert nicht mehr', { timeout: 20_000 })
    await expect(page.locator('.sub')).toContainText('abgelaufen')
  })

  test('auch dann führt der Weg weiter', async ({ page }) => {
    await page.goto(`/reset-password.html${ABGELAUFEN}`)
    await expect(page.locator('a[href="forgot-password.html"]')).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('mit gültigem Link', () => {
  test('steht das Formular da wie bisher', async ({ page }) => {
    await page.goto(`/reset-password.html${ECHTER_LINK}`)
    await expect(page.locator('#reset-form')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('#password')).toHaveAttribute('minlength', '10')
  })

  test('ein zu kurzes Passwort geht gar nicht erst raus', async ({ page }) => {
    // Zwei Sperren hintereinander: `minlength=10` haelt den Klick schon im
    // Browser auf, und js/reset-password.js prueft es noch einmal, falls
    // das Formular anders abgeschickt wird. Sonst kaeme die englische
    // Meldung von Supabase zurueck.
    await page.goto(`/reset-password.html${ECHTER_LINK}`)
    await page.locator('#password').fill('kurz')
    await page.locator('#reset-form button[type=submit]').click()

    // Der Browser laesst es nicht durch – das Formular steht noch da.
    await expect(page.locator('#reset-form')).toBeVisible()
    expect(await page.locator('#password').evaluate(e => e.validity.valid)).toBe(false)

    // Und die zweite Sperre greift auch, wenn der Browser nicht prueft.
    await page.locator('#reset-form').evaluate(f => f.dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true })))
    await expect(page.locator('.auth-msg--error')).toContainText('10 Zeichen', { timeout: 20_000 })
  })

  test('eine fehlende Sitzung heißt „neuer Link", nicht „gleich nochmal"', async ({ page }) => {
    // Der Link steht in der Adresse, taugt aber nichts mehr: supabase-js
    // meldet dann „Auth session missing!". Das lief vorher in den Zweig
    // „Versuch es in einem Moment nochmal".
    await page.route('**/auth/v1/user*', r => r.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ message: 'Auth session missing!' }),
    }))
    await page.goto(`/reset-password.html${ECHTER_LINK}`)
    await page.locator('#password').fill('einLangesPasswort1')
    await page.locator('#reset-form button[type=submit]').click()
    await expect(page.locator('h1')).toHaveText('Dieser Link funktioniert nicht mehr', { timeout: 20_000 })
  })
})

test.describe('Passwort vergessen', () => {
  test('Meldungen stapeln sich nicht mehr', async ({ page }) => {
    await page.goto('/forgot-password.html')
    for (let i = 0; i < 3; i++) {
      await page.locator('#email').fill('test@example.com')
      await page.locator('button[type=submit]').click()
      await expect(page.locator('.auth-msg')).toHaveCount(1, { timeout: 20_000 })
    }
    await expect(page.locator('.auth-msg')).toHaveCount(1)
  })

  test('die Antwort verrät nicht, wer ein Konto hat', async ({ page }) => {
    // Steht seit dem 26.8. so da und bleibt: „Falls diese E-Mail
    // registriert ist". Wäre die Antwort eindeutig, ließe sich damit
    // ablesen, welche Schüler hier angemeldet sind.
    await page.goto('/forgot-password.html')
    await page.locator('#email').fill('gibtesnicht@example.com')
    await page.locator('button[type=submit]').click()
    await expect(page.locator('.auth-msg')).toBeVisible({ timeout: 20_000 })
    const text = await page.locator('.auth-msg').textContent()
    expect(text.toLowerCase()).not.toMatch(/nicht registriert|unbekannt|kein konto/)
  })
})
