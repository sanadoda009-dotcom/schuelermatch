// Die Bewerbungs-Ansicht der Firma im neuen Aufbau (23.11.2026)
//
// Festgehalten wird: Die Filter nennen ihre Zahl, bevor man klickt; das
// Anschreiben ist lesbar, ohne erst das PDF zu oeffnen; und nichts davon
// erscheint, wo es nichts zu zeigen gibt.
const { test, expect, setupDashboard, defaultDb, profilZeile, FIRMA, SCHUELER } = require('./helpers/supabase-fake')

function db() {
  const d = defaultDb({ profiles: [profilZeile(FIRMA), profilZeile(SCHUELER, { verifiziert: true, alter_jahre: 15, ort: 'München', schule: 'Gymnasium Pasing', klasse: '9b' })] })
  d.jobs = [{ id: 'j1', firma_id: FIRMA.id, titel: 'Lagermitarbeiter', ort: 'München', lat: 48.1, lon: 11.5, stundenlohn: 14,
    mindestalter: 14, aktiv: true, aufrufe: 3, erstellt_am: '2026-11-20T10:00:00Z', beschreibung: 'x' }]
  d.bewerbungen = [
    { id: 'b1', job_id: 'j1', schueler_id: SCHUELER.id, status: 'ausstehend', erstellt_am: '2026-11-21T10:00:00Z',
      motivationsschreiben: 'Ich packe gern mit an.' },
    { id: 'b2', job_id: 'j1', schueler_id: SCHUELER.id, status: 'angenommen', erstellt_am: '2026-11-19T11:00:00Z' },
    { id: 'b3', job_id: 'j1', schueler_id: SCHUELER.id, status: 'ausstehend', erstellt_am: '2026-11-18T11:00:00Z' },
  ]
  return d
}

async function oeffne(page) {
  await setupDashboard(page.context(), { db: db(), user: FIRMA })
  await page.goto('/dashboard-firma.html?ansicht=bewerbungen')
  await expect(page.locator('.bewerber-item')).toHaveCount(3, { timeout: 20_000 })
}

const filter = (page, wert) => page.locator(`#bewerber-filter [data-bf="${wert}"]`)

test('jeder Filter nennt seine Zahl schon vor dem Klick', async ({ page }) => {
  await oeffne(page)
  await expect(filter(page, '').locator('.bk-zahl')).toHaveText('3')
  await expect(filter(page, 'ausstehend').locator('.bk-zahl')).toHaveText('2')
  await expect(filter(page, 'angenommen').locator('.bk-zahl')).toHaveText('1')
  await expect(filter(page, 'abgelehnt').locator('.bk-zahl')).toHaveText('0')
})

test('der Filter zeigt, welcher gedrueckt ist, und filtert', async ({ page }) => {
  await oeffne(page)
  await filter(page, 'ausstehend').click()
  await expect(filter(page, 'ausstehend')).toHaveAttribute('aria-pressed', 'true')
  await expect(filter(page, '')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.bewerber-item')).toHaveCount(2)
  await expect(page.locator('.bewerber-item .status-badge')).toHaveText(['Offen', 'Offen'])
})

test('der Kopf der Gruppe sagt, wie viele auf Antwort warten', async ({ page }) => {
  await oeffne(page)
  await expect(page.locator('.bew-gruppe-kopf .bk-offen')).toHaveText('2 warten auf Antwort')
})

test('das Anschreiben laesst sich direkt lesen - nur wo es eins gibt', async ({ page }) => {
  await oeffne(page)
  await expect(page.locator('.bk-anschreiben')).toHaveCount(1)
  const mit = page.locator('.bewerber-item', { has: page.locator('.bk-anschreiben') })
  await expect(mit.locator('.bk-anschreiben p')).toBeHidden()
  await mit.locator('.bk-anschreiben summary').click()
  await expect(mit.locator('.bk-anschreiben p')).toHaveText('Ich packe gern mit an.')
})

test('Schule und Klasse stehen bei der Person', async ({ page }) => {
  await oeffne(page)
  await expect(page.locator('.bewerber-item').first().locator('.bk-schule')).toHaveText('Gymnasium Pasing · Klasse 9b')
})
