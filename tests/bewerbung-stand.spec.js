// Der Stand einer Bewerbung (2.9.2026).
//
// ANLASS: Sanads Auftrag zum Bewerbungssystem, Runde 4. Das
// Schüler-Dashboard zeigte eine Zeitleiste mit drei Schritten —
// Eingereicht → In Prüfung → Antwort — aber es gab nur ZWEI Zustände.
// „In Prüfung" wurde abgehakt, sobald der Status nicht mehr `ausstehend`
// war, also erst wenn die Entscheidung schon gefallen war. Der mittlere
// Schritt war Dekoration: Er stand entweder auf „noch nichts passiert"
// oder direkt auf „vorbei".
//
// Dazu der Punkt aus OFFENE-PUNKTE vom 26.8.: Wird eine Bewerbung
// abgelehnt, erfährt der Schüler nur DASS, nie WARUM. Für jemanden, der
// sich zum ersten Mal bewirbt, ist das der Unterschied zwischen „ich mache
// etwas falsch" und „es hat diesmal nicht gepasst".
//
// Neu: `angesehen_am`, `entschieden_am`, `absage_grund`
// (supabase/bewerbung-stand.sql). Absagegründe sind fest, kein Freitext —
// eine Absage ist eine Nachricht von einem Erwachsenen an ein Kind, und
// ein offenes Feld wäre derselbe Kanal wie der Chat.
//
// WICHTIG: Die Spalten sind noch nicht eingespielt. Der Code muss deshalb
// mit UND ohne sie funktionieren — der letzte Block prüft genau das.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA } =
  require('./helpers/supabase-fake')

const JOB = {
  id: 'j-stand', titel: 'Eisverkäufer/in', beschreibung: 'Eis.', ort: 'München',
  stundenlohn: 12, mindestalter: 15, kategorie: 'Verkauf', arbeitszeit: 'Wochenende',
  aktiv: true, aufrufe: 3, erstellt_am: '2026-08-20T10:00:00Z',
  firma_id: FIRMA.id, firma_name: 'Eiscafé Sonne',
}

function bewerbung(extra = {}) {
  return {
    id: 'b1', job_id: JOB.id, schueler_id: SCHUELER.id, status: 'ausstehend',
    erstellt_am: '2026-08-25T10:00:00Z', motivationsschreiben: null,
    ...extra,
  }
}

async function meineBewerbungen(page, bew) {
  const db = defaultDb({
    jobs: [JOB],
    profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)],
    bewerbungen: [bew],
  })
  await setupDashboard(page.context(), { user: SCHUELER, db })
  await page.goto('/dashboard-schueler.html')
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="bewerbungen"]').click()
  await expect(page.locator('.bew-card').first()).toBeVisible({ timeout: 20_000 })
  return db
}

test.describe('die Zeitleiste sagt die Wahrheit', () => {
  test('frisch abgeschickt: die Firma hat noch nicht geschaut', async ({ page }) => {
    await meineBewerbungen(page, bewerbung({ angesehen_am: null }))
    const karte = page.locator('.bew-card').first()
    await expect(karte).toContainText('Eingereicht')
    await expect(karte).toContainText('Wartet auf die Firma')
    await expect(karte).toContainText('Antwort steht aus')
  })

  test('angesehen: der mittlere Schritt ist echt', async ({ page }) => {
    // Der Kern. Vorher war dieser Schritt nur dann abgehakt, wenn die
    // Entscheidung schon gefallen war – er sagte also nie etwas Neues.
    await meineBewerbungen(page, bewerbung({ angesehen_am: '2026-08-27T09:00:00Z' }))
    const karte = page.locator('.bew-card').first()
    await expect(karte).toContainText('Angesehen')
    await expect(karte).not.toContainText('Wartet auf die Firma')
    // Und wann – sonst weiß man wieder nicht, ob das gestern oder im Juli war.
    await expect(karte).toContainText('27. Aug')
    // Entschieden ist damit noch nichts.
    await expect(karte).toContainText('Antwort steht aus')
  })

  test('Zusage: mit Datum und dem Weg zum Chat', async ({ page }) => {
    await meineBewerbungen(page, bewerbung({
      status: 'angenommen',
      angesehen_am: '2026-08-27T09:00:00Z',
      entschieden_am: '2026-08-28T15:00:00Z',
    }))
    const karte = page.locator('.bew-card').first()
    await expect(karte).toContainText('Zusage')
    await expect(karte).toContainText('28. Aug')
    await expect(karte.locator('[data-chat-bewerbung]')).toBeVisible()
  })
})

