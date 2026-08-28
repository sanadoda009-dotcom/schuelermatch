// „Konto löschen" im Bereich Einstellungen (27.8.).
//
// Bis dahin konnte niemand sein Konto selbst löschen. Es gab nur
// `supabase/konto-loeschen.sql` — eine Anleitung für den Betreiber, von
// Hand, Schritt für Schritt. Ein Konto, das man nur per E-Mail-Bitte
// wieder loswird, ist kein Konto, das einem gehört.
//
// Die eigentliche Arbeit macht die Edge Function `konto-loeschen`. Sie
// leitet die Nutzer-Id AUSSCHLIESSLICH aus dem Anmelde-Token ab und
// nimmt bewusst keinen Parameter dafür — sonst könnte jeder das Konto
// eines anderen löschen. Gegen die echte Funktion geprüft (27.8.):
//   anon-Schlüssel  -> 401   (er ist selbst ein gültiges JWT!)
//   ohne Token      -> 401
//   GET statt POST  -> 405
//
// Hier geht es um die Bedienung im Browser.
const { test, expect, setupDashboard, defaultDb, SCHUELER } = require('./helpers/supabase-fake')

const FUNKTION = '**/functions/v1/konto-loeschen'

async function zuEinstellungen(page) {
  await setupDashboard(page.context(), { user: SCHUELER, db: defaultDb() })
  await page.goto('/dashboard-schueler.html')
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="einstellungen"]').click()
  await expect(page.locator('#view-einstellungen')).toBeVisible()
}

// Fängt den Aufruf ab und merkt sich, ob er kam.
async function funktionMocken(page, antwort = { ok: true, dateien: 0 }, status = 200) {
  const rufe = []
  await page.route(FUNKTION, route => {
    rufe.push(route.request().postData())
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(antwort) })
  })
  return rufe
}

test.describe('Konto löschen', () => {
  test('der Bereich steht in den Einstellungen', async ({ page }) => {
    await zuEinstellungen(page)
    await expect(page.locator('#konto-loeschen-start')).toBeVisible()
  })

  test('er sagt, was verschwindet — und dass es endgültig ist', async ({ page }) => {
    // Wer das anklickt, muss vorher wissen, was weg ist.
    await zuEinstellungen(page)
    const text = await page.locator('.gefahr-box').innerText()
    expect(text).toMatch(/Lebenslauf/)
    expect(text).toMatch(/Bewerbungen/)
    expect(text).toMatch(/nicht rückgängig/i)
  })

  test('er bietet den sanfteren Weg an', async ({ page }) => {
    // Die meisten, die hier landen, wollen eigentlich nur ihre Ruhe.
    // Ihnen das Konto zu nehmen wäre die falsche Antwort darauf.
    await zuEinstellungen(page)
    const text = await page.locator('.gefahr-box').innerText()
    expect(text).toMatch(/Job-Alarm aus/)
  })

  test('die Bestätigung ist erst nach einem Klick da', async ({ page }) => {
    await zuEinstellungen(page)
    await expect(page.locator('#konto-loeschen-bestaetigen')).toBeHidden()
    await page.locator('#konto-loeschen-start').click()
    await expect(page.locator('#konto-loeschen-bestaetigen')).toBeVisible()
  })

  test('ohne das getippte Wort passiert NICHTS', async ({ page }) => {
    // Der Kern des Schutzes. Überall sonst reichen zwei Klicks — hier
    // nicht, denn das hier lässt sich nicht wiederholen.
    await zuEinstellungen(page)
    const rufe = await funktionMocken(page)
    await page.locator('#konto-loeschen-start').click()
    await page.locator('#konto-loeschen-jetzt').click()

    await expect(page.locator('.toast')).toContainText(/LÖSCHEN/)
    expect(rufe, 'die Funktion darf gar nicht erst gerufen werden').toEqual([])
  })

  test('auch ein Tippfehler reicht nicht', async ({ page }) => {
    await zuEinstellungen(page)
    const rufe = await funktionMocken(page)
    await page.locator('#konto-loeschen-start').click()
    await page.locator('#konto-loeschen-wort').fill('LOSCHEN')
    await page.locator('#konto-loeschen-jetzt').click()
    expect(rufe).toEqual([])
  })

  test('Kleinschreibung und Leerzeichen sind aber in Ordnung', async ({ page }) => {
    // Wer es ernst meint, soll nicht an Zwischenräumen scheitern.
    await zuEinstellungen(page)
    const rufe = await funktionMocken(page)
    await page.locator('#konto-loeschen-start').click()
    await page.locator('#konto-loeschen-wort').fill('  löschen ')
    await page.locator('#konto-loeschen-jetzt').click()
    await expect.poll(() => rufe.length).toBe(1)
  })

  test('mit dem richtigen Wort wird gelöscht und weitergeleitet', async ({ page }) => {
    await zuEinstellungen(page)
    await funktionMocken(page)
    await page.locator('#konto-loeschen-start').click()
    await page.locator('#konto-loeschen-wort').fill('LÖSCHEN')
    await page.locator('#konto-loeschen-jetzt').click()

    await page.waitForURL(/index\.html\?konto=geloescht/, { timeout: 15_000 })
  })

  test('es wird KEINE Nutzer-Id mitgeschickt', async ({ page }) => {
    // Der wichtigste Punkt an der ganzen Sache: Die Funktion leitet sie
    // aus dem Token ab. Stünde sie im Aufruf, könnte jemand sie
    // austauschen und ein fremdes Konto löschen.
    await zuEinstellungen(page)
    const rufe = await funktionMocken(page)
    await page.locator('#konto-loeschen-start').click()
    await page.locator('#konto-loeschen-wort').fill('LÖSCHEN')
    await page.locator('#konto-loeschen-jetzt').click()

    await expect.poll(() => rufe.length).toBe(1)
    expect(rufe[0] ?? '').not.toContain(SCHUELER.id)
  })

  test('Abbrechen führt zurück, ohne etwas zu tun', async ({ page }) => {
    await zuEinstellungen(page)
    const rufe = await funktionMocken(page)
    await page.locator('#konto-loeschen-start').click()
    await page.locator('#konto-loeschen-wort').fill('LÖSCHEN')
    await page.locator('#konto-loeschen-abbruch').click()

    await expect(page.locator('#konto-loeschen-bestaetigen')).toBeHidden()
    await expect(page.locator('#konto-loeschen-start')).toBeVisible()
    expect(rufe).toEqual([])
  })

  test('nach dem Abbrechen ist das Feld wieder leer', async ({ page }) => {
    // Sonst stünde beim nächsten Öffnen noch „LÖSCHEN" drin und ein
    // einziger Klick würde reichen.
    await zuEinstellungen(page)
    await page.locator('#konto-loeschen-start').click()
    await page.locator('#konto-loeschen-wort').fill('LÖSCHEN')
    await page.locator('#konto-loeschen-abbruch').click()
    await page.locator('#konto-loeschen-start').click()
    await expect(page.locator('#konto-loeschen-wort')).toHaveValue('')
  })

  test('schlägt es fehl, bleibt man da und kann es erneut versuchen', async ({ page }) => {
    await zuEinstellungen(page)
    await funktionMocken(page, { fehler: 'kaputt' }, 500)
    await page.locator('#konto-loeschen-start').click()
    await page.locator('#konto-loeschen-wort').fill('LÖSCHEN')
    await page.locator('#konto-loeschen-jetzt').click()

    await expect(page.locator('.toast')).toContainText(/nicht geklappt/)
    await expect(page.locator('#konto-loeschen-jetzt')).toBeEnabled()
    await expect(page.locator('#konto-loeschen-jetzt')).toHaveText(/endgültig löschen/)
    expect(page.url()).toContain('dashboard-schueler.html')
  })
})

