// Admin-Bereich, Reiter "Statistik" (admin.html + js/admin.js).
// Die Zahlen kommen über die aggregierende RPC `betreiber_statistik` –
// im Test aus der Fake-DB nachgebildet.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, ADMIN, warteAufAdmin } = require('./helpers/supabase-fake')

function statistikDb() {
  const db = defaultDb({
    profiles: [
      profilZeile(ADMIN, { ist_admin: true }),
      profilZeile(SCHUELER, { verifiziert: true }),
      profilZeile({ ...SCHUELER, id: 's2', name: 'Ben' }, { verifiziert: false }),
      profilZeile(FIRMA, { firma_status: 'freigegeben' }),
      profilZeile({ ...FIRMA, id: 'f2', name: 'Neue GmbH' }, { firma_status: 'neu' }),
    ],
  })
  db.bewerbungen = [
    { id: 'b1', job_id: db.jobs[0].id, schueler_id: SCHUELER.id, status: 'angenommen', erstellt_am: new Date().toISOString() },
    { id: 'b2', job_id: db.jobs[1].id, schueler_id: SCHUELER.id, status: 'ausstehend', erstellt_am: new Date().toISOString() },
  ]
  db.meldungen = [
    { id: 'm1', melder_id: SCHUELER.id, typ: 'job', job_id: db.jobs[0].id, grund: 'betrug', status: 'offen', zitat: 'x', erstellt_am: new Date().toISOString() },
  ]
  return db
}

async function oeffneStatistik(page) {
  await warteAufAdmin(page)                // erst wenn init() fertig ist
  await page.locator('.admin-tab[data-tab="statistik"]').click()
  await expect(page.locator('#panel-statistik')).toHaveClass(/active/)
  await expect(page.locator('.stat-gruppe').first()).toBeVisible({ timeout: 20_000 })
}

test('Statistik-Reiter existiert und zeigt Nutzerzahlen', async ({ page }) => {
  await setupDashboard(page.context(), { user: ADMIN, db: statistikDb() })
  await page.goto('/admin.html')
  await oeffneStatistik(page)

  const nutzer = page.locator('.stat-gruppe', { hasText: 'Nutzer' })
  // 3 Schüler-Profile: der Admin selbst hat ebenfalls die Rolle 'schueler'
  // (so ist es auch in der echten DB: ist_admin ist nur ein Flag am Profil).
  await expect(nutzer).toContainText('Schüler')
  await expect(nutzer).toContainText('Arbeitgeber')
  await expect(nutzer).toContainText('davon freigegeben')
  // 1 von 3 verifiziert -> 33%
  await expect(nutzer).toContainText('33%')
})

test('Aktivität zeigt Jobs, Bewerbungen und Zusagenquote', async ({ page }) => {
  await setupDashboard(page.context(), { user: ADMIN, db: statistikDb() })
  await page.goto('/admin.html')
  await oeffneStatistik(page)

  const aktiv = page.locator('.stat-gruppe', { hasText: 'Aktivität' })
  await expect(aktiv).toContainText('Bewerbungen je Job')
  // 2 Bewerbungen, davon 1 angenommen -> 50%
  await expect(aktiv).toContainText('50%')
})

test('offene Aufgaben werden hervorgehoben', async ({ page }) => {
  await setupDashboard(page.context(), { user: ADMIN, db: statistikDb() })
  await page.goto('/admin.html')
  await oeffneStatistik(page)

  const warten = page.locator('.stat-gruppe', { hasText: 'Wartet auf dich' })
  await expect(warten).toContainText('Firmen zu prüfen')
  await expect(warten).toContainText('offene Meldungen')
  await expect(warten.locator('.stat-box--achtung')).toHaveCount(2)
})

test('ohne offene Aufgaben fehlt der Abschnitt', async ({ page }) => {
  const db = defaultDb({
    profiles: [profilZeile(ADMIN, { ist_admin: true }), profilZeile(FIRMA, { firma_status: 'freigegeben' })],
  })
  await setupDashboard(page.context(), { user: ADMIN, db })
  await page.goto('/admin.html')
  await oeffneStatistik(page)

  await expect(page.locator('.stat-gruppe', { hasText: 'Wartet auf dich' })).toHaveCount(0)
})

test('Wochen-Tabelle zeigt 8 Wochen mit Balken', async ({ page }) => {
  await setupDashboard(page.context(), { user: ADMIN, db: statistikDb() })
  await page.goto('/admin.html')
  await oeffneStatistik(page)

  await expect(page.locator('.stat-tabelle tbody tr')).toHaveCount(8)
  await expect(page.locator('.stat-tabelle thead')).toContainText('Anmeldungen')
  await expect(page.locator('.stat-tabelle thead')).toContainText('Neue Jobs')
  // Balken für die aktuelle Woche (2 Bewerbungen heute) sind gerendert
  await expect(page.locator('.balken-bewerbung').last()).toBeVisible()
})

