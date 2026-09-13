// Wohin die Links in den E-Mails führen (13.9.2026).
//
// DER BEFUND: Dieselbe Sorte Fehler wie bei der Glocke am 9.9., nur in
// der Mail.
//   - „Zum Chat" in der Zusage-Mail → dashboard-schueler.html. Das öffnet
//     mit der Jobbörse, nicht mit dem Chat.
//   - „Bewerbung ansehen" (sofort) und „Bewerbungen ansehen" (täglich) an
//     die Firma → dashboard-firma.html. Das öffnet mit „Job posten".
//   - Die Absage-Mail sagte immer „Diesmal hat sich die Firma für jemand
//     anderen entschieden" – auch wenn die Firma „Die Zeiten passen nicht
//     zusammen" gewählt hatte, was im Dashboard des Schülers so steht.
//
// Und dabei: Wer nicht angemeldet war, wurde vom Dashboard zum Login
// geschickt und landete danach auf der Startansicht – die Adresse ging
// verloren. Das traf auch den geteilten Anzeigen-Link (?job=) vom 9.9.
//
// WICHTIG: Die Mail-Funktionen laufen als Edge Functions und gehen NICHT
// mit `git push` live. Beim Nachsehen am 13.9.: mail-ereignis war seit dem
// 28.7. nicht neu ausgerollt, mail-digest seit dem 20.7. – mehrere
// Korrekturen aus dem Repository sind dort nie angekommen. Siehe
// OFFENE-PUNKTE.md.

const { test, expect, setupDashboard, defaultDb, profilZeile, warteAufDashboard, SCHUELER, FIRMA } =
  require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = f => fs.readFileSync(path.join(WURZEL, f), 'utf8')

test.describe('?ansicht= öffnet die genannte Ansicht', () => {
  test('Firma: bewerbungen', async ({ page }) => {
    await setupDashboard(page.context(), { user: FIRMA, db: defaultDb({ profiles: [profilZeile(FIRMA)] }) })
    await page.goto('/dashboard-firma.html?ansicht=bewerbungen')
    await warteAufDashboard(page)
    await expect(page.locator('#view-bewerbungen')).toHaveClass(/active/, { timeout: 20_000 })
    expect(new URL(page.url()).search, 'der Parameter verschwindet aus der Adresse').toBe('')
  })

  test('Schüler: nachrichten', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html?ansicht=nachrichten')
    await warteAufDashboard(page)
    await expect(page.locator('#view-nachrichten')).toHaveClass(/active/, { timeout: 20_000 })
  })

  test('eine unbekannte Ansicht wird still übergangen', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html?ansicht=gibtsnicht')
    await warteAufDashboard(page)
    await expect(page.locator('#view-jobs')).toHaveClass(/active/)
  })
})

test.describe('nach dem Login zurück zum Ziel', () => {
  test('ohne Anmeldung nimmt der Weg zum Login das Ziel mit', async ({ page }) => {
    await setupDashboard(page.context(), { user: null })
    await page.goto('/dashboard-firma.html?ansicht=bewerbungen')
    await expect(page).toHaveURL(/login\.html\?weiter=/)
    expect(new URL(page.url()).searchParams.get('weiter')).toBe('dashboard-firma.html?ansicht=bewerbungen')
  })

  test('das Ziel wird streng geprüft – keine Weiterleitung nach außen', async ({ page }) => {
    await page.goto('/login.html')
    const ergebnis = await page.evaluate(async () => {
      const { zielNachLogin } = await import('/js/auth.js')
      const f = [
        ['firma', '?weiter=dashboard-firma.html%3Fansicht%3Dbewerbungen'],
        ['schueler', '?weiter=dashboard-schueler.html%3Fjob%3Dabc-1'],
        ['schueler', '?weiter=https%3A%2F%2Fboese.de'],
        ['schueler', '?weiter=%2F%2Fboese.de'],
        ['schueler', '?weiter=javascript%3Aalert(1)'],
        ['schueler', '?weiter=dashboard-firma.html'],
        ['firma', '?weiter=dashboard-firma.html%3Fx%3D%22%3E%3Cscript'],
        ['firma', ''],
      ]
      return f.map(([r, s]) => zielNachLogin(r, s))
    })
    expect(ergebnis).toEqual([
      'dashboard-firma.html?ansicht=bewerbungen',
      'dashboard-schueler.html?job=abc-1',
      'dashboard-schueler.html',          // fremde Domain
      'dashboard-schueler.html',          // //boese.de
      'dashboard-schueler.html',          // javascript:
      'dashboard-schueler.html',          // Dashboard der anderen Rolle
      'dashboard-firma.html',             // Zeichen außerhalb der Liste
      'dashboard-firma.html',             // kein Ziel
    ])
  })
})

test.describe('die Mail-Texte', () => {
  const ereignis = lies('supabase/functions/mail-ereignis/index.ts')
  const digest = lies('supabase/functions/mail-digest/index.ts')

  test('„Zum Chat" führt in den Chat', async () => {
    const stelle = ereignis.slice(ereignis.indexOf('Du hast eine Zusage!'), ereignis.indexOf('Zum Chat</a>'))
    expect(stelle).toContain('dashboard-schueler.html?ansicht=nachrichten')
  })

  test('„Bewerbung(en) ansehen" führt zu den Bewerbungen – sofort und täglich', async () => {
    const sofort = ereignis.slice(ereignis.indexOf('Neue Bewerbung 🎉'), ereignis.indexOf('Bewerbung ansehen</a>'))
    expect(sofort).toContain('dashboard-firma.html?ansicht=bewerbungen')
    expect(digest).toContain('dashboard-firma.html?ansicht=bewerbungen')
  })

  test('jede Ansicht, auf die eine Mail zeigt, gibt es im Dashboard', async () => {
    const ziele = [...(ereignis + digest).matchAll(/(dashboard-(?:schueler|firma)\.html)\?ansicht=([a-z]+)/g)]
    expect(ziele.length, 'sonst prüft der Test nichts').toBeGreaterThan(2)
    for (const [, seite, ansicht] of ziele) {
      expect(lies(seite), `${seite} kennt die Ansicht "${ansicht}" nicht`).toContain(`data-view="${ansicht}"`)
    }
  })

  test('die Absage behauptet keinen Grund, den die Firma nicht genannt hat', async () => {
    expect(ereignis).not.toMatch(/für jemand anderen entschieden/)
    // … und die Abfrage bringt den Grund mit, wenn es die Spalte gibt,
    // ohne abzubrechen, wenn nicht.
    expect(ereignis).toMatch(/\.select\('\*, job:job_id/)
  })
})
