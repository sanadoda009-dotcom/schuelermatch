// Tippziele auf dem Handy (läuft im Projekt "mobil" = Pixel 7 mit
// echter Touch-Emulation).
//
// Anlass (Messung am 24.8.): Apple und Google empfehlen mindestens
// 44x44 Pixel für alles, was man mit dem Finger trifft. Gemessen wurde:
// der "Anzeigen"-Knopf am Passwortfeld war 15px hoch, das Hamburger-Menü
// 38x32, der Herz-Knopf auf den Job-Karten 36x36. Eine frühere Runde
// hatte das nur für den Lebenslauf-Editor gelöst – der Rest der Seite
// war ungedeckt.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, ADMIN, warteAufDashboard, warteAufAdmin } = require('./helpers/supabase-fake')

const PRUEFUNG = `(() => {
  const sichtbar = el => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
  }
  const nenne = el => el.tagName.toLowerCase() + (el.id ? '#'+el.id : '')
    + (typeof el.className === 'string' && el.className.trim() ? '.'+el.className.trim().split(/\\s+/)[0] : '')

  const zuKlein = []
  const gesehen = new Set()
  document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], summary').forEach(el => {
    if (!sichtbar(el)) return

    // --- Bewusste Ausnahmen ---
    // Links mitten im Fließtext sind naturgemäß nur zeilenhoch.
    if (el.tagName === 'A' && el.closest('p, li')) return
    // Checkboxen in einem <label>: Trefferfläche ist der ganze Text,
    // nicht das kleine Kästchen.
    if (el.type === 'checkbox' && el.closest('label')) return
    // Der Jobtitel im Dashboard ist ein Knopf, damit die Karte per
    // Tastatur erreichbar ist – angetippt wird die ganze Karte.
    if (el.classList.contains('job-titel-btn')) return

    const r = el.getBoundingClientRect()
    const name = nenne(el)
    if (gesehen.has(name)) return
    if (r.height < 44 || r.width < 44) {
      gesehen.add(name)
      zuKlein.push(name + ' ist nur ' + Math.round(r.width) + 'x' + Math.round(r.height))
    }
  })
  return zuKlein
})()`

for (const [name, pfad] of [
  ['Startseite', '/index.html'],
  ['Jobbörse', '/jobs.html'],
  ['Job-Detail', '/job.html?id=aaaaaaaa-0000-4000-8000-000000000001'],
  ['Login', '/login.html'],
  ['Registrierung', '/register.html'],
  ['Jugendarbeitsschutz', '/jugendarbeitsschutz.html'],
  ['Jobideen', '/jobideen.html'],
  ['Job-Finder', '/job-finder.html'],
]) {
  test(`Tippziele groß genug: ${name}`, async ({ page }) => {
    await setupDashboard(page.context(), {})
    await page.goto(pfad)
    await page.waitForTimeout(1500)
    expect(await page.evaluate(PRUEFUNG)).toEqual([])
  })
}

test('Tippziele groß genug: Schüler-Dashboard', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER,
    db: defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] }) })
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
  await page.waitForTimeout(800)
  expect(await page.evaluate(PRUEFUNG)).toEqual([])
})

test('Tippziele groß genug: Firmen-Dashboard', async ({ page }) => {
  await setupDashboard(page.context(), { user: FIRMA,
    db: defaultDb({ profiles: [profilZeile(FIRMA)] }) })
  await page.goto('/dashboard-firma.html')
  await warteAufDashboard(page)
  await page.waitForTimeout(800)
  expect(await page.evaluate(PRUEFUNG)).toEqual([])
})

test('Logo und Knopf in der Kopfzeile kleben nicht aneinander', async ({ page }) => {
  // Auf dem Handy standen sie ohne jeden Abstand direkt nebeneinander.
  await setupDashboard(page.context(), {})
  await page.goto('/login.html')
  await page.waitForTimeout(1000)
  const abstand = await page.evaluate(() => {
    const logo = document.querySelector('nav .logo')?.getBoundingClientRect()
    const knopf = document.querySelector('nav .btn')?.getBoundingClientRect()
    if (!logo || !knopf) return 99
    return Math.round(knopf.left - logo.right)
  })
  expect(abstand, 'Abstand zwischen Logo und Knopf').toBeGreaterThanOrEqual(8)
})

test('keine Seite scrollt seitlich', async ({ page }) => {
  await setupDashboard(page.context(), {})
  for (const pfad of ['/index.html', '/jobs.html', '/register.html']) {
    await page.goto(pfad)
    await page.waitForTimeout(1200)
    const scrollt = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
    expect(scrollt, `${pfad} scrollt waagerecht`).toBe(false)
  }
})

// Der Betreiber-Bereich wurde bei sechs Runden Qualitaetsarbeit uebersehen -
// er stand in keiner einzigen dieser Pruefungen. Deshalb hier ausdruecklich
// mit dabei.
test('Tippziele gross genug: Admin-Bereich', async ({ page }) => {
  await setupDashboard(page.context(), { user: ADMIN, db: defaultDb({
    profiles: [profilZeile(ADMIN, { ist_admin: true }), profilZeile(SCHUELER), profilZeile(FIRMA)] }) })
  await page.goto('/admin.html')
  await warteAufAdmin(page)
  await page.waitForTimeout(800)
  expect(await page.evaluate(PRUEFUNG)).toEqual([])
})
