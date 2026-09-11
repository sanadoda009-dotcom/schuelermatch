// Job-Alarm im Schüler-Dashboard (26.8.).
//
// Die Karte sitzt UNTER der Jobliste — dort kommt an, wer nichts
// Passendes gefunden hat. Genau dann ist der Alarm etwas wert, und
// genau dann stehen die Filter schon richtig: Der Alarm übernimmt sie.
//
// Der wichtigste Test hier ist der letzte: Solange die Tabelle in der
// Datenbank fehlt, muss die Karte STUMM verschwinden. Ein Schüler soll
// nichts von einer halbfertigen Baustelle mitbekommen — und genau
// dieser Zustand herrscht gerade, weil die Datenbank-Änderung noch
// aussteht.
const { test, expect, setupDashboard, SCHUELER, defaultDb, warteAufDashboard } = require('./helpers/supabase-fake')

// Die Geokodierung geht sonst wirklich ins Netz und macht den Test
// langsam und wackelig.
async function geoMocken(page, treffer = { lat: 48.137, lon: 11.575 }) {
  await page.route('**/geocoding-api.open-meteo.com/**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      // `country_code` gehoert dazu, seit js/geo.js das Land an der
      // ANTWORT prueft (8.9.2026). Der Dienst lieferte vorher ungefragt
      // Orte aus aller Welt - 10115 ergab New York, und diese
      // Koordinaten landeten im Profil. Ohne das Feld gilt ein Treffer
      // bewusst als unbrauchbar; die echte Antwort enthaelt es immer.
      body: JSON.stringify({ results: treffer ? [{ latitude: treffer.lat, longitude: treffer.lon, country_code: 'DE' }] : [] }),
    }))
}

async function oeffneDashboard(page) {
  await setupDashboard(page.context(), { user: SCHUELER })
  await geoMocken(page)
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
}

const karte = page => page.locator('#alarm-karte')

// Ein Schüler-Profil ohne Wohnort.
function ohneWohnort() {
  const db = defaultDb()
  db.profiles = db.profiles.map(p => (p.id === SCHUELER.id ? { ...p, ort: null, lat: null, lon: null } : p))
  return db
}

test('ohne Alarm bietet die Karte einen an', async ({ page }) => {
  await oeffneDashboard(page)
  await expect(karte(page)).toBeVisible()
  await expect(karte(page)).toContainText('Nichts Passendes dabei?')
  // Hiess bis zum 27.8. „Job-Alarm einrichten". Seit daneben „oder
  // selbst einstellen" steht, muss die Beschriftung sagen, WAS dieser
  // Knopf tut: die gerade eingestellten Filter übernehmen.
  await expect(page.locator('#alarm-an')).toHaveText('Mit dieser Suche einrichten')
  await expect(page.locator('#alarm-zu-einstellungen')).toBeVisible()
})

test('ohne Ort wird nichts gespeichert, sondern erklärt', async ({ page }) => {
  // Nur wenn WEDER Filter NOCH Profil einen Ort kennen. Steht im Profil
  // ein Wohnort, nimmt der Alarm den — das ist Absicht und wird im
  // nächsten Test geprüft.
  await setupDashboard(page.context(), { user: SCHUELER, db: ohneWohnort() })
  await geoMocken(page)
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)

  let gespeichert = false
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') gespeichert = true
    await route.fallback()
  })

  await page.fill('#filter-ort', '')
  await page.locator('#alarm-an').click()

  await expect(page.locator('.toast--fehler')).toContainText('Ort')
  expect(gespeichert, 'ohne Ort darf nichts in die Datenbank').toBe(false)
  // Die Karte bleibt im Angebots-Zustand.
  await expect(karte(page)).toContainText('Nichts Passendes dabei?')
})

