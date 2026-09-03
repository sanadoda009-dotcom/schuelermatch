// Der Inhalt einer Bewerbung gehört dem Schüler (2.9.2026).
//
// ANLASS: Beim Einbau des Bewerbungsstands musste ich prüfen, ob die Firma
// `angesehen_am`, `entschieden_am` und `absage_grund` überhaupt schreiben
// darf. Sie darf — und dabei kam heraus, dass sie auch alles andere darf.
//
// Die UPDATE-Regel heißt „Firma aendert Status eigener Bewerbungen",
// schränkt aber keine SPALTEN ein. RLS wirkt in Postgres nur auf Zeilen.
// Eine Firma kann damit `motivationsschreiben` überschreiben — den Text,
// den der Schüler geschrieben hat — und die Verweise auf seinen Lebenslauf
// und sein Zeugnis.
//
// ZWEITER FUND, in dieselbe Richtung: Der Pfad zum Lebenslauf wurde nach
// dem Anlegen per UPDATE nachgetragen. Ein Schüler hat auf `bewerbungen`
// aber GAR KEINE UPDATE-Regel — das Update traf null Zeilen, ohne Fehler.
// Nachgemessen in der echten Datenbank: 0 von 3 Bewerbungen hatten einen
// `lebenslauf_url`.
//
// Die Folge war nicht kosmetisch. Das Firmen-Dashboard sagt im Kommentar
// „Bevorzugt: das bei der Bewerbung angehängte PDF (Snapshot)", fiel aber
// IMMER auf die Live-Erzeugung zurück — und zeigte damit den HEUTIGEN
// Lebenslauf. Wer seinen Lebenslauf nach der Bewerbung ändert, änderte
// rückwirkend, was die Firma zu sehen bekommt.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA } =
  require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

function bewerbungsfaehig() {
  return profilZeile(SCHUELER, {
    verifiziert: true,
    schule: 'Gymnasium Nord',
    lebenslauf_bloecke: [{ id: 'b1', typ: 'text', titel: 'Über mich', inhalt: 'Zuverlässig.' }],
  })
}

test('der Lebenslauf hängt an der Bewerbung, nicht am heutigen Profil', async ({ page }) => {
  // Der Kern. Vorher wurde der Pfad per UPDATE nachgetragen – und das
  // Update traf nie eine Zeile.
  const db = defaultDb({ profiles: [bewerbungsfaehig(), profilZeile(FIRMA)] })
  db.bewerbungen = []
  await setupDashboard(page.context(), { user: SCHUELER, db })
  await page.goto('/dashboard-schueler.html')
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })

  const karte = page.locator('#view-jobs .job-card').first()
  await expect(karte).toBeVisible({ timeout: 30_000 })
  await karte.getByRole('button', { name: 'Jetzt bewerben' }).click()
  await expect(page.locator('#bewerbung-overlay')).toHaveClass(/open/)

  // Eigenes PDF statt des automatischen: Im Test ist jsPDF blockiert (die
  // Helfer sperren schwere CDNs), das automatische PDF entsteht also gar
  // nicht. Der Weg mit eigener Datei kommt ohne aus und prueft dieselbe
  // Sache - dass der Pfad MIT der Bewerbung gespeichert wird.
  await page.locator('#cv-wahl-upload').check()
  await page.locator('#cv-eigen-datei').setInputFiles({
    name: 'lebenslauf.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 Testinhalt'),
  })
  await page.locator('#bewerbung-form button[type=submit]').click()

  await expect.poll(() => db.bewerbungen.length, { timeout: 30_000 }).toBe(1)
  expect(db.bewerbungen[0].lebenslauf_url,
    'Lebenslauf-Pfad wurde nicht mit der Bewerbung gespeichert').toBeTruthy()
})

