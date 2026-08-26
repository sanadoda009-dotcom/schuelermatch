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

// ---------------------------------------------------------------------
// Rohe Fehlertexte (26.8.)
//
// Gemessen: 16 Stellen gaben den englischen Text von Supabase oder der
// Dateiablage direkt an den Nutzer weiter — beim Hochladen des
// Schülerausweises, beim Speichern des Lebenslaufs, beim Anfordern eines
// neuen Passworts. Dort sitzt ein 14-Jähriger, der ohnehin unsicher ist.
//
// Alle bis auf den Betreiber-Bereich laufen jetzt durch `verstaendlich()`.
// Im Betreiber-Bereich bleiben sie ABSICHTLICH roh: Dort sitzt die einzige
// Person, die mit „new row violates row-level security policy" etwas
// anfangen kann.
test.describe('kein englischer Rohtext beim Nutzer', () => {
  async function uebersetzt(page, meldung) {
    return page.evaluate(async m => {
      const z = await import('/js/zustand.js')
      return z.verstaendlich({ message: m }, 'Das Hochladen')
    }, meldung)
  }

  test.beforeEach(async ({ page }) => { await page.goto('/index.html') })

  test('das Tempolimit nennt die Wartezeit', async ({ page }) => {
    // Der häufigste Fall auf den Anmeldeseiten. „Gleich nochmal" ohne
    // Zahl lässt Leute im Sekundentakt weiterklicken.
    const t = await uebersetzt(page, 'For security purposes, you can only request this after 41 seconds.')
    expect(t).toMatch(/41 Sekunden/)
    expect(t.toLowerCase()).not.toMatch(/security purposes|request this/)
  })

  test('auch ohne Sekundenangabe', async ({ page }) => {
    const t = await uebersetzt(page, 'Email rate limit exceeded')
    expect(t).toMatch(/warte/i)
    expect(t.toLowerCase()).not.toMatch(/rate limit/)
  })

  test('eine abgelehnte Dateiart wird erklärt', async ({ page }) => {
    const t = await uebersetzt(page, 'mime type application/zip is not supported')
    expect(t).toMatch(/PDF/)
    expect(t.toLowerCase()).not.toMatch(/mime type/)
  })

  test('die bekannten Fälle bleiben, wie sie waren', async ({ page }) => {
    // Gegenprobe: Die neuen Zweige dürfen die alten nicht verschlucken.
    const faelle = {
      'Failed to fetch': /Verbindung/,
      'new row violates row-level security policy': /Berechtigung/,
      'duplicate key value violates unique constraint': /schon/,
      'JWT expired': /neu an/,
    }
    for (const [roh, erwartet] of Object.entries(faelle)) {
      expect(await uebersetzt(page, roh), roh).toMatch(erwartet)
    }
  })

  test('„Payload too large" bleibt bei der Größe, nicht beim Tempolimit', async ({ page }) => {
    // Die Reihenfolge der Zweige entscheidet — „too large" enthält kein
    // „too many", aber die Prüfungen liegen dicht beieinander.
    const t = await uebersetzt(page, 'The object exceeded the maximum allowed size')
    expect(t).toMatch(/zu groß/)
  })

  test('das Anfordern eines neuen Passworts gibt nichts Rohes preis', async ({ page }) => {
    // Die Erfolgsmeldung sagt bewusst „FALLS diese E-Mail registriert
    // ist" — der Fehlerzweig kippte diesen Schutz vorher wieder um.
    const quelle = await page.evaluate(async () => (await fetch('/js/forgot-password.js')).text())
    expect(quelle, 'roher Fehlertext').not.toMatch(/error\.message/)
    expect(quelle).toMatch(/verstaendlich\(/)
  })

  test('Hochladen und Speichern der Schüler-Seiten sind übersetzt', async ({ page }) => {
    for (const datei of ['/js/dashboard-schueler.js', '/js/lebenslauf.js']) {
      const quelle = await page.evaluate(async d => (await fetch(d)).text(), datei)
      expect(quelle, `${datei}: roher Fehlertext`).not.toMatch(/Err\.message|error\.message/)
    }
  })

  test('im Betreiber-Bereich bleiben sie absichtlich roh', async ({ page }) => {
    // Damit niemand das später als Versehen „korrigiert".
    const quelle = await page.evaluate(async () => (await fetch('/js/admin.js')).text())
    expect(quelle).toMatch(/ABSICHTLICH ROH/)
    expect(quelle).toMatch(/error\.message/)
  })
})