test('der Alarm übernimmt die aktuellen Filter', async ({ page }) => {
  await oeffneDashboard(page)

  let gesendet = null
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') gesendet = route.request().postDataJSON()
    await route.fallback()
  })

  // So, wie ein Schüler es einstellen würde, bevor er aufgibt.
  await page.fill('#filter-ort', 'München')
  await page.selectOption('#filter-kategorie', 'Nachhilfe')
  await page.selectOption('#filter-arbeitszeit', 'Nachmittags')
  await page.selectOption('#filter-gehalt', '12')
  await page.locator('#alarm-an').click()

  await expect(karte(page)).toContainText('Job-Alarm läuft')

  const zeile = Array.isArray(gesendet) ? gesendet[0] : gesendet
  expect(zeile.ort).toBe('München')
  expect(zeile.kategorie).toBe('Nachhilfe')
  expect(zeile.arbeitszeit).toBe('Nachmittags')
  expect(Number(zeile.min_lohn)).toBe(12)
  expect(zeile.aktiv).toBe(true)
  expect(zeile.schueler_id, 'der Alarm gehört dem eingeloggten Schüler').toBe(SCHUELER.id)
  expect(zeile.lat, 'Koordinaten für die Umkreissuche').toBeCloseTo(48.137, 2)

  // Und die Karte sagt zurück, worauf sie hört.
  await expect(page.locator('.alarm-kriterien')).toContainText('Nachhilfe')
  await expect(page.locator('.alarm-kriterien')).toContainText('München')
})

test('ohne Koordinaten wird trotzdem gespeichert', async ({ page }) => {
  // Ein Ort, den die Geokodierung nicht kennt, darf den Alarm nicht
  // verhindern — die Funktion vergleicht dann über den Ortsnamen.
  await setupDashboard(page.context(), { user: SCHUELER })
  await geoMocken(page, null)
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)

  let zeile = null
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') {
      const d = route.request().postDataJSON()
      zeile = Array.isArray(d) ? d[0] : d
    }
    await route.fallback()
  })

  await page.fill('#filter-ort', 'Kleinkleckersdorf')
  await page.locator('#alarm-an').click()

  await expect(karte(page)).toContainText('Job-Alarm läuft')
  expect(zeile.ort).toBe('Kleinkleckersdorf')
  expect(zeile.lat, 'ohne Treffer wird die Koordinate ausdrücklich geleert').toBeNull()
  expect(zeile.lon).toBeNull()
})

/* Was der Schüler dabei erfährt (11.9.2026).
 *
 * DER BEFUND: Gespeichert wurde der Alarm ohne Koordinaten — und dazu
 * stand „Job-Alarm gespeichert. Wir melden uns, sobald etwas Passendes
 * kommt."
 *
 * Ohne Koordinaten vergleicht die Funktion aber den Ortsnamen Zeichen
 * für Zeichen (supabase/functions/mail-job-alarm/treffer.js):
 *
 *     if (alarm.ort) return normOrt(job.ort) === normOrt(alarm.ort)
 *
 * Ein Tippfehler trifft damit nie etwas. Der Schüler wartet auf Mails,
 * die nie kommen, und erfährt es erst daran, dass wochenlang nichts
 * kommt — wenn überhaupt.
 *
 * Dass das keine Theorie ist: Am 11.9.2026 stand genau so ein Alarm in
 * der Datenbank, `ort` war ein Personenname.
 *
 * Das Profilformular und das Anzeigenformular nennen diesen Fall längst
 * beim Namen. Der Alarm war der dritte Aufrufer von `geocode()` und der
 * einzige, der schwieg — ausgerechnet der, bei dem das Schweigen am
 * teuersten ist.
 */

// Der Text der letzten Meldung.
async function meldung(page) {
  const el = page.locator('.toast, #toast').last()
  await el.waitFor({ state: 'visible', timeout: 20_000 })
  return el.textContent()
}

test('ein unbekannter Ort wird beim Namen genannt', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER })
  await geoMocken(page, null)
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)

  await page.fill('#filter-ort', 'Kleinkleckersdorf')
  await page.locator('#alarm-an').click()

  const t = await meldung(page)
  expect(t).toContain('Kleinkleckersdorf')
  expect(t, 'die Ursache').toMatch(/nicht finden|Schreibweise/)
  // Und vor allem die FOLGE - „Ort nicht gefunden" allein klingt nach
  // einer Kleinigkeit.
  expect(t, 'die Folge fehlt: dass nur noch der genaue Ortsname zählt')
    .toMatch(/nicht im Umkreis|genau/)
})

