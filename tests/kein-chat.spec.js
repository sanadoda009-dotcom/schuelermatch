// Es gibt keinen Chat mehr (22.11.2026).
//
// Sanads Entscheidung: Ein Kanal, in dem ein Erwachsener einem Kind frei
// formuliert schreibt, kann zu Skandalen fuehren - auch mit Warnhinweisen
// und Meldeknopf. SchuelerMatch macht es jetzt wie die grossen Jobboersen:
// Nach einer Zusage meldet sich die Firma per Telefon oder E-Mail.
//
// Dieser Test haelt fest, dass der Chat nicht durch die Hintertuer
// zurueckkommt - weder in der Oberflaeche noch in einem Versprechen auf
// einer Seite noch in der Datenbank-Datei - und dass der neue Weg
// (Telefon beim Bewerben, Kontakt an der Bewerbung) funktioniert.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA } =
  require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = p => fs.readFileSync(path.join(WURZEL, p), 'utf8')
const ohneKommentare = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('kein Chat-Modul und keine Chat-Ansicht mehr', async () => {
  expect(fs.existsSync(path.join(WURZEL, 'js', 'chat.js')), 'js/chat.js ist zurueck').toBe(false)
  for (const datei of ['dashboard-schueler.html', 'dashboard-firma.html']) {
    const html = ohneKommentare(lies(datei))
    expect(html, `${datei}: Chat-Ansicht`).not.toMatch(/data-view="nachrichten"|id="chat-|view-nachrichten/)
  }
  for (const datei of ['js/dashboard-schueler.js', 'js/dashboard-firma.js', 'js/notifications.js']) {
    const js = ohneKommentare(lies(datei))
    expect(js, `${datei}: liest oder schreibt nachrichten`).not.toMatch(/from\('nachrichten'\)|ladeChat|chat\.js/)
  }
})

test('keine öffentliche Seite verspricht einen Chat', async () => {
  const seiten = fs.readdirSync(WURZEL).filter(d => d.endsWith('.html') && !/^(test-|design-vorschau)/.test(d))
  for (const s of seiten) {
    const text = ohneKommentare(lies(s)).replace(/<[^>]+>/g, ' ')
    // "Einen Chat ... gibt es nicht" ist erlaubt - es geht um Zusagen.
    const treffer = text.match(/[^.]*\bChat\b[^.]*\./g) || []
    for (const satz of treffer) {
      expect(/nicht|kein|vor dem 22\.11\.2026/i.test(satz), `${s}: „${satz.trim().slice(0, 120)}"`).toBe(true)
    }
  }
})

test('die Datenbank-Datei schliesst den Chat und loescht die Nachrichten', async () => {
  const sql = lies('supabase/chat-abschaffen.sql').split(/\r?\n/).filter(z => !z.trim().startsWith('--')).join('\n')
  expect(sql).toMatch(/delete from public\.nachrichten;/)
  for (const regel of ['Nachricht senden', 'Nachrichten lesen', 'Nachricht als gelesen markieren']) {
    expect(sql).toContain(`drop policy if exists "${regel}" on public.nachrichten;`)
  }
  expect(sql).not.toMatch(/create policy[^;]*on public\.nachrichten/i)
  expect(sql).toMatch(/new\.telefon\s*:=\s*old\.telefon/)
})

test('die Zusage-Mail schickt nicht mehr in einen Chat', async () => {
  const mail = lies('supabase/functions/mail-ereignis/index.ts')
  expect(mail).not.toMatch(/Zum Chat|ansicht=nachrichten|Öffne den Chat/)
  expect(mail).toMatch(/Die Firma meldet sich jetzt bei dir/)
})

test('Bewerben: Telefon ist freiwillig und wird mitgeschickt', async ({ page }) => {
  const db = defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true })] })
  await setupDashboard(page.context(), { user: SCHUELER, db })
  const posts = []
  page.on('request', r => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/bewerbungen')) posts.push(r.postData() || '')
  })
  await page.goto('/dashboard-schueler.html')
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
  const feld = page.locator('#bewerbung-telefon')
  await expect(feld).toHaveAttribute('type', 'tel')
  expect(await feld.getAttribute('required')).toBeNull()
  // Gleiche Regel wie die Datenbank (bewerbungen_telefon_check)
  expect(await feld.getAttribute('pattern')).toBe('[0-9 +()/\\-]{6,25}')
  expect(lies('supabase/chat-abschaffen.sql')).toContain("telefon ~ '^[0-9 +()/-]{6,25}$'")
})

const JOB = {
  id: 'j-kontakt', titel: 'Eisverkäufer/in', beschreibung: 'Eis.', ort: 'München',
  stundenlohn: 12, mindestalter: 15, kategorie: 'Verkauf', arbeitszeit: 'Wochenende',
  aktiv: true, aufrufe: 3, erstellt_am: '2026-08-20T10:00:00Z',
  firma_id: FIRMA.id, firma_name: 'Eiscafé Dolce',
}
function zusageDb(extra = {}) {
  return defaultDb({
    jobs: [JOB],
    profiles: [profilZeile(FIRMA), profilZeile(SCHUELER, { verifiziert: true })],
    bewerbungen: [{ id: 'b1', job_id: JOB.id, schueler_id: SCHUELER.id, status: 'angenommen',
      erstellt_am: '2026-08-25T10:00:00Z', motivationsschreiben: null, ...extra }],
  })
}
async function ansicht(page, datei) {
  await page.goto(`/${datei}`)
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="bewerbungen"]').click()
}

test('Firma sieht nach der Zusage, wie sie den Schüler erreicht – ohne Chat-Knopf', async ({ page }) => {
  await setupDashboard(page.context(), { user: FIRMA, db: zusageDb({ telefon: '0170 1234567' }) })
  await ansicht(page, 'dashboard-firma.html')
  const kasten = page.locator('.bew-melden-sie-sich').first()
  await expect(kasten).toBeVisible({ timeout: 20_000 })
  await expect(kasten.locator('a[href="tel:01701234567"]')).toHaveText('0170 1234567')
  await expect(kasten.locator('a[href="mailto:schueler@test.de"]')).toBeVisible()
  await expect(page.locator('[data-chat], #chat-overlay')).toHaveCount(0)
})

test('ohne Telefon bleibt der Weg per E-Mail', async ({ page }) => {
  await setupDashboard(page.context(), { user: FIRMA, db: zusageDb() })
  await ansicht(page, 'dashboard-firma.html')
  const kasten = page.locator('.bew-melden-sie-sich').first()
  await expect(kasten).toBeVisible({ timeout: 20_000 })
  await expect(kasten.locator('a[href^="tel:"]')).toHaveCount(0)
  await expect(kasten.locator('a[href="mailto:schueler@test.de"]')).toBeVisible()
})

test('Schüler sieht nach der Zusage, dass sich die Firma meldet', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: zusageDb({ telefon: '0170 1234567' }) })
  await ansicht(page, 'dashboard-schueler.html')
  const kasten = page.locator('.bew-zusage-weiter').first()
  await expect(kasten).toBeVisible({ timeout: 20_000 })
  await expect(kasten).toContainText('Die Firma meldet sich bei dir')
  await expect(kasten).toContainText('0170 1234567')
  await expect(kasten).toContainText('Eltern')
  await expect(page.locator('[data-chat-bewerbung]')).toHaveCount(0)
})

test('alte Mail-Links auf „Nachrichten" landen bei den Bewerbungen', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: defaultDb() })
  await page.goto('/dashboard-schueler.html?ansicht=nachrichten')
  await expect(page.locator('#view-bewerbungen')).toHaveClass(/active/, { timeout: 30_000 })
})
