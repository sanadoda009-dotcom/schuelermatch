// Eine Meldung muss überleben, und sie muss sagen, worum es ging (2.9.2026).
//
// ANLASS: Der Blick auf die Fremdschlüssel — dasselbe Muster, das am 27.8.
// `meldungen.melder_id` gefunden hat, nur von der anderen Seite.
//
//   meldungen.job_id       → jobs        ON DELETE CASCADE
//   meldungen.nachricht_id → nachrichten ON DELETE CASCADE
//   nachrichten.absender_id → profiles   ON DELETE CASCADE
//
// Und `jobs` hat eine Löschregel `auth.uid() = firma_id`. Eine Firma darf
// ihre eigene Anzeige also löschen — und **damit verschwindet jede Meldung
// darüber**, bevor jemand sie angesehen hat. Über den Umweg
// nachricht → absender gilt dasselbe fürs eigene Konto: Wer belästigt,
// löscht sein Konto und die Meldungen darüber sind weg.
//
// Beim Prüfen kam ein zweites, unabhängiges Problem heraus: Der
// Betreiber-Bereich sagt im Kommentar „Der gemeldete Inhalt steckt als
// `zitat` in der Meldung selbst" — **geschrieben hat dieses Feld keine
// einzige Stelle im Code**. Bei jeder Meldung stand deshalb „Inhalt nicht
// mehr verfügbar", auch wenn es die Anzeige noch gab. Eine Behauptung der
// Seite gegen den Code geprüft, wieder ein Treffer.
//
// Behoben: Der Inhalt wird beim Melden mitgespeichert. Die Datenbankseite
// (SET NULL statt CASCADE) liegt als `supabase/meldungen-bleiben.sql`.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA } =
  require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

function db() {
  const d = defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] })
  d.meldungen = []
  return d
}

async function meldeErstenJob(page, daten) {
  await setupDashboard(page.context(), { user: SCHUELER, db: daten })
  await page.goto('/dashboard-schueler.html')
  await expect(page.locator('#view-jobs .job-card').first()).toBeVisible({ timeout: 30_000 })
  await page.locator('#view-jobs .job-card h3').first().click()
  await expect(page.locator('#job-detail-overlay')).toHaveClass(/open/)
  await page.locator('#detail-body [data-melde-job]').click()
  await expect(page.locator('#melde-overlay')).toBeVisible()
  await page.locator('input[name="melde-grund"]').first().check()
  await page.locator('#melde-form button[type=submit]').click()
}

test('eine Job-Meldung hält fest, worum es ging', async ({ page }) => {
  // Vorher wurde nur die id gespeichert. Ist die Anzeige weg, war die
  // Meldung gegenstandslos – und mit CASCADE sogar ganz verschwunden.
  const daten = db()
  await meldeErstenJob(page, daten)

  await expect.poll(() => daten.meldungen.length, { timeout: 15_000 }).toBe(1)
  const m = daten.meldungen[0]
  expect(m.zitat, 'Meldung ohne Kopie des gemeldeten Inhalts').toBeTruthy()
  expect(m.zitat.length).toBeGreaterThan(3)
  // Es ist der Titel der Anzeige, nicht irgendein Platzhalter.
  const angezeigt = await page.locator('#view-jobs .job-card h3').first().textContent()
  expect(m.zitat).toContain(angezeigt.trim())
})

test('der Wortlaut wird nicht unbegrenzt gespeichert', async () => {
  // Ein Feld, in das jemand beliebig viel schreiben kann, ist eine
  // Einladung. Der Wortlaut wird gekürzt.
  const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'melden.js'), 'utf8')
  expect(quelle, 'zitat wird ungekürzt gespeichert').toMatch(/zitat\.trim\(\)\.slice\(0, \d+\)|zitat \? zitat\.trim\(\)\.slice/)
})

test('jede Stelle, die melden anbietet, schickt den Inhalt mit', async () => {
  // Billiger Wächter. Wer einen neuen Melden-Knopf einbaut und `zitat`
  // vergisst, hinterlässt dem Betreiber eine Meldung ohne Gegenstand.
  const ordner = path.join(__dirname, '..', 'js')
  const ohne = []
  for (const datei of fs.readdirSync(ordner).filter(f => f.endsWith('.js') && f !== 'melden.js')) {
    const inhalt = fs.readFileSync(path.join(ordner, datei), 'utf8')
    const aufrufe = inhalt.match(/(?:oeffneMeldeDialog|meldeMitAnmeldung)\(\{[^}]*\}/gs) || []
    aufrufe.forEach(a => { if (!a.includes('zitat')) ohne.push(`js/${datei}: ${a.slice(0, 70)}…`) })
  }
  expect(ohne, 'Melden-Aufruf ohne zitat').toEqual([])
})

test('der Betreiber sieht den Wortlaut in der Meldung', async ({ page }) => {
  const daten = defaultDb({
    profiles: [profilZeile(SCHUELER, { ist_admin: true }), profilZeile(FIRMA)],
    meldungen: [{
      id: 'm1', typ: 'job', melder_id: SCHUELER.id, gemeldet_user_id: FIRMA.id,
      job_id: null,                         // Anzeige geloescht – Meldung bleibt
      nachricht_id: null, grund: 'betrug',
      beschreibung: 'Wollte Geld vorab.',
      zitat: 'Eisverkäufer/in (Sa/So) · Eiscafé Sonne',
      status: 'offen', erstellt_am: '2026-09-01T10:00:00Z',
    }],
  })
  await setupDashboard(page.context(), { user: SCHUELER, db: daten })
  await page.goto('/admin.html')

  const liste = page.locator('#meldung-liste')
  await expect(liste).toContainText('Eisverkäufer/in', { timeout: 30_000 })
  await expect(liste).not.toContainText('Inhalt nicht mehr verfügbar')
  // Ohne job_id darf kein toter Link stehenbleiben.
  await expect(liste.locator('a[href*="job.html"]')).toHaveCount(0)
})

test('die SQL-Datei gegen das Mitlöschen liegt bereit', async () => {
  // Der Code kann eine Kopie aufheben; dass die Meldung selbst bestehen
  // bleibt, kann nur die Datenbank.
  const datei = path.join(__dirname, '..', 'supabase', 'meldungen-bleiben.sql')
  expect(fs.existsSync(datei), 'supabase/meldungen-bleiben.sql fehlt').toBe(true)
  const sql = fs.readFileSync(datei, 'utf8')
  expect(sql).toContain('meldungen_job_id_fkey')
  expect(sql).toContain('meldungen_nachricht_id_fkey')
  expect(sql.toLowerCase()).toContain('on delete set null')
})