test('bei einer Postleitzahl steht der richtige Grund da', async ({ page }) => {
  // Nicht die Schreibweise ist schuld - der Dienst kennt deutsche
  // Postleitzahlen fast nie. „Prüf die Schreibweise" wäre hier eine
  // falsche Fährte.
  await setupDashboard(page.context(), { user: SCHUELER })
  await geoMocken(page, null)
  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)

  await page.fill('#filter-ort', '10115')
  await page.locator('#alarm-an').click()

  const t = await meldung(page)
  expect(t).toContain('Postleitzahlen')
  expect(t, 'was stattdessen zu tun ist').toContain('Ortsnamen')
})

test('bei gestörtem Dienst und neuem Ort steht der andere Grund da', async ({ page }) => {
  // Auch hier bleibt der Alarm ohne Koordinaten - aber es ist NICHT die
  // Schuld des Schülers, und der Rat ist ein anderer.
  await oeffneDashboard(page)
  await page.fill('#filter-ort', 'München')
  await page.locator('#alarm-an').click()
  await expect(karte(page)).toContainText('Job-Alarm läuft')

  await page.route('**/geocoding-api.open-meteo.com/**', route => route.abort())
  await page.fill('#filter-ort', 'Hamburg')
  await page.locator('#alarm-neu').click()

  const t = await meldung(page)
  expect(t).toMatch(/nicht nachschlagen/)
  expect(t, 'kein Vorwurf an den Schüler').not.toMatch(/Schreibweise/)
  expect(t, 'und der Rat, es später zu wiederholen').toMatch(/später/)
})

test('bei einem gefundenen Ort bleibt es beim guten Zuspruch', async ({ page }) => {
  // Die Gegenprobe: Sonst stünde bei jedem Speichern eine Warnung, und
  // dann liest sie bald niemand mehr.
  await oeffneDashboard(page)
  await page.fill('#filter-ort', 'München')
  await page.locator('#alarm-an').click()

  const t = await meldung(page)
  expect(t).toContain('Wir melden uns')
  expect(t).not.toMatch(/nicht finden|Umkreis/)
})

test('bei gestörtem Geo-Dienst bleiben die bisherigen Koordinaten erhalten', async ({ page }) => {
  // geocode() unterscheidet „Ort gibt es nicht" von „Dienst antwortet
  // nicht". Beim zweiten Fall darf ein bereits gespeicherter Umkreis
  // nicht stillschweigend verlorengehen — solange der Ort derselbe ist.
  await oeffneDashboard(page)
  await page.fill('#filter-ort', 'München')
  await page.locator('#alarm-an').click()
  await expect(karte(page)).toContainText('Job-Alarm läuft')

  // Ab jetzt klemmt der Dienst.
  await page.route('**/geocoding-api.open-meteo.com/**', route => route.abort())

  let zeile = null
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') {
      const d = route.request().postDataJSON()
      zeile = Array.isArray(d) ? d[0] : d
    }
    await route.fallback()
  })

  await page.selectOption('#filter-kategorie', 'Nachhilfe')
  await page.locator('#alarm-neu').click()
  await expect(page.locator('.alarm-kriterien')).toContainText('Nachhilfe')

  expect(zeile.lat, 'gleicher Ort, Dienst gestört -> Koordinaten behalten').toBeCloseTo(48.137, 2)
})

test('bei gestörtem Dienst und NEUEM Ort werden die alten Koordinaten verworfen', async ({ page }) => {
  // Sie zeigten sonst auf die alte Stadt, und der Umkreis suchte am
  // falschen Fleck — schlimmer als gar keine Koordinate.
  await oeffneDashboard(page)
  await page.fill('#filter-ort', 'München')
  await page.locator('#alarm-an').click()
  await expect(karte(page)).toContainText('Job-Alarm läuft')

  await page.route('**/geocoding-api.open-meteo.com/**', route => route.abort())

  let zeile = null
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') {
      const d = route.request().postDataJSON()
      zeile = Array.isArray(d) ? d[0] : d
    }
    await route.fallback()
  })

  await page.fill('#filter-ort', 'Hamburg')
  await page.locator('#alarm-neu').click()
  await expect(page.locator('.alarm-kriterien')).toContainText('Hamburg')

  expect(zeile.lat, 'anderer Ort -> keine alten Koordinaten übernehmen').toBeNull()
})