test('nach dem Anlegen wird an der Bewerbung nichts nachgetragen', async () => {
  // Wächter. Ein Schüler hat keine UPDATE-Regel auf `bewerbungen` – jedes
  // nachgelagerte Update trifft null Zeilen und meldet keinen Fehler. Wer
  // so etwas wieder einbaut, baut wieder etwas, das stillschweigend nichts
  // tut.
  const quelle = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard-schueler.js'), 'utf8')

  const updates = quelle.match(/from\('bewerbungen'\)\s*\n?\s*\.update\(/g) || []
  expect(updates, 'Schülerseite ändert eine Bewerbung nachträglich').toEqual([])
})

test('eine Entscheidung fasst den Inhalt der Bewerbung nicht an', async ({ page }) => {
  const db = defaultDb({
    jobs: [{
      id: 'j-inhalt', titel: 'Eisverkäufer/in', beschreibung: 'Eis.', ort: 'München',
      stundenlohn: 12, mindestalter: 15, kategorie: 'Verkauf', arbeitszeit: 'Wochenende',
      aktiv: true, aufrufe: 1, erstellt_am: '2026-08-20T10:00:00Z',
      firma_id: FIRMA.id, firma_name: 'Eiscafé Sonne',
    }],
    profiles: [profilZeile(FIRMA), bewerbungsfaehig()],
    bewerbungen: [{
      id: 'b-inhalt', job_id: 'j-inhalt', schueler_id: SCHUELER.id, status: 'ausstehend',
      erstellt_am: '2026-08-25T10:00:00Z',
      motivationsschreiben: 'Mein eigener Text.',
      lebenslauf_url: `${SCHUELER.id}/j-inhalt/lebenslauf.pdf`,
      zeugnis_url: null,
    }],
  })
  await setupDashboard(page.context(), { user: FIRMA, db })
  await page.goto('/dashboard-firma.html')
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="bewerbungen"]').click()
  await expect(page.locator('.bewerber-item').first()).toBeVisible({ timeout: 20_000 })

  await page.locator('button', { hasText: 'Annehmen' }).first().click()
  await expect.poll(() => db.bewerbungen[0].status, { timeout: 20_000 }).toBe('angenommen')

  // Alles, was dem Schüler gehört, ist unverändert.
  expect(db.bewerbungen[0].motivationsschreiben).toBe('Mein eigener Text.')
  expect(db.bewerbungen[0].lebenslauf_url).toBe(`${SCHUELER.id}/j-inhalt/lebenslauf.pdf`)
  expect(db.bewerbungen[0].schueler_id).toBe(SCHUELER.id)
  expect(db.bewerbungen[0].job_id).toBe('j-inhalt')
})

test('die Datenbankseite dazu liegt bereit', async () => {
  // Der Code fasst den Inhalt nicht an – aber die Datenbank ERLAUBT es
  // weiterhin. Nur ein Trigger macht daraus eine Zusage.
  const datei = path.join(__dirname, '..', 'supabase', 'bewerbung-inhalt-schuetzen.sql')
  expect(fs.existsSync(datei), 'supabase/bewerbung-inhalt-schuetzen.sql fehlt').toBe(true)
  const sql = fs.readFileSync(datei, 'utf8')

  // Die Spalten, die geschützt sein müssen.
  for (const spalte of ['motivationsschreiben', 'lebenslauf_url', 'zeugnis_url',
                        'schueler_id', 'job_id', 'erstellt_am']) {
    expect(sql, `Spalte ${spalte} nicht geschützt`).toContain(spalte)
  }
  expect(sql).toContain('before update on public.bewerbungen')
  // Und die Entscheidungsspalten müssen weiter durchgehen – sonst wäre
  // Annehmen und Ablehnen ab dem Einspielen kaputt.
  for (const spalte of ['status', 'angesehen_am', 'entschieden_am', 'absage_grund']) {
    expect(sql.includes(`new.${spalte}`), `${spalte} wird fälschlich blockiert`).toBe(false)
  }
})
