// Nach der Verifizierung ist das Alter fest (20.10.2026).
//
// ANLASS: Bei der Verifizierung prueft der Betreiber den Ausweis - auch
// das Alter. Danach war `alter_jahre` wieder frei aenderbar: Das Formular
// bot 13 bis 20 an, der Schutz-Trigger fror die Spalte nicht ein. Und
// seit dem 20.10. entscheidet genau diese Zahl in der Datenbank, worauf
// sich jemand bewerben darf. Ein verifizierter 14-Jaehriger konnte sich
// auf 18 setzen - mit dem Haken "verifiziert" daneben.
//
// Die Datenbank friert das Alter jetzt ein
// (supabase/alter-nach-verifizierung-fest.sql). Dieser Test haelt die
// Oberflaeche dazu: Das Feld ist gesperrt, sagt warum, und das Alter
// wird gar nicht erst mitgeschickt. Sonst saehe der Schueler "gespeichert"
// und beim naechsten Laden wieder die alte Zahl.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER } =
  require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

async function profilOeffnen(page, extra) {
  const db = defaultDb({ profiles: [profilZeile(SCHUELER, { alter_jahre: 14, ort: 'München', ...extra })] })
  await setupDashboard(page.context(), { user: SCHUELER, db })
  const patches = []
  page.on('request', req => {
    if (req.method() === 'PATCH' && req.url().includes('/rest/v1/profiles')) patches.push(req.postData() || '')
  })
  await page.goto('/dashboard-schueler.html?ansicht=profil')
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
  await expect(page.locator('#profile-form')).toBeVisible({ timeout: 20_000 })
  return patches
}

test('verifiziert: Alter gesperrt, mit Begründung', async ({ page }) => {
  await profilOeffnen(page, { verifiziert: true })
  await expect(page.locator('#profile-alter')).toBeDisabled()
  await expect(page.locator('#profile-alter')).toHaveValue('14')
  const hinweis = page.locator('#alter-fest-hinweis')
  await expect(hinweis).toBeVisible()
  await expect(hinweis).toContainText('Verifizierung')
  await expect(hinweis.locator('a[href="impressum.html"]')).toBeVisible()
})

test('verifiziert: Speichern schickt kein Alter mit', async ({ page }) => {
  const patches = await profilOeffnen(page, { verifiziert: true })
  await page.locator('#profile-name').fill('Neuer Name')
  await page.locator('#profile-form button[type=submit]').click()
  await expect.poll(() => patches.length, { timeout: 15_000 }).toBeGreaterThan(0)
  const rumpf = JSON.parse(patches[patches.length - 1])
  expect(rumpf.name).toBe('Neuer Name')
  expect(rumpf).not.toHaveProperty('alter_jahre')
})

test('noch nicht verifiziert: Alter bleibt änderbar', async ({ page }) => {
  // Tippfehler bei der Registrierung muessen korrigierbar bleiben.
  const patches = await profilOeffnen(page, { verifiziert: false })
  await expect(page.locator('#profile-alter')).toBeEnabled()
  await expect(page.locator('#alter-fest-hinweis')).toBeHidden()
  await page.locator('#profile-alter').selectOption('15')
  await page.locator('#profile-form button[type=submit]').click()
  await expect.poll(() => patches.length, { timeout: 15_000 }).toBeGreaterThan(0)
  expect(JSON.parse(patches[patches.length - 1]).alter_jahre).toBe(15)
})

test('die Datenbank friert das Alter erst NACH der Verifizierung ein', async () => {
  // Nur ausfuehrbarer Code - die Kommentare nennen dieselben Zeilen.
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'alter-nach-verifizierung-fest.sql'), 'utf8')
    .split(/\r?\n/).filter(z => !z.trim().startsWith('--')).join('\n')
  expect(sql).toMatch(/if old\.verifiziert is true then\s+new\.alter_jahre\s*:=\s*old\.alter_jahre/)
  // Die Zeilen der Vorgaenger-Fassung muessen alle noch da sein.
  for (const s of ['ist_admin', 'verifiziert', 'firma_status', 'role', 'email']) {
    expect(sql, `${s} ist nicht mehr eingefroren`).toMatch(new RegExp(`new\\.${s}\\s*:=\\s*old\\.${s}`))
  }
  expect(sql).toMatch(/split_part\(new\.schuelerausweis_url, '\/', 1\) <> new\.id::text/)
})
