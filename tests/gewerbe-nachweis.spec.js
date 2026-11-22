// Abzeichen "Gewerbe nachgewiesen" (22.11.2026)
//
// Firma laedt freiwillig einen Nachweis hoch -> Betreiber prueft ->
// Abzeichen auf Firmenseite und Anzeige. Der Schutz sitzt in der
// Datenbank (supabase/gewerbe-nachweis.sql): Das Abzeichen setzt nur ein
// Admin, und erst wenn der Nachweis geloescht ist. Diese Tests halten die
// Wege durch die Seite fest und dass die SQL-Datei das wirklich sagt.
const fs = require('fs')
const path = require('path')
const fake = require('./helpers/supabase-fake')
const { test, expect, setupDashboard, defaultDb, profilZeile, FIRMA, ADMIN, warteAufDashboard, warteAufAdmin } = fake

const PDF = { name: 'gewerbe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') }

async function firmenProfil(page, extra = {}) {
  const db = defaultDb({ profiles: [profilZeile(FIRMA, { firma_status: 'freigegeben', ...extra })] })
  await setupDashboard(page.context(), { db, user: FIRMA })
  await page.goto('/dashboard-firma.html')
  await warteAufDashboard(page)
  await page.click('#sidebar-toggle')
  await page.click('.sidebar-item[data-view="profil"]')
  return db
}