test.describe('eine Absage sagt, warum', () => {
  test('mit Grund steht der Satz da, nicht nur „nicht geklappt"', async ({ page }) => {
    await meineBewerbungen(page, bewerbung({
      status: 'abgelehnt',
      angesehen_am: '2026-08-27T09:00:00Z',
      entschieden_am: '2026-08-28T15:00:00Z',
      absage_grund: 'zeit',
    }))
    const karte = page.locator('.bew-card').first()
    await expect(karte.locator('.bew-absage-grund')).toContainText('Arbeitszeiten')
    // Und ein Satz, mit dem man etwas anfangen kann.
    await expect(karte.locator('.bew-trost')).toContainText('Lebenslauf')
  })

  test('ohne Grund bleibt es beim allgemeinen Satz – aber freundlich', async ({ page }) => {
    // Alte Absagen haben keinen Grund. Sie dürfen deshalb nicht leer
    // aussehen.
    await meineBewerbungen(page, bewerbung({ status: 'abgelehnt', absage_grund: null }))
    const karte = page.locator('.bew-card').first()
    await expect(karte.locator('.bew-absage-grund')).toContainText('nicht geklappt')
    await expect(karte.locator('.bew-trost')).not.toBeEmpty()
  })

  test('jeder erlaubte Grund hat einen Satz für beide Seiten', async ({ page }) => {
    // Die Schlüssel stehen doppelt: hier und in der CHECK-Regel der
    // Datenbank. Wer einen hinzufügt und die Regel vergisst, bekommt eine
    // Absage, die die Datenbank zurückweist.
    await page.goto('/index.html')
    const m = await page.evaluateHandle(() => import('/js/absage.js'))
    const luecken = await page.evaluate(async ({ mod }) => mod.ABSAGE_GRUENDE
      .filter(g => !g.schluessel || !g.fuerFirma || !g.fuerSchueler || !g.trost)
      .map(g => g.schluessel || '(ohne Schlüssel)'), { mod: m })
    expect(luecken, 'Absagegrund ohne Text').toEqual([])

    const schluessel = await page.evaluate(async ({ mod }) =>
      mod.ABSAGE_GRUENDE.map(g => g.schluessel), { mod: m })
    const fs = require('fs')
    const path = require('path')
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'supabase', 'bewerbung-stand.sql'), 'utf8')
    const fehlend = schluessel.filter(s => !sql.includes(`'${s}'`))
    expect(fehlend, 'Grund fehlt in der CHECK-Regel der Datenbank').toEqual([])
  })

  test('es gibt kein freies Textfeld für die Absage', async () => {
    // Bewusste Entscheidung, festgehalten: Eine Absage geht von einem
    // Erwachsenen an ein Kind. Ein offenes Feld wäre derselbe Kanal wie
    // der Chat und bräuchte dieselbe Prüfung auf Kontaktdaten und
    // Übergriffe – und es lässt den verletzenden Satz zu, den jemand im
    // Ärger tippt.
    const fs = require('fs')
    const path = require('path')
    const html = fs.readFileSync(
      path.join(__dirname, '..', 'dashboard-firma.html'), 'utf8')
    expect(/id="absage-freitext"|name="absage-text"/.test(html),
      'Freitext für die Absage eingebaut').toBe(false)
  })
})

