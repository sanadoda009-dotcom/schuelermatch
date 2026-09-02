// Bewerben ohne Anschreiben (2.9.2026).
//
// ANLASS: Sanads Auftrag zum Jobs- und Bewerbungssystem. Beim Vergleich
// mit Indeed und StepStone fiel auf, dass StepStone „schnelle Bewerbung"
// inzwischen ausdrücklich als Vorteil bewirbt — gemeint ist: ohne
// Anschreiben. Und die Untersuchungen zu Bewerbungsabbrüchen nennen zu
// viele Pflichtfelder als größten Abbruchgrund.
//
// Hier war das Motivationsschreiben ein `required`-Feld. Ein
// Vierzehnjähriger musste also einen Motivationstext schreiben, bevor der
// Absenden-Knopf überhaupt reagierte — für viele genau die Stelle, an der
// man aufgibt.
//
// Jetzt ist es freiwillig. Der Anschreiben-Coach bleibt daneben stehen,
// als Hilfe statt als Hürde. Und weil die Anzeigenseite seit demselben Tag
// „du brauchst kein Anschreiben" verspricht, prüft der letzte Test, dass
// die Seite und der Code dasselbe sagen.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA } =
  require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

// Bewerben setzt voraus: verifiziert, Schule eingetragen, Lebenslauf da.
// Fehlt eins davon, kommt statt des Dialogs nur ein Hinweis.
function db() {
  const d = defaultDb({
    profiles: [
      profilZeile(SCHUELER, {
        verifiziert: true,
        schule: 'Gymnasium Nord',
        lebenslauf_bloecke: [{ id: 'b1', typ: 'text', titel: 'Über mich', inhalt: 'Ich bin zuverlässig.' }],
      }),
      profilZeile(FIRMA),
    ],
  })
  d.bewerbungen = []
  return d
}

async function oeffneBewerbung(page, daten) {
  await setupDashboard(page.context(), { user: SCHUELER, db: daten })
  await page.goto('/dashboard-schueler.html')
  await expect(page.locator('#user-name')).not.toBeEmpty({ timeout: 30_000 })
  const karte = page.locator('#view-jobs .job-card').first()
  await expect(karte).toBeVisible({ timeout: 30_000 })
  await karte.getByRole('button', { name: 'Jetzt bewerben' }).click()
  // Der Dialog ist ein Overlay mit Klasse, kein hidden-Element.
  await expect(page.locator('#bewerbung-overlay')).toHaveClass(/open/)
}

test('das Anschreiben ist kein Pflichtfeld mehr', async ({ page }) => {
  await oeffneBewerbung(page, db())
  const feld = page.locator('#bewerbung-motivation')
  await expect(feld).toBeVisible()
  expect(await feld.getAttribute('required'), 'Anschreiben ist wieder Pflicht').toBeNull()
})

test('man sieht, dass es freiwillig ist', async ({ page }) => {
  // Ein freiwilliges Feld, das nicht als freiwillig zu erkennen ist, wird
  // aus Pflichtgefühl ausgefüllt – und wer nichts weiß, bricht ab.
  await oeffneBewerbung(page, db())
  await expect(page.locator('.feld-freiwillig')).toBeVisible()
  await expect(page.locator('#bewerbung-form .feld-hilfe')).toContainText('ohne')
})

test('eine Bewerbung ohne Anschreiben kommt an', async ({ page }) => {
  // Der eigentliche Punkt. Vorher blockierte der Browser das Absenden.
  const daten = db()
  await oeffneBewerbung(page, daten)
  await page.locator('#bewerbung-form button[type=submit]').click()

  await expect.poll(() => daten.bewerbungen.length, { timeout: 20_000 }).toBe(1)
  // Leer heißt leer – nicht eine leere Zeichenkette, die im
  // Firmen-Dashboard als „Anschreiben vorhanden" durchginge.
  expect(daten.bewerbungen[0].motivationsschreiben).toBeNull()
})

test('mit Anschreiben kommt es weiterhin mit', async ({ page }) => {
  const daten = db()
  await oeffneBewerbung(page, daten)
  await page.locator('#bewerbung-motivation').fill('Ich helfe gern und bin zuverlässig.')
  await page.locator('#bewerbung-form button[type=submit]').click()

  await expect.poll(() => daten.bewerbungen.length, { timeout: 20_000 }).toBe(1)
  expect(daten.bewerbungen[0].motivationsschreiben).toBe('Ich helfe gern und bin zuverlässig.')
})

test('die Hilfe zum Schreiben ist weiterhin da', async ({ page }) => {
  // Freiwillig heißt nicht: allein gelassen. Der Coach bleibt.
  await oeffneBewerbung(page, db())
  await expect(page.locator('#coach-auf')).toBeVisible()
})

test('die Anzeigenseite verspricht nichts, was der Code nicht hält', async () => {
  // Diese Zusage steht seit dem 2.9. unter dem Bewerben-Knopf auf
  // job.html. Sie war in dem Moment, in dem ich sie geschrieben habe,
  // noch falsch – das Feld war weiter `required`. Genau die Sorte Fehler,
  // die dieses Projekt schon dreimal gefunden hat: eine Behauptung der
  // Seite, die der Code nicht deckt.
  const detail = fs.readFileSync(path.join(__dirname, '..', 'js', 'job-detail.js'), 'utf8')
  const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard-schueler.html'), 'utf8')

  const versprichtOhne = /kein Anschreiben/.test(detail)
  const feldPflicht = /<textarea id="bewerbung-motivation"[^>]*\brequired\b/.test(dashboard)

  expect(versprichtOhne && feldPflicht,
    'job.html verspricht „kein Anschreiben", das Feld ist aber Pflicht').toBe(false)
})
