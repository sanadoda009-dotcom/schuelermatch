// Anhaltspunkte zur Firmenprüfung (26.8.).
//
// `fuer-firmen.html` verspricht: „Wir prüfen von Hand, dass ein echtes
// Unternehmen dahintersteckt." Die Firmenkarte im Betreiber-Bereich
// zeigte dafür nur Name, Ort und E-Mail — damit lässt sich kaum etwas
// prüfen. Die Zusage war stärker als das, was der Betreiber in der Hand
// hatte.
//
// `js/firmen-pruefung.js` zieht aus den vorhandenen Angaben die
// Anhaltspunkte heraus, die etwas aussagen. Es entscheidet NICHTS und
// blockiert NICHTS — die Freigabe bleibt Handarbeit.
//
// GRUNDHALTUNG: Ein Freemail-Konto ist kein Betrugsverdacht. Ein
// Nachhilfe-Elternteil oder ein kleiner Laden hat oft nichts anderes.
// Wer lauter rote Warnungen sieht, klickt sie nach drei Tagen weg —
// deshalb prüfen mehrere Tests ausdrücklich, dass NICHT gewarnt wird.
const { test, expect } = require('./helpers/basis')

async function modul(page, fn, arg) {
  return page.evaluate(async ({ code, arg }) => {
    const m = await import('/js/firmen-pruefung.js')
    return new Function('m', 'a', 'return (' + code + ')(m, a)')(m, arg)
  }, { code: fn.toString(), arg })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html')
})

test.describe('Domain aus der Adresse lesen', () => {
  test('normale Adressen', async ({ page }) => {
    const r = await modul(page, m =>
      ['a@firma.de', 'Vor.Nach@Sub.Firma.COM'].map(m.domainVon))
    expect(r).toEqual(['firma.de', 'sub.firma.com'])
  })

  test('Unfug ergibt nichts statt eines Absturzes', async ({ page }) => {
    const r = await modul(page, m =>
      ['', null, undefined, 'keine-adresse', 'a@', '@b.de', 'a@ohnepunkt'].map(m.domainVon))
    expect(r).toEqual([null, null, null, null, null, 'b.de', null])
  })
})

test.describe('Freemail erkennen', () => {
  test('die verbreiteten deutschen Anbieter', async ({ page }) => {
    const r = await modul(page, m =>
      ['a@gmx.de', 'a@web.de', 't@t-online.de', 'a@gmail.com', 'a@hotmail.de'].map(m.istFreemail))
    expect(r).toEqual([true, true, true, true, true])
  })

  test('eine eigene Domain ist kein Freemail', async ({ page }) => {
    const r = await modul(page, m =>
      ['info@baeckerei-mueller.de', 'jobs@rewe.de'].map(m.istFreemail))
    expect(r).toEqual([false, false])
  })

  test('Wegwerf-Adressen sind etwas anderes als Freemail', async ({ page }) => {
    // Beim einen ist Nachfragen angebracht, beim anderen Misstrauen.
    const r = await modul(page, m => ({
      wegwerf: m.istWegwerf('x@mailinator.com'),
      freemailFlagAmWegwerf: m.istFreemail('x@mailinator.com'),
      gmxIstKeinWegwerf: m.istWegwerf('x@gmx.de')
    }))
    expect(r).toEqual({ wegwerf: true, freemailFlagAmWegwerf: false, gmxIstKeinWegwerf: false })
  })
})

test.describe('Rechtsform im Namen', () => {
  test('gängige Formen werden erkannt', async ({ page }) => {
    const r = await modul(page, m =>
      ['Müller GmbH', 'Start UG', 'Bäcker KG', 'Sportverein e.V.', 'Handel OHG'].map(m.hatRechtsform))
    expect(r).toEqual([true, true, true, true, true])
  })

  test('ein Einzelunternehmen ohne Rechtsform ist kein Makel', async ({ page }) => {
    const r = await modul(page, m =>
      ['Bäckerei Müller', 'Café Sonnenschein', ''].map(m.hatRechtsform))
    expect(r).toEqual([false, false, false])
  })
})

