// Die Bewerbungsansicht der Firma sah „grässlich" aus (13.9.2026).
//
// ANLASS: Sanad schickte ein Bildschirmfoto von schuelermatch.de mit
// genau diesem Wort. Nachgestellt und gemessen, es waren drei Ursachen:
//
//   1. EIN LEERER STREIFEN VON 130 PIXELN unter den Filtern. Jede
//      Anzeigen-Gruppe ist ein <section>, und `section { padding: 130px
//      24px }` ist die Regel für die großen Abschnitte der Startseite.
//      Dieselbe Regel traf auch die Reiter im Betreiber-Bereich.
//
//   2. KNÖPFE ÜBER DIE GANZE BREITE. Die Einträge waren noch für ihren
//      alten Platz gebaut, klein in einer schmalen Anzeigen-Karte, mit
//      `flex:1`. In der eigenen, breiten Ansicht (seit 2.9.) wurden
//      daraus Balken von 1250 Pixeln, allen voran ein schwarzer
//      „Lebenslauf (PDF)".
//
//   3. KEINE KANTE. Der Eintrag hatte die Farbe der Seite; mehrere
//      Bewerbungen liefen ineinander.
//
// Das ist derselbe Fehler wie beim Glocken-Ziel am 9.9.: Beim Aufteilen
// der Ansicht am 2.9. ist nicht mitgewandert, was am alten Platz hing.

const { test, expect, setupDashboard, defaultDb, profilZeile, warteAufDashboard, SCHUELER, FIRMA } =
  require('./helpers/supabase-fake')

const JOB = {
  id: 'j-karte', firma_id: FIRMA.id, firma_name: FIRMA.name, titel: 'Lagermitarbeiter',
  beschreibung: 'Lager.', ort: 'München', stundenlohn: 13, mindestalter: 16,
  kategorie: 'Sonstiges', arbeitszeit: 'Wochenende', aktiv: true, aufrufe: 3,
  erstellt_am: '2026-07-10T10:00:00Z', lat: 48.1, lon: 11.5, verfuegbarkeit: null,
}

function db() {
  return defaultDb({
    jobs: [JOB],
    profiles: [profilZeile(FIRMA), profilZeile(SCHUELER, { verifiziert: true, alter_jahre: 16, ort: 'München' })],
    bewerbungen: [
      { id: 'bw-a', job_id: JOB.id, schueler_id: SCHUELER.id, status: 'angenommen',
        erstellt_am: '2026-07-20T10:00:00Z', motivationsschreiben: 'Hallo.' },
      { id: 'bw-o', job_id: JOB.id, schueler_id: SCHUELER.id, status: 'ausstehend',
        erstellt_am: '2026-07-21T10:00:00Z', motivationsschreiben: null },
    ],
  })
}

async function ansicht(page, { breite = 1280, hoehe = 900 } = {}) {
  await page.setViewportSize({ width: breite, height: hoehe })
  await setupDashboard(page.context(), { user: FIRMA, db: db() })
  await page.goto('/dashboard-firma.html')
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
  await page.evaluate(() => document.querySelector('.sidebar-item[data-view="bewerbungen"]').click())
  await expect(page.locator('.bewerber-item')).toHaveCount(2, { timeout: 20_000 })
}

