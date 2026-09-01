// Ein Schüler ohne Altersangabe (1.9.2026).
//
// ANLASS: Der Blick in die Datenbank – welche Spalten dürfen leer sein,
// obwohl der Browser sie verlangt? `profiles.alter_jahre` ist NULLABLE,
// und die CHECK-Regel `chk_alter_jahre` fängt das nicht ab: In SQL ist
// `NULL >= 13` weder wahr noch falsch, und eine CHECK-Regel gilt als
// erfüllt, solange sie nicht falsch ist. (Dieselbe Falle wie beim
// Mindestalter der Anzeigen, siehe mindestalter-fehlt.spec.js.)
//
// Im Schüler-Dashboard stand:
//
//     if (profile.alter_jahre) query = query.lte('mindestalter', ...)
//
// Fehlte das Alter, wurde der Filter also **ganz weggelassen**. Gemessen:
// Ein Schüler ohne Alter sah „Nachtschicht Lager ab 18". Und das ist kein
// erfundener Fall – von vier Schülerprofilen in der echten Datenbank hat
// eines kein Alter.
//
// Jetzt gilt ohne Angabe die Untergrenze der Plattform (13 Jahre) und der
// Schüler liest, warum die Liste kurz ist. Die Datenbankseite liegt als
// `supabase/alter-pflicht.sql` bereit.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER } =
  require('./helpers/supabase-fake')

const JOBS = [
  { id: 'j13', titel: 'Zeitungen austragen', beschreibung: 'x', ort: 'München',
    stundenlohn: 10, mindestalter: 13, kategorie: 'Lieferung & Kurier',
    arbeitszeit: 'Flexibel', aktiv: true, aufrufe: 1,
    erstellt_am: '2026-08-20T10:00:00Z', firma_id: 'f1', firma_name: 'A' },
  { id: 'j16', titel: 'Kellnern ab 16', beschreibung: 'x', ort: 'München',
    stundenlohn: 13, mindestalter: 16, kategorie: 'Gastronomie',
    arbeitszeit: 'Wochenende', aktiv: true, aufrufe: 1,
    erstellt_am: '2026-08-21T10:00:00Z', firma_id: 'f1', firma_name: 'A' },
  { id: 'j18', titel: 'Nachtschicht Lager ab 18', beschreibung: 'x', ort: 'München',
    stundenlohn: 15, mindestalter: 18, kategorie: 'Sonstiges',
    arbeitszeit: 'Abends', aktiv: true, aufrufe: 1,
    erstellt_am: '2026-08-22T10:00:00Z', firma_id: 'f1', firma_name: 'A' },
]

async function dashboard(page, alter) {
  const db = defaultDb({ jobs: JOBS, profiles: [profilZeile(SCHUELER, { alter_jahre: alter })] })
  await setupDashboard(page.context(), { user: SCHUELER, db })
  await page.goto('/dashboard-schueler.html')
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
  return db
}

function titel(page) {
  return page.locator('#jobs-grid .job-card h3, #jobs-grid .job-card h4')
    .evaluateAll(els => els.map(e => e.textContent.trim()))
}

test('ohne Altersangabe kommt keine Anzeige „ab 18" durch', async ({ page }) => {
  // Der Kern. Vorher: ["Nachtschicht Lager ab 18", "Zeitungen austragen"].
  await dashboard(page, null)
  await expect.poll(() => titel(page), { timeout: 20_000 }).toEqual(['Zeitungen austragen'])
})

test('ohne Altersangabe steht da, warum die Liste kurz ist', async ({ page }) => {
  // Eine stillschweigend gekürzte Liste sieht aus wie „es gibt nichts".
  await dashboard(page, null)
  const hinweis = page.locator('#alter-fehlt-hinweis')
  await expect(hinweis).toBeVisible({ timeout: 20_000 })
  await expect(hinweis).toContainText('fehlt dein Alter')
  await expect(hinweis).toContainText('13')
})

test('mit Alter bleibt alles wie vorher', async ({ page }) => {
  await dashboard(page, 16)
  await expect.poll(() => titel(page), { timeout: 20_000 })
    .toEqual(['Kellnern ab 16', 'Zeitungen austragen'])
  await expect(page.locator('#alter-fehlt-hinweis')).toBeHidden()
})

test('ein Vierzehnjähriger sieht nur, was er darf', async ({ page }) => {
  await dashboard(page, 14)
  await expect.poll(() => titel(page), { timeout: 20_000 }).toEqual(['Zeitungen austragen'])
})

test('der Altersfilter wird nirgends an eine Bedingung geknüpft', async () => {
  // Billiger Wächter für neuen Code. Das `if (profile.alter_jahre)` sah
  // harmlos aus – „filtern, wenn wir das Alter kennen" – und war doch die
  // Lücke. Wer es wieder einbaut, soll es merken.
  const fs = require('fs')
  const path = require('path')
  const datei = fs.readFileSync(path.join(__dirname, '..', 'js', 'dashboard-schueler.js'), 'utf8')

  const zeilen = datei.split(/\r?\n/)
  const treffer = zeilen
    .map((z, i) => ({ z, i }))
    .filter(({ z }) => /if \(\s*profile\.alter_jahre\s*\)/.test(z))
    .map(({ i }) => `js/dashboard-schueler.js:${i + 1}`)

  expect(treffer, 'Altersfilter hängt wieder an einer Bedingung').toEqual([])
  expect(datei, 'Der Filter muss immer laufen – notfalls mit der Untergrenze')
    .toContain("query.lte('mindestalter', profile.alter_jahre || MIN_ALTER)")
})