test('ein laufender Alarm lässt sich ausschalten', async ({ page }) => {
  await oeffneDashboard(page)
  await page.fill('#filter-ort', 'München')
  await page.locator('#alarm-an').click()
  await expect(karte(page)).toContainText('Job-Alarm läuft')

  await page.locator('#alarm-aus').click()
  await expect(karte(page)).toContainText('Job-Alarm ist aus')
  await expect(page.locator('#alarm-an')).toHaveText('Wieder einschalten')
})

test('solange die Tabelle fehlt, bleibt die Karte verborgen', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER })
  await geoMocken(page)
  // Genau das, was PostgREST bei einer unbekannten Tabelle antwortet.
  await page.route('**/rest/v1/job_alarme*', route =>
    route.fulfill({
      status: 404, contentType: 'application/json',
      body: JSON.stringify({ code: '42P01', message: 'relation "public.job_alarme" does not exist' }),
    }))

  await page.goto('/dashboard-schueler.html')
  await warteAufDashboard(page)
  await page.waitForTimeout(800)

  await expect(karte(page), 'keine halbfertige Baustelle zeigen').toBeHidden()
  // Und schon gar keine Fehlermeldung an den Schüler.
  await expect(page.locator('.toast--fehler')).toHaveCount(0)
})


test('ohne Filter-Ort nimmt der Alarm den Wohnort aus dem Profil', async ({ page }) => {
  await oeffneDashboard(page)

  let zeile = null
  await page.route('**/rest/v1/job_alarme*', async route => {
    if (route.request().method() === 'POST') {
      const d = route.request().postDataJSON()
      zeile = Array.isArray(d) ? d[0] : d
    }
    await route.fallback()
  })

  await page.fill('#filter-ort', '')
  await page.locator('#alarm-an').click()

  await expect(karte(page)).toContainText('Job-Alarm läuft')
  expect(zeile.ort, 'Rückfall auf den Wohnort').toBeTruthy()
})

// ---------------------------------------------------------------------
// Bereich „Einstellungen" (27.8.)
//
// Bis dahin liess sich der Alarm NUR unter der Jobliste einrichten — und
// nur, indem er die dort gesetzten Filter übernahm. Wer ihn später
// anpassen wollte (anderer Ort, engerer Umkreis), musste erst die Filter
// wieder so stellen. Ein Bereich zum selbst Einstellen fehlte.
//
// Die Karte unter der Liste bleibt: Wer dort ankommt, hat gerade nichts
// gefunden, und der Schnellweg ist genau dann richtig. Beide schreiben
// dieselbe Zeile — es gibt einen Alarm je Schüler.
async function zuEinstellungen(page) {
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="einstellungen"]').click()
  await expect(page.locator('#view-einstellungen')).toBeVisible()
}

