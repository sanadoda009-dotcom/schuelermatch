// Eine Anzeige ohne Ortszuordnung verschwindet aus der Umkreissuche (8.9.2026).
//
// DER BEFUND: Sucht ein Schüler „im Umkreis von X km", filtert
// `js/dashboard-schueler.js` so:
//
//   if (radius > 0 && habeKoord) {
//     const d = distanzKm(profile.lat, profile.lon, job.lat, job.lon)
//     if (d == null || d > radius) return false
//   }
//
// `d` ist `null`, sobald die Anzeige keine Koordinaten hat. Sie fällt also
// heraus — nicht weil sie zu weit weg wäre, sondern weil niemand weiß, wo
// sie ist. Und das ist die übliche Suche: Der Umkreis-Regler steht direkt
// über der Liste.
//
// Die Firma erfuhr davon genau einmal: als Toast beim Speichern, wenn der
// Geo-Dienst den Ort nicht zuordnen konnte. Wer ihn übersah — oder dessen
// Anzeige aus einer Zeit vor diesem Hinweis stammt — hatte danach keine
// Möglichkeit mehr, es zu bemerken. In der Anzeigenliste stand nichts.
//
// Am 8.9.2026 in der laufenden Datenbank gezählt: **2 von 5 aktiven
// Anzeigen** ohne Koordinaten. Bei fünf Anzeigen sind das 40 %, die bei
// der naheliegendsten Suche fehlen.
//
// Jetzt steht es dauerhaft an der Karte — mit der Folge und dem Weg,
// es zu beheben.

const { test, expect, setupDashboard, warteAufDashboard, FIRMA, SCHUELER, defaultDb } = require('./helpers/supabase-fake')

const BASIS = {
  firma_id: FIRMA.id, firma_name: FIRMA.name, beschreibung: 'Eis verkaufen.',
  ort: 'München', stundenlohn: 13, mindestalter: 15, kategorie: 'Gastronomie',
  arbeitszeit: 'Wochenende', aktiv: true, aufrufe: 1,
  erstellt_am: '2026-09-01T10:00:00Z', verfuegbarkeit: null,
}

function db({ mitKoordinaten }) {
  const d = defaultDb()
  d.jobs = [{
    ...BASIS, id: 'eigen-1', titel: 'Aushilfe Eistheke',
    lat: mitKoordinaten ? 48.137 : null,
    lon: mitKoordinaten ? 11.575 : null,
  }]
  d.bewerbungen = []
  return d
}

async function zurAnzeigenliste(page) {
  await page.goto('/dashboard-firma.html')
  await warteAufDashboard(page)
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="jobs"]').click()
  await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })
}

test.describe('im Firmen-Dashboard', () => {
  test('ohne Koordinaten steht der Hinweis an der Anzeige', async ({ page }) => {
    await setupDashboard(page.context(), { db: db({ mitKoordinaten: false }), user: FIRMA })
    await zurAnzeigenliste(page)
    await expect(page.locator('.job-ohne-ort')).toBeVisible()
  })

  test('er nennt die Folge, nicht nur den Zustand', async ({ page }) => {
    // „Ohne Ortszuordnung" allein sagt einer Firma nichts. Was zählt:
    // Die Anzeige fehlt bei der üblichen Suche.
    await setupDashboard(page.context(), { db: db({ mitKoordinaten: false }), user: FIRMA })
    await zurAnzeigenliste(page)
    await expect(page.locator('.job-ohne-ort')).toContainText('Umkreis')
  })

  test('und den Weg, es zu beheben', async ({ page }) => {
    await setupDashboard(page.context(), { db: db({ mitKoordinaten: false }), user: FIRMA })
    await zurAnzeigenliste(page)
    await expect(page.locator('.job-ohne-ort')).toContainText('Bearbeiten')
  })

  test('mit Koordinaten steht dort nichts', async ({ page }) => {
    // Ein Hinweis, der immer da ist, wird übersehen.
    await setupDashboard(page.context(), { db: db({ mitKoordinaten: true }), user: FIRMA })
    await zurAnzeigenliste(page)
    await expect(page.locator('.job-ohne-ort')).toHaveCount(0)
  })
})

test.describe('warum es zählt — der Filter im Schüler-Dashboard', () => {
  test('eine Anzeige ohne Koordinaten fällt aus dem Umkreis', async ({ page }) => {
    const d = defaultDb()
    d.jobs = [
      { ...BASIS, id: 'mit-koord', titel: 'Mit Ortszuordnung', lat: 48.137, lon: 11.575 },
      { ...BASIS, id: 'ohne-koord', titel: 'Ohne Ortszuordnung', lat: null, lon: null },
    ]
    d.profiles = d.profiles.map(p => p.id === SCHUELER.id
      ? { ...p, lat: 48.137, lon: 11.575, alter_jahre: 17, verifiziert: true }
      : p)
    await setupDashboard(page.context(), { db: d, user: SCHUELER })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await page.locator('#sidebar-toggle').click()
    await page.locator('.sidebar-item[data-view="jobs"]').click()
    await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 20_000 })

    // Ohne Umkreis: beide da.
    await expect(page.locator('.job-card')).toHaveCount(2)

    // Mit Umkreis: nur die mit Ortszuordnung — obwohl beide in München sind.
    const regler = page.locator('#filter-radius')
    await expect(regler).toBeVisible()
    await regler.fill('50')
    await regler.dispatchEvent('input')
    await expect(page.locator('.job-card')).toHaveCount(1)
    await expect(page.locator('.job-card')).toContainText('Mit Ortszuordnung')
  })
})
