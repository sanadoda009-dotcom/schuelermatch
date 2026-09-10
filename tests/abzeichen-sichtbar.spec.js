// Die rote Zahl, die sagt „hier wartet etwas" (11.9.2026).
//
// DER BEFUND: Im Betreiber-Bereich trägt der Reiter „Meldungen" ein
// Abzeichen mit der Zahl der offenen Meldungen — das einzige Zeichen
// dafür, dass jemand eine Anzeige oder eine Nachricht gemeldet hat.
//
// Die Gestaltung dafür hing an `.sidebar-item .sidebar-badge`, galt also
// nur in der Seitenleiste. Die Reiter im Betreiber-Bereich sind aber
// Knöpfe (`.admin-tab`). Gemessen mit einer offenen Meldung:
//
//   Hintergrund  rgba(0, 0, 0, 0)   — durchsichtig statt korallenrot
//   Farbe        rgb(90, 98, 112)   — das Grau des Reiters statt Weiß
//   Radius       0px                — keine Pille
//   Größe        8,5 × 17 px        — statt 20 × 20
//
// Die Zahl stand also da, sah aber nach einem Tippfehler hinter dem Wort
// aus und nicht nach einem Hinweis. Auf einer Seite für Minderjährige
// ist das ausgerechnet das Zeichen, das man nicht übersehen darf.
//
// Die Regel gilt jetzt für jedes `.sidebar-badge`; nur das
// „ganz nach rechts" bleibt der Seitenleiste vorbehalten.

const { test, expect, setupDashboard, defaultDb, profilZeile, warteAufDashboard, SCHUELER, FIRMA, ADMIN, warteAufAdmin } = require('./helpers/supabase-fake')

function adminDb(meldungen = []) {
  const db = defaultDb({
    profiles: [profilZeile(ADMIN, { ist_admin: true }), profilZeile(SCHUELER), profilZeile(FIRMA)],
  })
  db.meldungen = meldungen
  return db
}

const MELDUNG = {
  id: 'meld-1', melder_id: SCHUELER.id, gemeldet_user_id: FIRMA.id, typ: 'job',
  job_id: 'aaaaaaaa-0000-4000-8000-000000000001', grund: 'betrug',
  beschreibung: 'Verlangt Vorkasse per Überweisung.', zitat: 'Kaution vorab überweisen.',
  status: 'offen', erstellt_am: '2026-08-20T10:00:00Z',
}

// Sieht das Element aus wie ein Abzeichen — also wie ein farbiger Punkt
// mit einer Zahl darin?
async function abzeichen(page, id) {
  return page.evaluate(sel => {
    const b = document.getElementById(sel)
    const s = getComputedStyle(b)
    const k = b.getBoundingClientRect()
    return {
      text: b.textContent,
      hintergrund: s.backgroundColor,
      farbe: s.color,
      radius: parseFloat(s.borderRadius),
      breite: k.width, hoehe: k.height,
    }
  }, id)
}

function istPille(a) {
  return a.hintergrund !== 'rgba(0, 0, 0, 0)' && a.hintergrund !== 'transparent'
    && a.radius >= 8 && a.breite >= 18 && a.hoehe >= 18
}

test.describe('im Betreiber-Bereich', () => {
  test('eine offene Meldung trägt ein sichtbares Abzeichen am Reiter', async ({ page }) => {
    await setupDashboard(page.context(), { user: ADMIN, db: adminDb([MELDUNG]) })
    await page.goto('/admin.html')
    await warteAufAdmin(page)

    const a = await abzeichen(page, 'tab-badge-meldungen')
    expect(a.text, 'die Zahl selbst fehlt — dann prüft der Rest nichts').toBe('1')
    expect(istPille(a),
      `das Abzeichen sieht nicht nach einem Hinweis aus: ${JSON.stringify(a)}`).toBe(true)
    expect(a.farbe).toBe('rgb(255, 255, 255)')
  })

  test('ohne Meldung ist gar nichts zu sehen', async ({ page }) => {
    // Ein leerer roter Punkt wäre schlimmer als keiner: Er sagt „etwas
    // wartet", und dann wartet nichts.
    await setupDashboard(page.context(), { user: ADMIN, db: adminDb() })
    await page.goto('/admin.html')
    await warteAufAdmin(page)

    await expect(page.locator('#tab-badge-meldungen')).toBeHidden()
  })
})

test.describe('in der Seitenleiste bleibt es, wie es war', () => {
  test('auch dort eine Pille — und sie sitzt weiter ganz rechts', async ({ page }) => {
    // Geprüft wird die Gestaltung, nicht der Weg, auf dem die Zahl
    // hineinkommt: Die Zahl wird deshalb hier gesetzt. Dass sie im Betrieb
    // ankommt, prüfen die Tests zur Glocke und zu den Bewerbungen.
    await setupDashboard(page.context(), { db: defaultDb(), user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)

    await page.evaluate(() => { document.getElementById('badge-nachrichten').textContent = '3' })

    const a = await abzeichen(page, 'badge-nachrichten')
    expect(istPille(a), JSON.stringify(a)).toBe(true)

    // `margin-left: auto` gilt nur in der Seitenleiste — der Rand rechts
    // muss also schmal bleiben. Genau diese Zeile hätte man beim
    // Entzerren der Regel verlieren können.
    const rand = await page.evaluate(() => {
      const b = document.getElementById('badge-nachrichten')
      const eintrag = b.closest('.sidebar-item')
      return eintrag.getBoundingClientRect().right - b.getBoundingClientRect().right
    })
    expect(rand, 'das Abzeichen klebt nicht mehr am rechten Rand').toBeLessThan(24)
  })
})