test.describe('Job-Alarm selbst einstellen', () => {
  test('die Seitenleiste hat einen Einstellungen-Bereich', async ({ page }) => {
    await oeffneDashboard(page)
    await zuEinstellungen(page)
    await expect(page.locator('#alarm-form')).toBeVisible()
  })

  test('ohne Alarm steht „noch nicht eingerichtet" da', async ({ page }) => {
    await oeffneDashboard(page)
    await zuEinstellungen(page)
    await expect(page.locator('#alarm-status')).toHaveText(/noch nicht/)
  })

  test('das Ortsfeld ist mit dem Wohnort vorbelegt', async ({ page }) => {
    // Sonst sitzt ein 14-Jähriger vor einem leeren Feld und weiss nicht,
    // was da rein soll.
    await oeffneDashboard(page)
    await zuEinstellungen(page)
    await expect(page.locator('#alarm-ort')).not.toHaveValue('')
  })

  test('eigene Angaben werden gespeichert', async ({ page }) => {
    const db = defaultDb()
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await geoMocken(page)
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await zuEinstellungen(page)

    await page.locator('#alarm-ort').fill('Köln')
    await page.locator('#alarm-umkreis').selectOption('10')
    await page.locator('#alarm-kategorie').selectOption('Nachhilfe')
    await page.locator('#alarm-lohn').fill('14')
    await page.locator('#alarm-speichern').click()

    await expect.poll(() => db.job_alarme?.length).toBe(1)
    expect(db.job_alarme[0]).toMatchObject({
      ort: 'Köln', umkreis_km: 10, kategorie: 'Nachhilfe', min_lohn: 14, aktiv: true,
    })
  })

  test('nach dem Speichern steht der Status auf „läuft"', async ({ page }) => {
    await oeffneDashboard(page)
    await zuEinstellungen(page)
    await page.locator('#alarm-ort').fill('Köln')
    await page.locator('#alarm-speichern').click()
    await expect(page.locator('#alarm-status')).toHaveText(/läuft/)
  })

  test('ohne Ort wird nicht gespeichert, sondern erklärt', async ({ page }) => {
    const db = ohneWohnort()
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await geoMocken(page)
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await zuEinstellungen(page)

    await page.locator('#alarm-ort').fill('')
    await page.locator('#alarm-speichern').click()
    await expect(page.locator('.toast')).toContainText(/Ort/)
    expect(db.job_alarme?.length ?? 0).toBe(0)
  })

  test('ein bestehender Alarm steht im Formular', async ({ page }) => {
    // Ohne das müsste man beim Ändern alles neu eintippen.
    const db = defaultDb()
    db.job_alarme = [{
      id: 'a1', schueler_id: SCHUELER.id, ort: 'Hamburg', umkreis_km: 50,
      kategorie: 'Verkauf', arbeitszeit: 'Wochenende', min_lohn: 13,
      aktiv: true, abmelde_token: 't', zuletzt_gesendet: '2026-08-01T00:00:00Z',
    }]
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await geoMocken(page)
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await zuEinstellungen(page)

    await expect(page.locator('#alarm-ort')).toHaveValue('Hamburg')
    await expect(page.locator('#alarm-umkreis')).toHaveValue('50')
    await expect(page.locator('#alarm-kategorie')).toHaveValue('Verkauf')
    await expect(page.locator('#alarm-arbeitszeit')).toHaveValue('Wochenende')
    await expect(page.locator('#alarm-lohn')).toHaveValue('13')
    await expect(page.locator('#alarm-status')).toHaveText(/läuft/)
  })

  test('der Schalter schaltet aus und wieder ein', async ({ page }) => {
    const db = defaultDb()
    db.job_alarme = [{
      id: 'a1', schueler_id: SCHUELER.id, ort: 'Hamburg', umkreis_km: 25,
      aktiv: true, abmelde_token: 't', zuletzt_gesendet: '2026-08-01T00:00:00Z',
    }]
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await geoMocken(page)
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await zuEinstellungen(page)

    await page.locator('#alarm-schalter').click()
    await expect(page.locator('#alarm-status')).toHaveText(/ausgeschaltet/)
    await expect.poll(() => db.job_alarme[0].aktiv).toBe(false)

    await page.locator('#alarm-schalter').click()
    await expect(page.locator('#alarm-status')).toHaveText(/läuft/)
  })

  test('die Karte unter der Jobliste verweist in die Einstellungen', async ({ page }) => {
    // Der Weg dorthin muss auch von der Stelle aus zu finden sein, an
    // der man merkt, dass nichts Passendes dabei ist.
    await oeffneDashboard(page)
    await page.locator('#alarm-zu-einstellungen').click()
    await expect(page.locator('#view-einstellungen')).toBeVisible()
  })

  test('der Schnellweg übernimmt die Filter ins Formular, speichert aber nicht sofort', async ({ page }) => {
    // Übernehmen und Speichern getrennt: Sonst wäre eine unbedachte
    // Filterstellung sofort der neue Alarm.
    const db = defaultDb()
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await geoMocken(page)
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)

    await page.locator('#filter-ort').fill('Bremen')
    await page.locator('#filter-kategorie').selectOption('Gastronomie')
    await zuEinstellungen(page)
    await page.locator('#alarm-von-filtern').click()

    await expect(page.locator('#alarm-ort')).toHaveValue('Bremen')
    await expect(page.locator('#alarm-kategorie')).toHaveValue('Gastronomie')
    expect(db.job_alarme?.length ?? 0, 'noch nichts gespeichert').toBe(0)
  })
})