test.describe('breiter Bildschirm', () => {
  test('kein leerer Streifen über der ersten Gruppe', async ({ page }) => {
    await ansicht(page)
    const m = await page.evaluate(() => {
      const g = document.querySelector('.bew-gruppe')
      const f = document.getElementById('bewerber-filter')
      return {
        padding: getComputedStyle(g).paddingTop,
        abstand: g.getBoundingClientRect().top - f.getBoundingClientRect().bottom,
      }
    })
    expect(m.padding, 'die Startseiten-Regel für <section> greift wieder').toBe('0px')
    expect(m.abstand, `Abstand Filter → Gruppe: ${m.abstand}px`).toBeLessThan(60)
  })

  test('jede Bewerbung ist eine Karte mit eigener Kante', async ({ page }) => {
    await ansicht(page)
    const s = await page.evaluate(() => {
      const k = getComputedStyle(document.querySelector('.bewerber-item'))
      return { hintergrund: k.backgroundColor, rand: k.borderTopWidth, seite: getComputedStyle(document.body).backgroundColor }
    })
    expect(s.hintergrund, 'Karte hat die Farbe der Seite').not.toBe(s.seite)
    expect(s.rand).not.toBe('0px')
  })

  test('die Knöpfe sind so breit wie ihr Text, nicht wie die Seite', async ({ page }) => {
    await ansicht(page)
    const breiten = await page.evaluate(() =>
      [...document.querySelectorAll('.bewerber-item button')].map(b => ({
        text: b.textContent.trim(), breite: Math.round(b.getBoundingClientRect().width),
      })))
    expect(breiten.length, 'sonst prüft der Test nichts').toBeGreaterThan(3)
    const balken = breiten.filter(b => b.breite > 300)
    expect(balken, 'Knöpfe als Balken über die Karte').toEqual([])
  })

  test('der Stand steht vorn, vor den übrigen Hinweisen', async ({ page }) => {
    await ansicht(page)
    const erstes = await page.locator('.bewerber-item').first()
      .locator('.bew-marken > span').first().getAttribute('class')
    expect(erstes).toContain('status-badge')
  })

  test('beim Ablehnen bekommen die Gründe eine eigene Zeile unter der Person', async ({ page }) => {
    await ansicht(page)
    const karte = page.locator('.bewerber-item', { has: page.locator('[data-status-wert="abgelehnt"]') })
    await karte.getByRole('button', { name: 'Ablehnen' }).click()
    await expect(karte.locator('.absage-wahl').first()).toBeVisible()

    const m = await karte.evaluate(k => ({
      person: k.querySelector('.bew-person').getBoundingClientRect().bottom,
      gruende: k.querySelector('.absage-gruende').getBoundingClientRect().top,
    }))
    expect(m.gruende, 'die Gründe stehen neben statt unter der Person').toBeGreaterThanOrEqual(m.person)
    await expect(karte.getByRole('button', { name: 'Lebenslauf' })).toBeHidden()

    // „Doch nicht" bringt alles zurück.
    await karte.locator('.absage-zurueck').click()
    await expect(page.locator('.bewerber-item').nth(1).getByRole('button', { name: 'Lebenslauf' })).toBeVisible()
  })
})

test.describe('Handy', () => {
  test('alle Knöpfe sind groß genug zum Tippen', async ({ page }) => {
    await ansicht(page, { breite: 390, hoehe: 844 })
    const klein = await page.evaluate(() =>
      [...document.querySelectorAll('.bewerber-item button')]
        .map(b => ({ text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) }))
        .filter(b => b.h < 44))
    expect(klein).toEqual([])
  })

  test('nichts ragt über den Rand', async ({ page }) => {
    await ansicht(page, { breite: 390, hoehe: 844 })
    const seitlich = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(seitlich).toBeLessThanOrEqual(0)
  })
})

test.describe('die Regel für <section> in den Arbeitsbereichen', () => {
  test('auch die Reiter im Betreiber-Bereich haben keinen Startseiten-Abstand', async ({ page }) => {
    const { ADMIN, warteAufAdmin } = require('./helpers/supabase-fake')
    await setupDashboard(page.context(), {
      user: ADMIN,
      db: defaultDb({ profiles: [profilZeile(ADMIN, { ist_admin: true }), profilZeile(SCHUELER), profilZeile(FIRMA)] }),
    })
    await page.goto('/admin.html')
    await warteAufAdmin(page)
    const oben = await page.evaluate(() => getComputedStyle(document.querySelector('.admin-panel.active')).paddingTop)
    expect(oben).toBe('0px')
  })

  test('eine Klasse mit eigenem Innenabstand behält ihn', async ({ page }) => {
    // Genau dafür steht die neue Regel in `:where(...)`: ohne Gewicht.
    // Die Job-Alarm-Karte des Schülers ist ein <section> mit eigenem
    // Abstand – den darf die Aufräum-Regel nicht platt machen.
    await setupDashboard(page.context(), { user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    const innen = await page.evaluate(() => {
      const k = document.getElementById('alarm-karte')
      k.hidden = false
      return getComputedStyle(k).paddingTop
    })
    expect(innen).toBe('20px')
  })
})
