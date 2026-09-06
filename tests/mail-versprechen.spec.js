// Was die Seite über E-Mails verspricht, muss die Einstellung hergeben.
//
// DER BEFUND (4.9.2026): Im leeren Zustand der Bewerbungsliste stand fest
// verdrahtet „Sobald sich jemand bewirbt, steht er hier – und du bekommst
// eine E-Mail."
//
// Ob eine Mail kommt, entscheidet aber `profiles.benachrichtigung`, und
// die Firma stellt das im eigenen Profil selbst ein:
//
//   sofort    Mail bei jeder Bewerbung (DB-Trigger auf `bewerbungen`)
//   taeglich  einmal am Tag gesammelt (Edge Function `mail-digest`)  ← Standard
//   aus       gar keine Mail
//
// Bei „aus" war der Satz schlicht falsch. Die Firma wartete auf eine
// Mail, die nie kommt, während sich unten die Bewerbungen stapeln — und
// ein Schüler wartet derweil auf eine Antwort. Beim Standard „taeglich"
// war er zumindest irreführend: „du bekommst eine E-Mail" klingt nach
// sofort.
//
// Gefunden mit dem Suchmuster, das bisher am meisten gebracht hat:
// Behauptungen der Seite gegen den Code prüfen.

const { test, expect, setupDashboard, warteAufDashboard, FIRMA, defaultDb, profilZeile } = require('./helpers/supabase-fake')

// Eine Firma MIT Anzeige, aber ohne jede Bewerbung – nur so kommt der
// leere Zustand mit dem Mail-Versprechen.
//
// Wichtig: Die Anzeigen aus tests/helpers/fixtures.js gehören einer
// ANDEREN Firma (der öffentlichen Testfirma). Ohne eigene Anzeige läuft
// das Dashboard in den Zweig „Noch keine Anzeige veröffentlicht" – ein
// anderer Fall, der unten eigens geprüft wird.
function dbMitAnzeige(benachrichtigung) {
  const db = defaultDb()
  db.jobs = [{
    id: 'eigen-1', firma_id: FIRMA.id, firma_name: FIRMA.name,
    titel: 'Aushilfe Eistheke', beschreibung: 'Eis verkaufen.', ort: 'München',
    stundenlohn: 13, mindestalter: 15, kategorie: 'Gastronomie',
    arbeitszeit: 'Wochenende', aktiv: true, aufrufe: 3,
    erstellt_am: '2026-09-01T10:00:00Z', lat: null, lon: null, verfuegbarkeit: null,
  }]
  db.bewerbungen = []
  db.profiles = db.profiles.map(p => p.id === FIRMA.id
    ? { ...p, benachrichtigung }
    : p)
  return db
}

// Ganz ohne eigene Anzeige.
function dbOhneAnzeige() {
  const db = defaultDb()
  db.jobs = []
  db.bewerbungen = []
  return db
}

async function zurBewerbungsansicht(page) {
  await page.goto('/dashboard-firma.html')
  await warteAufDashboard(page)
  // Die Seitenleiste ist eingeklappt – erst öffnen, sonst geht der Klick
  // ins Leere (dieselbe Stelle wie in bewerbung-stand.spec.js).
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="bewerbungen"]').click()
  await expect(page.locator('#view-bewerbungen .empty-state')).toBeVisible({ timeout: 20_000 })
}

test('bei „sofort" darf die Seite sofort versprechen', async ({ page }) => {
  await setupDashboard(page.context(), { db: dbMitAnzeige('sofort'), user: FIRMA })
  await zurBewerbungsansicht(page)
  await expect(page.locator('#view-bewerbungen .empty-state')).toContainText('sofort eine E-Mail')
})

test('bei „taeglich" steht da, dass es gesammelt kommt', async ({ page }) => {
  // Das ist der Standard – also der Text, den die meisten Firmen sehen.
  await setupDashboard(page.context(), { db: dbMitAnzeige('taeglich'), user: FIRMA })
  await zurBewerbungsansicht(page)
  const leer = page.locator('#view-bewerbungen .empty-state')
  await expect(leer).toContainText('einmal am Tag')
  await expect(leer).not.toContainText('sofort eine E-Mail')
})

