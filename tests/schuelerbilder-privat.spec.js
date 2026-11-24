// Schülerbilder privat (24.11.2026)
//
// Befund: Profilfotos und Lebenslauf-Bilder lagen in öffentlichen
// Ablagen - wer die Adresse kannte, sah das Foto eines Minderjährigen
// ohne Anmeldung. Jetzt steht in der Datenbank ein Verweis, und erst beim
// Anzeigen wird eine signierte Adresse geholt (js/bilder.js).
const fs = require('fs')
const path = require('path')
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA } = require('./helpers/supabase-fake')

const JS = path.join(__dirname, '..', 'js')
const VERWEIS = `speicher:profilfotos/${SCHUELER.id}/avatar.jpg?v=1764000000000`

async function modul(page, fn, arg) {
  await setupDashboard(page.context(), {})
  await page.goto('/jobs.html')
  return page.evaluate(async ([quelle, a]) => {
    const m = await import('/js/bilder.js')
    return (0, eval)(quelle)(m, a)
  }, [fn.toString(), arg])
}

test.describe('der Verweis', () => {
  test('wird gebaut und wieder zerlegt', async ({ page }) => {
    const r = await modul(page, m => {
      const v = m.speicherVerweis('profilfotos', 'u1/avatar.png', 5)
      return [v, m.zerlegeVerweis(v), m.pfadAusVerweis(v, 'profilfotos'), m.pfadAusVerweis(v, 'lebenslauf-bilder')]
    })
    expect(r[0]).toBe('speicher:profilfotos/u1/avatar.png?v=5')
    expect(r[1]).toEqual({ ablage: 'profilfotos', pfad: 'u1/avatar.png' })
    expect(r[2]).toBe('u1/avatar.png')
    expect(r[3]).toBeNull()
  })

  test('nur private Bildablagen, kein Pfad nach oben', async ({ page }) => {
    const r = await modul(page, m => [
      'speicher:avatars/u1/a.png', 'speicher:verifizierung/u1/a.png', 'speicher:profilfotos/../x.png',
      'speicher:profilfotos//a.png', 'speicher:profilfotos', 'https://x.de/a.png', null,
    ].map(v => m.zerlegeVerweis(v)))
    expect(r).toEqual([null, null, null, null, null, null, null])
  })

  test('alte https-Adressen (Firmenlogos) gehen unverändert durch', async ({ page }) => {
    const url = 'https://blufrvuskqiloslyxjkx.supabase.co/storage/v1/object/public/avatars/f1/avatar.png'
    const r = await modul(page, (m, u) => [m.anzeigeUrl(u), m.anzeigeUrl('javascript:alert(1)')], url)
    expect(r).toEqual([url, ''])
  })
})

test('der Firma erscheint das Foto über eine signierte Adresse', async ({ page }) => {
  const db = defaultDb({ profiles: [profilZeile(FIRMA), profilZeile(SCHUELER, { verifiziert: true, foto_url: VERWEIS })] })
  db.jobs = [{ id: 'j1', firma_id: FIRMA.id, titel: 'Eisverkauf', ort: 'München', lat: 48.1, lon: 11.5, mindestalter: 14, aktiv: true, aufrufe: 1,
    erstellt_am: '2026-11-20T10:00:00Z', beschreibung: 'x' }]
  db.bewerbungen = [{ id: 'b1', job_id: 'j1', schueler_id: SCHUELER.id, status: 'ausstehend', erstellt_am: '2026-11-21T10:00:00Z' }]
  const signiert = []
  page.on('request', r => { if (r.url().includes('/storage/v1/object/sign/')) signiert.push(r.url()) })
  await setupDashboard(page.context(), { db, user: FIRMA })
  await page.goto('/dashboard-firma.html?ansicht=bewerbungen')
  const foto = page.locator('.bewerber-item .bew-foto')
  await expect(foto).toHaveAttribute('style', /mock-signed-url/, { timeout: 20_000 })
  expect(signiert.some(u => u.includes('/sign/profilfotos/'))).toBe(true)
  // Kein Verweis-Text und keine öffentliche Adresse im Bild
  await expect(foto).not.toHaveAttribute('style', /speicher:|object\/public/)
})

test('der Schüler lädt sein Foto in die private Ablage', async ({ page }) => {
  const db = await setupDashboard(page.context(), { user: SCHUELER })
  const hoch = []
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/storage/v1/object/')) hoch.push(r.url()) })
  // Das Foto laedt man im Lebenslauf-Editor hoch (Schritt 1, "Persoenliches").
  await page.goto('/lebenslauf.html')
  await expect(page.locator('#ll-schritt-name')).not.toBeEmpty({ timeout: 30_000 })
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
  await page.locator('#ll-foto').setInputFiles({ name: 'ich.png', mimeType: 'image/png', buffer: png })
  await expect.poll(() => db.profiles.find(p => p.id === SCHUELER.id).foto_url, { timeout: 20_000 })
    .toMatch(/^speicher:profilfotos\/user-schueler-[^/]+\/avatar\.png\?v=\d+$/)
  expect(hoch.some(u => u.includes('/object/profilfotos/'))).toBe(true)
  expect(hoch.some(u => u.includes('/object/avatars/'))).toBe(false)
})

test('im Code holt niemand mehr eine öffentliche Adresse für Schülerbilder', async () => {
  const dateien = fs.readdirSync(JS).filter(f => f.endsWith('.js'))
  const funde = []
  for (const f of dateien) {
    const q = fs.readFileSync(path.join(JS, f), 'utf8')
    if (/from\('(profilfotos|lebenslauf-bilder)'\)\.getPublicUrl/.test(q)) funde.push(f)
    // In `avatars` laden nur noch Firmen hoch (ihr Logo).
    if (/from\('avatars'\)\s*\.upload\(/.test(q) && f !== 'dashboard-firma.js') funde.push(f + ' (avatars-Upload)')
  }
  expect(funde).toEqual([])
})
