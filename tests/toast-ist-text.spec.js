// Eine Meldung ist Text, kein HTML (11.9.2026).
//
// DER BEFUND — und diesmal eine echte Lücke, keine Unschönheit:
// `js/toast.js` baute seine Meldung mit `innerHTML` und dem übergebenen
// Text mittendrin. In `js/dashboard-schueler.js` geht in zwei Meldungen
// der **Titel einer Anzeige** ein („… ist ab 18 Jahren ausgeschrieben"),
// und den Titel schreibt die Firma.
//
// Gemessen mit dem Titel `Aushilfe <img src=x onerror="window.__xss=1">`:
// `window.__xss` stand danach auf 1 — fremder Code lief im angemeldeten
// Schülerkonto, in dem die Sitzung liegt. Der Weg dahin ist ein Klick:
// der geteilte Link `dashboard-schueler.html?job=…`, der genau diese
// Meldung auslöst, wenn die Anzeige nicht in die eigene Liste passt.
// Die Inhaltsregeln der Seite halten das nicht auf — `script-src` erlaubt
// `'unsafe-inline'`, und `onerror` ist genau das.
//
// Nachgesehen, bevor umgestellt wurde: Keine der 93 Aufrufstellen
// übergibt HTML. Und die übrigen Stellen im Projekt, an denen fremder
// Text in `innerHTML` landet, gehen alle durch `escapeHtml` — 28
// Kandidaten geprüft, der Toast war der einzige Fund.

const { test, expect, setupDashboard, warteAufDashboard, SCHUELER, FIRMA, defaultDb } = require('./helpers/supabase-fake')

const BOESE = 'Aushilfe <img src=x onerror="window.__xss=1">'

function db({ mindestalter = 18, alter = 14 } = {}) {
  const d = defaultDb()
  d.jobs = [{
    id: 'x-1', firma_id: FIRMA.id, firma_name: FIRMA.name, titel: BOESE,
    beschreibung: 'Test.', ort: 'München', stundenlohn: 13, mindestalter,
    kategorie: 'Gastronomie', arbeitszeit: 'Wochenende', aktiv: true, aufrufe: 1,
    erstellt_am: '2026-09-01T10:00:00Z', lat: 48.137, lon: 11.575, verfuegbarkeit: null,
  }]
  d.profiles = d.profiles.map(p => p.id === SCHUELER.id
    ? { ...p, alter_jahre: alter, verifiziert: true, lat: 48.137, lon: 11.575 } : p)
  return d
}

async function befund(page) {
  return page.evaluate(() => ({
    xss: window.__xss === 1,
    fremdeElemente: document.querySelectorAll('.toast img, .toast script, .toast b').length,
    text: (document.querySelector('.toast') || {}).textContent || '',
  }))
}

test('ein Anzeigentitel mit HTML darin führt keinen Code aus', async ({ page }) => {
  // Der gemessene Fall: zu jung für die geteilte Anzeige.
  await setupDashboard(page.context(), { db: db(), user: SCHUELER })
  await page.goto('/dashboard-schueler.html?job=x-1')
  await warteAufDashboard(page)
  await expect(page.locator('.toast, #toast')).toBeVisible({ timeout: 20_000 })

  const b = await befund(page)
  expect(b.xss, 'fremder Code lief im Schülerkonto').toBe(false)
  expect(b.fremdeElemente, 'aus dem Titel ist ein Element geworden').toBe(0)
  // Und der Titel steht trotzdem da — als das, was er ist: Text.
  expect(b.text).toContain('<img src=x')
})

test('auch auf dem zweiten Weg, der den Titel meldet', async ({ page }) => {
  // Es gibt zwei Meldungen mit dem Titel darin. Die zweite („passt
  // gerade nicht zu deinen Filtern") trifft, wer noch kein Alter im
  // Profil stehen hat: Die Liste zeigt ihm dann nur die untere
  // Altersstufe, die geteilte Anzeige fehlt darin — und ohne bekanntes
  // Alter greift der Satz über das Jugendarbeitsschutzgesetz nicht.
  //
  // Erste Fassung dieses Tests rief eine Id auf, die es gar nicht gab.
  // Dann kommt „Diese Anzeige gibt es nicht mehr" — ohne Titel, und der
  // Test lief grün, ohne irgendetwas zu prüfen.
  await setupDashboard(page.context(), { db: db({ mindestalter: 18, alter: null }), user: SCHUELER })
  await page.goto('/dashboard-schueler.html?job=x-1')
  await warteAufDashboard(page)
  await expect(page.locator('.toast, #toast')).toBeVisible({ timeout: 20_000 })

  const b = await befund(page)
  expect(b.text, 'diese Meldung nennt den Titel gar nicht — dann prüft der Test nichts')
    .toContain('<img src=x')
  expect(b.xss).toBe(false)
  expect(b.fremdeElemente).toBe(0)
})

test.describe('die Meldung selbst', () => {
  test('macht aus Auszeichnung nie ein Element', async ({ page }) => {
    // Der Wächter, und bewusst über das Verhalten statt über den
    // Quelltext: Wer toast.js umbaut, darf das gern — nur HTML darf
    // dabei nicht wieder ausgeführt werden.
    await setupDashboard(page.context(), { db: defaultDb(), user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)

    await page.evaluate(() => window.toast('<b>fett</b> und <img src=x onerror="window.__xss2=1">'))
    await expect(page.locator('.toast').last()).toBeVisible()

    const b = await page.evaluate(() => ({
      xss: window.__xss2 === 1,
      fremde: document.querySelectorAll('.toast b, .toast img').length,
      text: document.querySelector('.toast').textContent,
    }))
    expect(b.xss).toBe(false)
    expect(b.fremde).toBe(0)
    expect(b.text).toContain('<b>fett</b>')
  })

  test('und behält ihr Zeichen vorne', async ({ page }) => {
    // Beim Umstellen leicht zu verlieren: Das ✓ bzw. ✕ ist das Einzige,
    // was Erfolg und Fehler auf einen Blick unterscheidet.
    await setupDashboard(page.context(), { db: defaultDb(), user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)

    await page.evaluate(() => window.toast('Gespeichert.'))
    await expect(page.locator('.toast .toast-icon').last()).toHaveText('✓')

    await page.evaluate(() => window.toast('Ging nicht.', 'fehler'))
    await expect(page.locator('.toast .toast-icon').last()).toHaveText('✕')
  })
})
