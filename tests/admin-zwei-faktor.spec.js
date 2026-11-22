// Betreiber-Bereich nur mit zweitem Faktor (22.11.2026)
//
// Der Schutz sitzt in der Datenbank: ist_admin() verlangt aal2
// (supabase/admin-zwei-faktor.sql). Diese Tests halten fest, dass der
// Betreiber-Bereich den Admin dorthin fuehrt - einrichten, Code abfragen,
// falschen Code ablehnen - und dass die SQL-Datei die Bedingung wirklich
// enthaelt.
const fs = require('fs')
const path = require('path')
const { test, expect, setupDashboard, defaultDb, profilZeile, ADMIN, SCHUELER, warteAufAdmin } = require('./helpers/supabase-fake')

function adminDb() {
  return defaultDb({
    profiles: [
      profilZeile(ADMIN, { ist_admin: true }),
      profilZeile(SCHUELER, { verifiziert: false }),
    ],
  })
}

const VERIFIZIERT = { id: 'faktor-alt', friendly_name: 'SchülerMatch Betreiber', factor_type: 'totp', status: 'verified' }

async function oeffne(page, auth) {
  const db = await setupDashboard(page.context(), { db: adminDb(), user: ADMIN, auth })
  await page.goto('/admin.html')
  return db
}

test('mit zweitem Faktor geht es direkt in den Betreiber-Bereich', async ({ page }) => {
  await oeffne(page, { aal: 'aal2', factors: [VERIFIZIERT] })
  await warteAufAdmin(page)
  await expect(page.locator('#mfa-box')).toHaveCount(0)
  await expect(page.locator('#admin-tabs')).toBeVisible()
})

test('ohne Faktor: QR-Code zum Einrichten, Bereich verdeckt', async ({ page }) => {
  const db = await oeffne(page, { aal: 'aal1', factors: [] })
  const kasten = page.locator('#mfa-box')
  await expect(kasten).toBeVisible({ timeout: 20_000 })
  await expect(kasten.locator('h2')).toContainText('einrichten')
  await expect(page.locator('#mfa-qr')).toHaveAttribute('src', /^data:image\/svg\+xml/)
  await expect(page.locator('#mfa-geheimnis')).toHaveText('TESTGEHEIMNIS')
  await expect(page.locator('#admin-tabs')).toBeHidden()
  await expect(page.locator('#panel-schueler')).toBeHidden()
  // Die Seite bleibt benannt, auch wenn alles andere verdeckt ist.
  await expect(page.locator('h1')).toHaveCount(1)
  expect(db.__auth.aufrufe).toContain('enroll')
})

test('richtiger Code beim Einrichten oeffnet den Bereich', async ({ page }) => {
  const db = await oeffne(page, { aal: 'aal1', factors: [] })
  await page.locator('#mfa-code').fill('123456')
  await page.locator('#mfa-form button[type="submit"]').click()
  await expect(page.locator('#mfa-box')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.locator('#admin-tabs')).toBeVisible()
  await warteAufAdmin(page)
  expect(db.__auth.factors[0].status).toBe('verified')
})

test('halb eingerichteter Faktor aus einem Abbruch wird erst entfernt', async ({ page }) => {
  const halb = { id: 'faktor-halb', friendly_name: 'SchülerMatch Betreiber', factor_type: 'totp', status: 'unverified' }
  const db = await oeffne(page, { aal: 'aal1', factors: [halb] })
  await expect(page.locator('#mfa-qr')).toBeVisible({ timeout: 20_000 })
  const reihenfolge = db.__auth.aufrufe.filter(a => a.startsWith('unenroll') || a === 'enroll')
  expect(reihenfolge).toEqual(['unenroll:faktor-halb', 'enroll'])
})

test('Faktor eingerichtet: nur die Code-Abfrage, kein neuer QR-Code', async ({ page }) => {
  const db = await oeffne(page, { aal: 'aal1', factors: [VERIFIZIERT] })
  await expect(page.locator('#mfa-box h2')).toHaveText('Zweiter Schritt', { timeout: 20_000 })
  await expect(page.locator('#mfa-qr')).toHaveCount(0)
  expect(db.__auth.aufrufe).not.toContain('enroll')
  await page.locator('#mfa-code').fill('123456')
  await page.locator('#mfa-form button[type="submit"]').click()
  await expect(page.locator('#admin-tabs')).toBeVisible({ timeout: 20_000 })
  expect(db.__auth.aufrufe).toContain('verify:faktor-alt:123456')
})

test('falscher Code: Hinweis, Bereich bleibt zu', async ({ page }) => {
  await oeffne(page, { aal: 'aal1', factors: [VERIFIZIERT] })
  await page.locator('#mfa-code').fill('000000')
  await page.locator('#mfa-form button[type="submit"]').click()
  await expect(page.locator('#mfa-fehler')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('#mfa-fehler')).toContainText('stimmt nicht')
  await expect(page.locator('#admin-tabs')).toBeHidden()
})

test('weniger als sechs Ziffern gehen gar nicht erst raus', async ({ page }) => {
  const db = await oeffne(page, { aal: 'aal1', factors: [VERIFIZIERT] })
  await page.locator('#mfa-code').fill('12a')
  await page.locator('#mfa-form button[type="submit"]').click()
  await expect(page.locator('#mfa-fehler')).toContainText('sechs Ziffern')
  expect(db.__auth.aufrufe.some(a => a.startsWith('verify'))).toBe(false)
})

test('die Datenbank verlangt den zweiten Faktor wirklich', async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'admin-zwei-faktor.sql'), 'utf8')
  const code = sql.split(/\r?\n/).filter(z => !z.trim().startsWith('--')).join('\n')
  expect(code).toContain('create or replace function public.ist_admin()')
  expect(code).toMatch(/auth\.jwt\(\)\s*->>\s*'aal'/)
  expect(code).toMatch(/=\s*'aal2'/)
  // Die alte Bedingung bleibt: Admin ist nur, wer im Profil Admin ist.
  expect(code).toMatch(/select ist_admin from public\.profiles where id = auth\.uid\(\)/)
})
