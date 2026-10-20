// Der Firmenname ist der geprüfte (20.10.2026).
//
// ANLASS: Bei der Freigabe prueft der Betreiber, dass ein echtes
// Unternehmen dahintersteckt - auch den Namen. Danach war er frei
// aenderbar, und auf die Anzeige konnte eine Firma ueber die API sogar
// JEDEN Namen schreiben (der Browser kopierte ihn nur). Die Datenbank
// friert den Namen jetzt ein und setzt ihn auf jede Anzeige selbst
// (supabase/firmenname-fest.sql). Dieser Test haelt die Oberflaeche
// dazu und die SQL-Datei vollstaendig.

const { test, expect, setupDashboard, defaultDb, profilZeile, FIRMA } =
  require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

async function profilOeffnen(page, extra) {
  const db = defaultDb({ profiles: [profilZeile(FIRMA, extra)] })
  await setupDashboard(page.context(), { user: FIRMA, db })
  const patches = []
  page.on('request', req => {
    if (req.method() === 'PATCH' && req.url().includes('/rest/v1/profiles')) patches.push(req.postData() || '')
  })
  await page.goto('/dashboard-firma.html?ansicht=profil')
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
  await expect(page.locator('#profile-form')).toBeVisible({ timeout: 20_000 })
  return patches
}

test('freigegeben: Name gesperrt, mit Begründung', async ({ page }) => {
  await profilOeffnen(page, { firma_status: 'freigegeben' })
  await expect(page.locator('#profile-name')).toBeDisabled()
  await expect(page.locator('#profile-name')).toHaveValue(FIRMA.name)
  const hinweis = page.locator('#name-fest-hinweis')
  await expect(hinweis).toBeVisible()
  await expect(hinweis).toContainText('Freigabe')
  await expect(hinweis.locator('a[href="impressum.html"]')).toBeVisible()
})

test('freigegeben: Speichern schickt keinen Namen mit', async ({ page }) => {
  const patches = await profilOeffnen(page, { firma_status: 'freigegeben' })
  await page.locator('#profile-ort').fill('Augsburg')
  await page.locator('#profile-form button[type=submit]').click()
  await expect.poll(() => patches.length, { timeout: 15_000 }).toBeGreaterThan(0)
  const rumpf = JSON.parse(patches[patches.length - 1])
  expect(rumpf.ort).toBe('Augsburg')
  expect(rumpf).not.toHaveProperty('name')
})

test('die SQL-Datei friert den Namen ein und setzt ihn auf jede Anzeige', async () => {
  // Nur ausfuehrbarer Code - die Kommentare nennen dieselben Zeilen.
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'firmenname-fest.sql'), 'utf8')
    .split(/\r?\n/).filter(z => !z.trim().startsWith('--')).join('\n')
  expect(sql).toMatch(/old\.firma_status = 'freigegeben' then\s+new\.name\s*:=\s*old\.name/)
  expect(sql).toMatch(/select p\.name into new\.firma_name from public\.profiles p where p\.id = new\.firma_id/)
  expect(sql).toMatch(/before insert or update on public\.jobs/)
  // Wer schuetze_profil_felder ersetzt, ersetzt sie ganz: Alle frueheren
  // Zeilen muessen noch da sein, sonst oeffnet die neue Fassung alte Luecken.
  for (const s of ['ist_admin', 'verifiziert', 'firma_status', 'role', 'email', 'alter_jahre']) {
    expect(sql, `${s} ist nicht mehr eingefroren`).toMatch(new RegExp(`new\\.${s}\\s*:=\\s*old\\.${s}`))
  }
  expect(sql).toMatch(/split_part\(new\.schuelerausweis_url, '\/', 1\) <> new\.id::text/)
})