// ---------------------------------------------------------------------
// Wartende Verifizierungen (26.8.)
//
// Der Kasten „Wartet auf dich" zeigte Firmen und offene Meldungen — aber
// NICHT die Schüler, deren Ausweis auf Prüfung wartet. Dabei ist das die
// dringendste Warteschlange: Ein Schüler ohne Verifizierung kann sich auf
// gar nichts bewerben, für ihn steht die ganze Plattform still.
//
// `betreiber_statistik` liefert die Zahl gar nicht (dort gibt es nur
// `firmen_offen` und `meldungen_offen`). Sie steckt in der Schülerliste,
// die der Bereich ohnehin lädt — deshalb wird sie im Browser gezählt.
//
// Beide Ladevorgänge laufen nebenläufig. Kommt die Statistik zuerst,
// muss sie nachziehen, sobald die Schülerliste da ist.
test.describe('wartende Verifizierungen', () => {
  // „Zu prüfen" heisst: Dokument liegt vor UND noch nicht verifiziert.
  function dbMitWartenden(anzahl) {
    const profile = [
      profilZeile(ADMIN, { ist_admin: true }),
      profilZeile(FIRMA, { firma_status: 'freigegeben' }),
    ]
    for (let i = 0; i < anzahl; i++) {
      profile.push(profilZeile({ ...SCHUELER, id: 'w' + i, name: 'Wartend ' + i }, {
        verifiziert: false,
        schuelerausweis_url: `w${i}/ausweis.jpg`,
      }))
    }
    const db = defaultDb({ profiles: profile })
    db.meldungen = []
    return db
  }

  test('zwei wartende Schüler erscheinen in „Wartet auf dich"', async ({ page }) => {
    await setupDashboard(page.context(), { user: ADMIN, db: dbMitWartenden(2) })
    await page.goto('/admin.html')
    await oeffneStatistik(page)

    const kasten = page.locator('.stat-gruppe', { hasText: 'Wartet auf dich' })
    await expect(kasten).toBeVisible()
    const box = kasten.locator('.stat-box', { hasText: 'verifizieren' })
    await expect(box).toBeVisible()
    await expect(box.locator('b')).toHaveText('2')
  })

  test('ein hochgeladenes Dokument allein reicht nicht — wer verifiziert ist, wartet nicht', async ({ page }) => {
    // Der Unterschied zwischen „hat ein Dokument" und „wartet": Nach der
    // Freischaltung ist der Schüler durch, auch wenn noch ein Pfad
    // in der Zeile steht.
    const db = defaultDb({
      profiles: [
        profilZeile(ADMIN, { ist_admin: true }),
        profilZeile({ ...SCHUELER, id: 'fertig', name: 'Fertig' },
          { verifiziert: true, schuelerausweis_url: 'fertig/ausweis.jpg' }),
      ],
    })
    db.meldungen = []
    await setupDashboard(page.context(), { user: ADMIN, db })
    await page.goto('/admin.html')
    await oeffneStatistik(page)

    await expect(page.locator('.stat-box', { hasText: 'verifizieren' })).toHaveCount(0)
  })

  test('ohne Dokument wartet niemand — der Kasten bleibt ganz weg', async ({ page }) => {
    // Kein Dokument, keine offene Firma, keine Meldung: nichts zu tun.
    const db = defaultDb({
      profiles: [
        profilZeile(ADMIN, { ist_admin: true }),
        profilZeile(SCHUELER, { verifiziert: false }),   // nie etwas hochgeladen
        profilZeile(FIRMA, { firma_status: 'freigegeben' }),
      ],
    })
    db.meldungen = []
    await setupDashboard(page.context(), { user: ADMIN, db })
    await page.goto('/admin.html')
    await oeffneStatistik(page)

    await expect(page.locator('.stat-gruppe', { hasText: 'Wartet auf dich' })).toHaveCount(0)
  })

  test('die Zahl stimmt mit dem Schüler-Reiter überein', async ({ page }) => {
    // Zwei Zählungen derselben Sache dürfen nicht auseinanderlaufen —
    // sonst weiss der Betreiber nicht, welcher er glauben soll.
    await setupDashboard(page.context(), { user: ADMIN, db: dbMitWartenden(3) })
    await page.goto('/admin.html')
    await oeffneStatistik(page)
    const inStatistik = await page.locator('.stat-box', { hasText: 'verifizieren' }).locator('b').textContent()

    await page.locator('.admin-tab[data-tab="schueler"]').click()
    const imReiter = await page.locator('#admin-stats .stat-box', { hasText: 'Zu prüfen' }).locator('b').textContent()

    expect(inStatistik).toBe(imReiter)
    expect(inStatistik).toBe('3')
  })
})