test.describe('ohne die neuen Spalten bricht nichts', () => {
  test('eine Bewerbung im alten Format wird weiter angezeigt', async ({ page }) => {
    // supabase/bewerbung-stand.sql ist noch nicht eingespielt. Bis dahin
    // liefert die Datenbank die Spalten gar nicht – dann muss die Karte
    // auf das alte Verhalten zurückfallen, statt kaputt auszusehen.
    const alt = {
      id: 'b-alt', job_id: JOB.id, schueler_id: SCHUELER.id,
      status: 'angenommen', erstellt_am: '2026-08-25T10:00:00Z',
      motivationsschreiben: null,
      // kein angesehen_am, kein entschieden_am, kein absage_grund
    }
    await meineBewerbungen(page, alt)
    const karte = page.locator('.bew-card').first()
    await expect(karte).toContainText('Eingereicht')
    await expect(karte).toContainText('Angesehen')
    await expect(karte).toContainText('Zusage')
    await expect(karte).not.toContainText('undefined')
    await expect(karte).not.toContainText('Invalid Date')
  })
})

test.describe('die Firma sagt ab', () => {
  async function firmenDashboard(page) {
    const db = defaultDb({
      jobs: [JOB],
      profiles: [profilZeile(FIRMA), profilZeile(SCHUELER, { verifiziert: true })],
      bewerbungen: [bewerbung({ angesehen_am: null })],
    })
    await setupDashboard(page.context(), { user: FIRMA, db })
    await page.goto('/dashboard-firma.html')
    await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
    // Die Sidebar ist ausgeblendet - erst oeffnen. Und die Bewerber
    // stehen seit dem 2.9.2026 in EIGENER Ansicht, nicht mehr in der
    // Anzeigenliste.
    await page.locator('#sidebar-toggle').click()
    await page.locator('.sidebar-item[data-view="bewerbungen"]').click()
    await expect(page.locator('.bewerber-item').first()).toBeVisible({ timeout: 20_000 })
    return db
  }

  test('Ablehnen fragt zuerst nach dem Grund – ohne Popup', async ({ page }) => {
    const db = await firmenDashboard(page)
    await page.locator('button', { hasText: 'Ablehnen' }).first().click()

    await expect(page.locator('.absage-frage')).toBeVisible()
    await expect(page.locator('.absage-wahl')).not.toHaveCount(0)
    // Noch ist nichts entschieden – erst der Grund schickt ab.
    expect(db.bewerbungen[0].status).toBe('ausstehend')
  })

  test('der gewählte Grund landet an der Bewerbung', async ({ page }) => {
    const db = await firmenDashboard(page)
    await page.locator('button', { hasText: 'Ablehnen' }).first().click()
    await page.locator('.absage-wahl[data-grund="entfernung"]').click()

    await expect.poll(() => db.bewerbungen[0].status, { timeout: 20_000 }).toBe('abgelehnt')
    expect(db.bewerbungen[0].absage_grund).toBe('entfernung')
    expect(db.bewerbungen[0].entschieden_am).toBeTruthy()
  })

  test('„Doch nicht" sagt nicht ab', async ({ page }) => {
    const db = await firmenDashboard(page)
    await page.locator('button', { hasText: 'Ablehnen' }).first().click()
    await page.locator('.absage-zurueck').click()

    await expect(page.locator('.absage-frage')).toHaveCount(0)
    expect(db.bewerbungen[0].status).toBe('ausstehend')
  })

  test('das Öffnen der Liste setzt „angesehen"', async ({ page }) => {
    // Damit der mittlere Schritt beim Schüler überhaupt etwas bedeutet.
    const db = await firmenDashboard(page)
    await expect.poll(() => db.bewerbungen[0].angesehen_am, { timeout: 20_000 }).toBeTruthy()
  })

  test('Annehmen hält fest, wann entschieden wurde', async ({ page }) => {
    const db = await firmenDashboard(page)
    await page.locator('button', { hasText: 'Annehmen' }).first().click()
    await expect.poll(() => db.bewerbungen[0].status, { timeout: 20_000 }).toBe('angenommen')
    expect(db.bewerbungen[0].entschieden_am).toBeTruthy()
  })
})