// Fuer die Startseite die andere Test-Basis: `supabase-fake` umgeht das
// Zugangs-Gate erst in `setupDashboard`, und das wird hier nicht
// gebraucht. `helpers/basis` umgeht es fuer jeden Test.
const basis = require('./helpers/basis')

basis.test.describe('Bestätigung auf der Startseite', () => {
  basis.test('nach dem Löschen steht dort, dass es geklappt hat', async ({ page }) => {
    // Ohne ein Wort dazu wüsste niemand, ob es funktioniert hat — und
    // würde sich womöglich wieder anzumelden versuchen, um nachzusehen.
    await page.goto('/index.html?konto=geloescht')
    const box = page.locator('.konto-weg')
    await expect(box).toBeVisible()
    await expect(box).toContainText(/gelöscht/)
  })

  basis.test('sie verschwindet nicht von selbst', async ({ page }) => {
    // Bewusst kein Toast: Der wäre weg, bevor man ihn gelesen hat.
    await page.goto('/index.html?konto=geloescht')
    await expect(page.locator('.konto-weg')).toBeVisible()
    await page.waitForTimeout(4500)
    await expect(page.locator('.konto-weg')).toBeVisible()
  })

  basis.test('man kann sie wegklicken', async ({ page }) => {
    await page.goto('/index.html?konto=geloescht')
    await page.locator('.konto-weg-zu').click()
    await expect(page.locator('.konto-weg')).toHaveCount(0)
  })

  basis.test('ein Neuladen wiederholt sie nicht', async ({ page }) => {
    // Der Parameter wird aus der Adresse genommen. Sonst stünde die
    // Meldung bei jedem Besuch dieser Adresse wieder da.
    await page.goto('/index.html?konto=geloescht')
    await expect(page.locator('.konto-weg')).toBeVisible()
    expect(page.url()).not.toContain('konto=geloescht')

    await page.reload()
    await expect(page.locator('.konto-weg')).toHaveCount(0)
  })

  basis.test('ohne den Parameter erscheint nichts', async ({ page }) => {
    await page.goto('/index.html')
    await expect(page.locator('.konto-weg')).toHaveCount(0)
  })
})
