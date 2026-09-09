// Wohin führt eine Benachrichtigung? (9.9.2026)
//
// DER BEFUND: Die Glocke sagte „Angenommen! Aushilfe Eistheke" — und der
// Klick führte auf das **Jobbrett**. Also auf eine Liste fremder
// Anzeigen, statt zu der Bewerbung, von der sie gerade erzählt hat.
//
// Dort stünden: die Zeitleiste, bei einer Absage der Grund, bei einer
// Zusage der Knopf zum Chat. Stattdessen musste der Schüler selbst
// weitersuchen — nach einer Nachricht, die für ihn die wichtigste der
// ganzen Seite ist.
//
// AUF DER FIRMENSEITE WAR ES MEIN EIGENER FEHLER. Bis zum 2.9. steckten
// die Bewerber in der Anzeigenliste; `ziel: 'jobs'` war damals richtig.
// Beim Aufteilen in „Meine Anzeigen" und „Bewerbungen" habe ich die
// Glocke nicht mitgezogen. Sie führte seitdem zu den Anzeigen statt zu
// der Bewerbung, die sie meldet.
//
// Die Lehre steht im Kommentar dort: Wer eine Ansicht teilt, muss fragen,
// wer sonst noch auf sie zeigt.

const { test, expect, setupDashboard, warteAufDashboard, SCHUELER, FIRMA, defaultDb } = require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')

const JOB = {
  id: 'j-1', firma_id: FIRMA.id, firma_name: FIRMA.name, titel: 'Aushilfe Eistheke',
  beschreibung: 'Eis verkaufen.', ort: 'München', stundenlohn: 13, mindestalter: 15,
  kategorie: 'Gastronomie', arbeitszeit: 'Wochenende', aktiv: true, aufrufe: 1,
  erstellt_am: '2026-09-01T10:00:00Z', lat: 48.137, lon: 11.575, verfuegbarkeit: null,
}

function db(status) {
  const d = defaultDb()
  d.jobs = [{ ...JOB }]
  d.bewerbungen = [{
    id: 'bw-1', job_id: 'j-1', schueler_id: SCHUELER.id, status,
    erstellt_am: '2026-09-02T10:00:00Z', motivationsschreiben: 'Hallo.',
  }]
  d.profiles = d.profiles.map(p => p.id === SCHUELER.id
    ? { ...p, alter_jahre: 17, verifiziert: true } : p)
  return d
}

async function glockeOeffnen(page, seite) {
  await page.goto(seite)
  await warteAufDashboard(page)
  await page.locator('#glocke-btn').click()
  await expect(page.locator('#glocke-dropdown')).toBeVisible({ timeout: 20_000 })
}

test.describe('beim Schüler', () => {
  for (const [status, wort] of [['angenommen', 'Angenommen'], ['abgelehnt', 'nicht geklappt']]) {
    test(`„${wort}" führt zu den Bewerbungen, nicht aufs Jobbrett`, async ({ page }) => {
      await setupDashboard(page.context(), { db: db(status), user: SCHUELER })
      await glockeOeffnen(page, '/dashboard-schueler.html')

      const eintrag = page.locator('#glocke-dropdown [data-ziel]', { hasText: wort })
      await expect(eintrag).toHaveCount(1)
      await eintrag.click()

      await expect(page.locator('.sidebar-item[data-view="bewerbungen"]'))
        .toHaveClass(/active/, { timeout: 20_000 })
    })
  }
})

test.describe('bei der Firma', () => {
  test('„Neue Bewerbung" führt zur Bewerbungsansicht', async ({ page }) => {
    // Die Ansicht gibt es seit dem 2.9. — die Glocke zeigte bis heute
    // weiter auf die Anzeigenliste.
    await setupDashboard(page.context(), { db: db('ausstehend'), user: FIRMA })
    await glockeOeffnen(page, '/dashboard-firma.html')

    const eintrag = page.locator('#glocke-dropdown [data-ziel]', { hasText: 'Bewerbung' }).first()
    await eintrag.click()
    await expect(page.locator('.sidebar-item[data-view="bewerbungen"]'))
      .toHaveClass(/active/, { timeout: 20_000 })
  })
})

test.describe('Wächter', () => {
  test('jedes Ziel der Glocke gibt es in beiden Dashboards', async () => {
    // Ein Ziel, das keine Ansicht ist, tut beim Klick schlicht nichts —
    // still, und deshalb schwer zu bemerken. Genau so wäre auch der Fund
    // dieser Runde entstanden, wenn ich die Ansicht umbenannt hätte
    // statt sie zu teilen.
    const quelle = fs.readFileSync(path.join(WURZEL, 'js', 'notifications.js'), 'utf8')
    const ziele = [...quelle.matchAll(/ziel:\s*'([a-z]+)'/g)].map(m => m[1])
    expect(ziele.length, 'keine Ziele gefunden? Dann prüft der Test nichts')
      .toBeGreaterThan(2)

    const ansichten = {}
    for (const seite of ['dashboard-schueler.html', 'dashboard-firma.html']) {
      const html = fs.readFileSync(path.join(WURZEL, seite), 'utf8')
      ansichten[seite] = new Set(
        [...html.matchAll(/data-view="([a-z]+)"/g)].map(m => m[1]))
    }

    // Jedes Ziel muss es mindestens in EINEM Dashboard geben. Nicht in
    // beiden: „nachrichten" hat nur der Schüler — bei der Firma sitzt der
    // Chat am jeweiligen Bewerber, also in „Bewerbungen". Genau diesen
    // Unterschied hat der Test in seiner ersten Fassung übersehen und
    // damit den zweiten Fehler dieser Runde gefunden: Für die Firma stand
    // dort „nachrichten", und der Klick tat nichts.
    for (const z of new Set(ziele)) {
      const irgendwo = Object.values(ansichten).some(s => s.has(z))
      expect(irgendwo, `kein Dashboard kennt die Ansicht "${z}"`).toBe(true)
    }

    // Und der rollenabhängige Fall ausdrücklich.
    expect(ansichten['dashboard-schueler.html'].has('nachrichten')).toBe(true)
    expect(ansichten['dashboard-firma.html'].has('nachrichten'),
      'die Firma hat keine Nachrichten-Ansicht - das Ziel muss dort ein anderes sein')
      .toBe(false)
    expect(quelle).toContain("rolle === 'schueler' ? 'nachrichten' : 'bewerbungen'")
  })

  test('beide Dashboards benutzen das übergebene Ziel', async () => {
    // Der dritte Fund dieser Runde, und der eigentliche Grund: Das
    // Firmen-Dashboard nahm den Parameter gar nicht erst entgegen und
    // klickte immer „jobs". Ein richtig gesetztes `ziel` half dann nichts.
    for (const datei of ['js/dashboard-schueler.js', 'js/dashboard-firma.js']) {
      const quelle = fs.readFileSync(path.join(WURZEL, datei), 'utf8')
      const stelle = quelle.slice(quelle.indexOf('initGlocke('))
      const zeile = stelle.slice(0, stelle.indexOf('})'))
      expect(zeile, `${datei} verwirft das Ziel und navigiert fest`)
        .toMatch(/onNavigate:\s*\(\s*ziel\s*\)/)
      expect(zeile).toContain('data-view="${ziel}"')
    }
  })
})