test.describe('die Hinweise als Ganzes', () => {
  test('eigene Domain plus Rechtsform: zwei gute Zeichen, keine Warnung', async ({ page }) => {
    const h = await modul(page, m =>
      m.hinweiseZu({ name: 'Bäckerei Müller GmbH', ort: 'München', email: 'info@baeckerei-mueller.de' }))
    expect(h.every(x => x.art === 'gut')).toBe(true)
    expect(h).toHaveLength(2)
  })

  test('Freemail führt zu einem Hinweis, nicht zu einer Warnung', async ({ page }) => {
    // Der wichtigste Test dieser Datei. Ein Elternteil, das Nachhilfe
    // sucht, hat eine GMX-Adresse — das ist normal.
    const h = await modul(page, m =>
      m.hinweiseZu({ name: 'Familie Schmidt', ort: 'Köln', email: 'schmidt@gmx.de' }))
    expect(h.some(x => x.art === 'achtung'), 'kein Alarm bei Freemail').toBe(false)
    expect(h.some(x => x.art === 'hinweis')).toBe(true)
    expect(h.find(x => x.art === 'hinweis').text).toMatch(/normal/)
  })

  test('eine Wegwerf-Adresse wird deutlich benannt', async ({ page }) => {
    const h = await modul(page, m =>
      m.hinweiseZu({ name: 'Schnell GmbH', ort: 'Berlin', email: 'x@mailinator.com' }))
    const alarm = h.find(x => x.art === 'achtung')
    expect(alarm).toBeTruthy()
    expect(alarm.text).toMatch(/Wegwerf/)
  })

  test('ein fehlender Ort wird bemerkt', async ({ page }) => {
    const h = await modul(page, m =>
      m.hinweiseZu({ name: 'Firma X GmbH', ort: '', email: 'a@firma-x.de' }))
    expect(h.some(x => /Ort/.test(x.text))).toBe(true)
  })

  test('nur ein Hinweis zur Adresse, nie zwei', async ({ page }) => {
    // Freemail, Wegwerf und eigene Domain schliessen sich aus.
    for (const email of ['a@gmx.de', 'a@mailinator.com', 'a@firma.de', 'kaputt']) {
      const h = await modul(page, (m, e) => m.hinweiseZu({ name: 'X', ort: 'Y', email: e }), email)
      const zurAdresse = h.filter(x => /Adresse|Domain/.test(x.text))
      expect(zurAdresse.length, `bei ${email}`).toBeLessThanOrEqual(1)
    }
  })

  test('eine leere Firma stürzt nicht ab', async ({ page }) => {
    const r = await modul(page, m => [m.hinweiseZu({}), m.hinweiseZu(null)].map(x => Array.isArray(x)))
    expect(r).toEqual([true, true])
  })
})

// ---------------------------------------------------------------------
// Am echten Betreiber-Bereich
// ---------------------------------------------------------------------
const fake = require('./helpers/supabase-fake')

fake.test.describe('Firmenkarte im Betreiber-Bereich', () => {
  const { expect: erwarte, setupDashboard, defaultDb, profilZeile, ADMIN, warteAufAdmin } = fake

  async function oeffneFirmen(page, firmen) {
    const db = defaultDb({ profiles: [profilZeile(ADMIN, { ist_admin: true }), ...firmen], jobs: [] })
    db.meldungen = []
    await setupDashboard(page.context(), { user: ADMIN, db })
    await page.goto('/admin.html')
    await warteAufAdmin(page)
    await page.locator('.admin-tab[data-tab="firmen"]').click()
    await erwarte(page.locator('#panel-firmen')).toHaveClass(/active/)
  }

  fake.test('bei einer neuen Firma stehen die Anhaltspunkte auf der Karte', async ({ page }) => {
    await oeffneFirmen(page, [profilZeile(
      { id: 'neu-1', name: 'Bäckerei Müller GmbH', role: 'firma', email: 'info@baeckerei-mueller.de' },
      { firma_status: 'neu', ort: 'München' })])

    const karte = page.locator('.admin-karte', { hasText: 'Bäckerei Müller' })
    await erwarte(karte.locator('.pruef-hinweis')).toHaveCount(2)
    await erwarte(karte).toContainText('baeckerei-mueller.de')
    await erwarte(karte).toContainText('Handelsregister')
  })

  fake.test('eine Wegwerf-Adresse fällt sofort auf', async ({ page }) => {
    await oeffneFirmen(page, [profilZeile(
      { id: 'neu-2', name: 'Schnell GmbH', role: 'firma', email: 'x@mailinator.com' },
      { firma_status: 'neu', ort: 'Berlin' })])

    const karte = page.locator('.admin-karte', { hasText: 'Schnell GmbH' })
    await erwarte(karte.locator('.pruef-hinweis--achtung')).toHaveCount(1)
    await erwarte(karte).toContainText('Wegwerf')
  })

  fake.test('bei bereits freigegebenen Firmen erscheinen keine Hinweise', async ({ page }) => {
    // Sie sind geprüft — die Lesehilfe hätte dort nur noch Rauschwert.
    await oeffneFirmen(page, [profilZeile(
      { id: 'alt-1', name: 'Café Sonnenschein', role: 'firma', email: 'chef@gmx.de' },
      { firma_status: 'freigegeben', ort: 'Köln' })])

    // Der Filter steht auf „neu" — erst auf „alle" umschalten.
    await page.locator('#firma-filter .pill[data-ff="alle"]').click()
    const karte = page.locator('.admin-karte', { hasText: 'Café Sonnenschein' })
    await erwarte(karte).toBeVisible()
    await erwarte(karte.locator('.pruef-hinweis')).toHaveCount(0)
  })
})