test.describe('Firmen-Dashboard', () => {
  test('ohne Nachweis: Erklaerung und Knopf, freiwillig', async ({ page }) => {
    await firmenProfil(page)
    const box = page.locator('#gewerbe-box')
    await expect(box).toContainText('Freiwillig')
    await expect(box).toContainText('Privatleute')
    await expect(page.locator('#gewerbe-btn')).toHaveText('Nachweis hochladen')
  })

  test('Hochladen legt den Pfad im eigenen Ordner ab und zeigt "wird geprueft"', async ({ page }) => {
    const db = await firmenProfil(page)
    const uploads = []
    page.on('request', r => { if (r.url().includes('/storage/v1/object/verifizierung/')) uploads.push(r.url()) })
    await page.locator('#gewerbe-datei').setInputFiles(PDF)
    await expect.poll(() => db.profiles[0].gewerbe_url, { timeout: 15_000 }).toBe(`${FIRMA.id}/gewerbe.pdf`)
    await expect(page.locator('#gewerbe-box')).toContainText('wird geprüft')
    expect(uploads.some(u => u.endsWith(`/verifizierung/${FIRMA.id}/gewerbe.pdf`))).toBe(true)
  })

  test('falscher Dateityp geht gar nicht erst raus', async ({ page }) => {
    const db = await firmenProfil(page)
    await page.locator('#gewerbe-datei').setInputFiles({ name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
    await expect(page.locator('.toast').last()).toContainText('PDF')
    expect(db.profiles[0].gewerbe_url ?? null).toBeNull()
  })

  test('mit Abzeichen: Bestaetigung, kein Upload mehr', async ({ page }) => {
    await firmenProfil(page, { gewerbe_geprueft: true })
    await expect(page.locator('#gewerbe-box')).toContainText('Gewerbe nachgewiesen')
    await expect(page.locator('#gewerbe-btn')).toHaveCount(0)
  })
})

test.describe('Betreiber-Bereich', () => {
  async function admin(page, firmaExtra) {
    const db = defaultDb({
      profiles: [
        profilZeile(ADMIN, { ist_admin: true }),
        profilZeile(FIRMA, { firma_status: 'freigegeben', ...firmaExtra }),
      ],
    })
    await setupDashboard(page.context(), { db, user: ADMIN })
    await page.goto('/admin.html')
    await warteAufAdmin(page)
    await page.locator('.admin-tab[data-tab="firmen"]').click()
    return db
  }

  test('wartender Nachweis: eigener Filter mit Zahl, Knoepfe an der Karte', async ({ page }) => {
    await admin(page, { gewerbe_url: `${FIRMA.id}/gewerbe.pdf` })
    await expect(page.locator('#badge-nachweis')).toHaveText('1')
    await page.locator('#firma-filter .pill[data-ff="nachweis"]').click()
    const karte = page.locator('#firma-liste .admin-karte')
    await expect(karte).toHaveCount(1)
    await expect(karte.locator('[data-dok]')).toContainText('Gewerbenachweis ansehen')
    await expect(karte.locator('[data-gewerbe-ok]')).toBeVisible()
  })

  test('bestaetigen: erst Datei weg, dann Abzeichen', async ({ page }) => {
    const db = await admin(page, { gewerbe_url: `${FIRMA.id}/gewerbe.pdf` })
    const loeschungen = []
    page.on('request', r => { if (r.method() === 'DELETE' && r.url().includes('/storage/v1/object/verifizierung')) loeschungen.push(r.postData()) })
    await page.locator('#firma-filter .pill[data-ff="nachweis"]').click()
    await page.locator('[data-gewerbe-ok]').click()
    const firma = () => db.profiles.find(p => p.id === FIRMA.id)
    await expect.poll(() => firma().gewerbe_geprueft, { timeout: 15_000 }).toBe(true)
    expect(firma().gewerbe_url).toBeNull()
    expect(loeschungen.join(' ')).toContain(`${FIRMA.id}/gewerbe.pdf`)
  })

  test('ablehnen braucht zwei Klicks und loescht den Nachweis', async ({ page }) => {
    const db = await admin(page, { gewerbe_url: `${FIRMA.id}/gewerbe.pdf` })
    await page.locator('#firma-filter .pill[data-ff="nachweis"]').click()
    const knopf = page.locator('[data-gewerbe-nein]')
    await knopf.click()
    await expect(knopf).toHaveText('Wirklich ablehnen?')
    const firma = () => db.profiles.find(p => p.id === FIRMA.id)
    expect(firma().gewerbe_url).toBe(`${FIRMA.id}/gewerbe.pdf`)
    await knopf.click()
    await expect.poll(() => firma().gewerbe_url, { timeout: 15_000 }).toBeNull()
    expect(firma().gewerbe_geprueft).toBeFalsy()
  })

  test('Abzeichen laesst sich wieder entziehen', async ({ page }) => {
    const db = await admin(page, { gewerbe_geprueft: true })
    await page.locator('#firma-filter .pill[data-ff="freigegeben"]').click()
    const knopf = page.locator('[data-gewerbe-weg]')
    await knopf.click()
    await knopf.click()
    await expect.poll(() => db.profiles.find(p => p.id === FIRMA.id).gewerbe_geprueft, { timeout: 15_000 }).toBe(false)
  })
})

test.describe('oeffentlich sichtbar', () => {
  const { test: basisTest } = require('./helpers/basis')
  const FIRMA_ID = 'ffffffff-0000-4000-8000-000000000009'
  const JOB = { id: 'gj1', titel: 'Aushilfe Laden', beschreibung: 'Regale.', ort: 'Köln', stundenlohn: 12,
    mindestalter: 15, kategorie: 'Verkauf', arbeitszeit: 'Samstags', verfuegbarkeit: null, aktiv: true,
    aufrufe: 0, erstellt_am: '2026-11-01T10:00:00Z', firma_id: FIRMA_ID, firma_name: 'Laden Kern',
    firma_logo_url: null, lat: null, lon: null }
  const kopf = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }

  async function routen(page, geprueft) {
    const profil = { id: FIRMA_ID, name: 'Laden Kern', ort: 'Köln', foto_url: null, ueber_mich: 'Ein Laden.',
      erstellt_am: '2026-03-04T10:00:00Z', gewerbe_geprueft: geprueft }
    const einzeln = r => (r.request().headers()['accept'] || '').includes('vnd.pgrst.object')
    await page.route('**/rest/v1/jobs*', r => r.fulfill({ status: 200, headers: kopf, body: JSON.stringify(einzeln(r) ? JOB : [JOB]) }))
    await page.route('**/rest/v1/bewertungen*', r => r.fulfill({ status: 200, headers: kopf, body: '[]' }))
    await page.route('**/rest/v1/firmen_oeffentlich*', r => r.fulfill({ status: 200, headers: kopf, body: JSON.stringify(einzeln(r) ? profil : [profil]) }))
  }

  basisTest('Firmenseite zeigt das Abzeichen nur, wenn es vergeben ist', async ({ page }) => {
    await routen(page, true)
    await page.goto(`/firma.html?id=${FIRMA_ID}`)
    await expect(page.locator('.firma-marken')).toContainText('Gewerbe nachgewiesen', { timeout: 20_000 })
    await routen(page, false)
    await page.reload()
    await expect(page.locator('.firma-marken')).toContainText('geprüft', { timeout: 20_000 })
    await expect(page.locator('.firma-marken')).not.toContainText('Gewerbe nachgewiesen')
  })

  basisTest('Anzeige zeigt das Abzeichen neben dem Firmennamen', async ({ page }) => {
    await routen(page, true)
    await page.goto('/job.html?id=gj1')
    await expect(page.locator('.job-firma')).toContainText('Gewerbe nachgewiesen', { timeout: 20_000 })
  })

  basisTest('ohne Abzeichen steht neben dem Namen nichts', async ({ page }) => {
    await routen(page, false)
    await page.goto('/job.html?id=gj1')
    await expect(page.locator('.job-firma')).toContainText('Laden Kern', { timeout: 20_000 })
    await expect(page.locator('.job-firma')).not.toContainText('Gewerbe')
  })
})

test('die Datenbank vergibt das Abzeichen nur ueber den Admin und ohne liegenden Nachweis', async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'gewerbe-nachweis.sql'), 'utf8')
  const code = sql.split(/\r?\n/).filter(z => !z.trim().startsWith('--')).join('\n')
  expect(code).toMatch(/new\.gewerbe_geprueft\s*:=\s*old\.gewerbe_geprueft/)
  expect(code).toMatch(/split_part\(new\.gewerbe_url, '\/', 1\) <> new\.id::text/)
  // Die alten Schutzzeilen sind beim Ersetzen nicht verloren gegangen.
  for (const s of ['ist_admin', 'verifiziert', 'firma_status', 'role', 'email']) {
    expect(code, `${s} nicht mehr eingefroren`).toMatch(new RegExp(`new\\.${s}\\s*:=\\s*old\\.${s}`))
  }
  expect(code).toContain("name like new.id::text || '/gewerbe.%'")
  // Die Sicht bleibt ohne E-Mail.
  const sicht = code.slice(code.indexOf('create or replace view public.firmen_oeffentlich'))
  expect(sicht).toContain('p.gewerbe_geprueft')
  expect(sicht.slice(0, sicht.indexOf(';'))).not.toContain('email')
})