test('ohne Einstellung gilt derselbe Standard wie in der Datenbank', async ({ page }) => {
  // `benachrichtigung` kann NULL sein. Die Spalte hat in der Datenbank
  // den Vorgabewert „taeglich" – die Seite muss denselben annehmen,
  // sonst behauptet sie etwas anderes als das, was passiert.
  await setupDashboard(page.context(), { db: dbMitAnzeige(null), user: FIRMA })
  await zurBewerbungsansicht(page)
  await expect(page.locator('#view-bewerbungen .empty-state')).toContainText('einmal am Tag')
})

test.describe('bei „aus"', () => {
  test('verspricht die Seite keine E-Mail mehr', async ({ page }) => {
    await setupDashboard(page.context(), { db: dbMitAnzeige('aus'), user: FIRMA })
    await zurBewerbungsansicht(page)
    const leer = page.locator('#view-bewerbungen .empty-state')
    await expect(leer).toContainText('ausgeschaltet')
    await expect(leer).not.toContainText('du bekommst eine E-Mail')
    await expect(leer).not.toContainText('sofort eine E-Mail')
  })

  test('und zeigt den Weg, es wieder einzuschalten', async ({ page }) => {
    // Eine Auskunft ohne Ausweg wäre nur die halbe Verbesserung.
    await setupDashboard(page.context(), { db: dbMitAnzeige('aus'), user: FIRMA })
    await zurBewerbungsansicht(page)
    await page.locator('#zu-mail-einstellung').click()
    await expect(page.locator('#profile-benachrichtigung')).toBeVisible({ timeout: 20_000 })
  })
})

test('bei „sofort" und „taeglich" gibt es keinen Einschalt-Knopf', async ({ page }) => {
  await setupDashboard(page.context(), { db: dbMitAnzeige('sofort'), user: FIRMA })
  await zurBewerbungsansicht(page)
  await expect(page.locator('#zu-mail-einstellung')).toHaveCount(0)
})

test('die drei Werte der Auswahl sind genau die, mit denen der Code rechnet', async ({ page }) => {
  // Käme ein vierter Wert dazu, ohne dass mailVersprechen() ihn kennt,
  // fiele er stillschweigend auf den Standardsatz zurück — und die Seite
  // behauptete wieder etwas Falsches.
  await setupDashboard(page.context(), { db: dbMitAnzeige('taeglich'), user: FIRMA })
  await page.goto('/dashboard-firma.html')
  await warteAufDashboard(page)
  const werte = await page.locator('#profile-benachrichtigung option')
    .evaluateAll(os => os.map(o => o.value))
  expect(werte.sort()).toEqual(['aus', 'sofort', 'taeglich'])
})

test.describe('ohne eigene Anzeige', () => {
  // BEIM TESTEN GEFUNDEN: Hat eine Firma noch gar keine Anzeige, sprang
  // `ladeJobs()` vorher heraus, ohne renderBewerbungen() zu erreichen.
  // Die Bewerbungsansicht blieb dadurch DAUERHAFT leer – kein Text, kein
  // Hinweis, nichts. Eine Ansicht, die ewig lädt, sieht aus wie ein
  // Fehler der Seite, und die Firma sucht ihn bei sich.
  test('bleibt die Ansicht nicht leer', async ({ page }) => {
    await setupDashboard(page.context(), { db: dbOhneAnzeige(), user: FIRMA })
    await zurBewerbungsansicht(page)
    await expect(page.locator('#view-bewerbungen .empty-state')).toContainText('erste Anzeige')
  })

  test('und der Weg zur ersten Anzeige steht daneben', async ({ page }) => {
    await setupDashboard(page.context(), { db: dbOhneAnzeige(), user: FIRMA })
    await zurBewerbungsansicht(page)
    await page.locator('#bew-job-posten').click()
    await expect(page.locator('#view-posten')).toBeVisible({ timeout: 20_000 })
  })

  test('und es wird keine E-Mail versprochen, die es noch nicht geben kann', async ({ page }) => {
    await setupDashboard(page.context(), { db: dbOhneAnzeige(), user: FIRMA })
    await zurBewerbungsansicht(page)
    await expect(page.locator('#view-bewerbungen .empty-state')).not.toContainText('E-Mail')
  })
})
