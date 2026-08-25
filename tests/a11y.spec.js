// Barrierefreiheit: Beschriftungen, Überschriften-Struktur, Landmarks.
// Prüft, was Screenreader-Nutzer wirklich braucht – und hält es dauerhaft:
// Jedes Eingabefeld braucht einen Namen, jede Seite genau eine h1,
// Überschriften dürfen keine Ebene überspringen.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, ADMIN, warteAufAdmin } = require('./helpers/supabase-fake')

const PRUEFUNG = `(() => {
  const f = []
  const nenne = el => el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + (typeof el.className==='string' && el.className.trim() ? '.'+el.className.trim().split(/\s+/)[0] : '')

  document.querySelectorAll('img').forEach(el => {
    if (!el.hasAttribute('alt')) f.push('Bild ohne Alternativtext: ' + nenne(el))
  })
  document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(el => {
    const hatLabel = (el.id && document.querySelector('label[for="'+el.id+'"]')) || el.closest('label')
    const hatAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
    if (!hatLabel && !hatAria) f.push('Feld ohne Beschriftung: ' + nenne(el) + ' (Platzhalter allein reicht nicht)')
  })
  document.querySelectorAll('button, a').forEach(el => {
    const name = (el.textContent||'').trim() || el.getAttribute('aria-label') || el.getAttribute('title')
      || (el.querySelector('img') && el.querySelector('img').alt)
    if (!name && el.getBoundingClientRect().width > 0) f.push('Bedienelement ohne Namen: ' + nenne(el))
  })
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => +h.tagName[1])
  const h1 = document.querySelectorAll('h1').length
  if (h1 === 0) f.push('Seite hat keine h1')
  if (h1 > 1) f.push('Seite hat ' + h1 + ' h1 (genau eine erwartet)')
  if (hs.length && hs[0] !== 1) f.push('Erste Überschrift ist h' + hs[0] + ' statt h1')
  for (let i=1;i<hs.length;i++) if (hs[i] - hs[i-1] > 1) { f.push('Überschriften-Sprung h'+hs[i-1]+' -> h'+hs[i]); break }
  if (!document.documentElement.lang) f.push('Kein lang-Attribut')
  if (!document.querySelector('main')) f.push('Kein <main>-Landmark')
  return f
})()`

const OEFFENTLICH = [
  '/index.html', '/jobs.html', '/login.html', '/register.html',
  '/job.html?id=aaaaaaaa-0000-4000-8000-000000000001',
  '/jugendarbeitsschutz.html', '/jobideen.html', '/job-finder.html', '/eltern.html', '/fuer-firmen.html', '/fairer-lohn.html', '/ferienjob.html', '/impressum.html', '/datenschutz.html',
  '/forgot-password.html', '/reset-password.html', '/404.html',
]

for (const pfad of OEFFENTLICH) {
  test(`barrierefrei: ${pfad}`, async ({ page }) => {
    await setupDashboard(page.context(), {})
    await page.goto(pfad)
    await page.waitForTimeout(800)
    expect(await page.evaluate(PRUEFUNG)).toEqual([])
  })
}

test.describe('eingeloggte Seiten', () => {
  const db = () => defaultDb({
    profiles: [profilZeile(SCHUELER, { verifiziert: true, schule: 'Gymnasium Nord', klasse: '10. Klasse',
      lebenslauf_bloecke: [
        { id: 'b1', typ: 'text', titel: 'Über mich', inhalt: 'Test' },
        { id: 'b2', typ: 'sprachen', titel: 'Sprachen', sprachen: [{ name: 'Deutsch', niveau: 'Muttersprache' }] },
        { id: 'b3', typ: 'skillbar', titel: 'Fähigkeiten', skills: [{ name: 'Teamarbeit', wert: 70 }] },
      ] }), profilZeile(FIRMA)],
  })

  test('barrierefrei: Schüler-Dashboard', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER, db: db() })
    await page.goto('/dashboard-schueler.html')
    await page.waitForTimeout(2500)
    expect(await page.evaluate(PRUEFUNG)).toEqual([])
  })

  test('barrierefrei: Lebenslauf-Editor', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER, db: db() })
    await page.goto('/lebenslauf.html')
    await page.waitForTimeout(2500)
    await page.evaluate(() => document.querySelectorAll('.ll-karte').forEach(d => { d.open = true }))
    await page.waitForTimeout(400)
    expect(await page.evaluate(PRUEFUNG)).toEqual([])
  })
})

// Der Betreiber-Bereich wurde bei sechs Runden Qualitaetsarbeit uebersehen -
// er stand in keiner einzigen dieser Pruefungen. Deshalb hier ausdruecklich
// mit dabei.
test('barrierefrei: Admin-Bereich', async ({ page }) => {
  await setupDashboard(page.context(), { user: ADMIN, db: defaultDb({
    profiles: [profilZeile(ADMIN, { ist_admin: true }), profilZeile(SCHUELER), profilZeile(FIRMA)] }) })
  await page.goto('/admin.html')
  await warteAufAdmin(page)
  await page.waitForTimeout(800)
  expect(await page.evaluate(PRUEFUNG)).toEqual([])
})
