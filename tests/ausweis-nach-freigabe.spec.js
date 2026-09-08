// „Dein Dokument haben wir direkt wieder gelöscht" — stimmt das? (5.9.2026)
//
// Die Freischalt-Mail sagt einem Kind wörtlich:
//
//   „Übrigens: Dein hochgeladenes Dokument haben wir nach der Prüfung
//    direkt wieder gelöscht."
//
// Im Betreiber-Bereich stimmt das: `entscheide()` in js/admin.js löscht
// die Dateien ZUERST und bricht ab, wenn das misslingt — erst danach
// wird `verifiziert` gesetzt. Sauber gebaut.
//
// ABER die Mail verschickt kein Knopf, sondern ein Trigger auf
// `profiles` (profil_verifiziert_mail, AFTER UPDATE OF verifiziert). Der
// feuert bei JEDEM Wechsel false→true — auch wenn jemand `verifiziert`
// direkt im SQL-Editor setzt. Dann geht die Zusage raus und das Dokument
// bleibt liegen.
//
// Genau das ist passiert. Am 5.9.2026 in der laufenden Datenbank gezählt:
// zwei Dateien in der Ablage `verifizierung`, beide bei bereits
// VERIFIZIERTEN Schülern, hochgeladen am 1. und 5. Juli. Bei beiden steht
// der Pfad noch im Profil — der Admin-Knopf setzt ihn auf NULL, war also
// nicht im Spiel.
//
// Dasselbe Muster wie viermal zuvor, eine Ebene höher: Die Zusage hängt
// am Browser, die Mail, die sie ausspricht, an der Datenbank.
//
// Die zwei Dateien habe ich NICHT angefasst — Ausweisdokumente von
// Minderjährigen, das Löschen ist endgültig, die Entscheidung gehört
// Sanad. Hier steht, was der Code künftig tut.

const { test, expect, setupDashboard, warteAufAdmin, ADMIN, SCHUELER, defaultDb, profilZeile } = require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = p => fs.readFileSync(path.join(WURZEL, p), 'utf8')

function db({ verifiziert, mitDokument }) {
  const d = defaultDb()
  d.profiles = d.profiles.map(p => p.id === SCHUELER.id
    ? { ...p, verifiziert,
        schuelerausweis_url: mitDokument ? `${SCHUELER.id}/schuelerausweis.jpg` : null,
        schulbestaetigung_url: null }
    : p)
  d.profiles.push(profilZeile(ADMIN, { ist_admin: true }))
  return d
}

async function zumBetreiber(page) {
  await page.goto('/admin.html')
  await warteAufAdmin(page)
}

test.describe('im Betreiber-Bereich', () => {
  test('ein übriggebliebenes Dokument fällt auf', async ({ page }) => {
    await setupDashboard(page.context(), {
      db: db({ verifiziert: true, mitDokument: true }), user: ADMIN })
    await zumBetreiber(page)
    const hinweis = page.locator('#admin-dok-hinweis')
    await expect(hinweis).toBeVisible({ timeout: 20_000 })
    await expect(hinweis).toContainText('Ausweisdokument')
    // Und der Grund, warum es zählt.
    await expect(hinweis).toContainText('gelöscht')
  })

  test('und steht als eigene Zahl in der Übersicht', async ({ page }) => {
    await setupDashboard(page.context(), {
      db: db({ verifiziert: true, mitDokument: true }), user: ADMIN })
    await zumBetreiber(page)
    await expect(page.locator('#dok-uebrig')).toContainText('1', { timeout: 20_000 })
  })

  test('im Normalfall steht da nichts', async ({ page }) => {
    // Ein Hinweis, der immer da ist, wird übersehen.
    await setupDashboard(page.context(), {
      db: db({ verifiziert: true, mitDokument: false }), user: ADMIN })
    await zumBetreiber(page)
    await expect(page.locator('#admin-dok-hinweis')).toBeHidden()
    await expect(page.locator('#dok-uebrig')).toHaveCount(0)
  })

  test('ein wartender Schüler ist kein übriggebliebenes Dokument', async ({ page }) => {
    // Dokument da, aber noch NICHT verifiziert — das ist der normale
    // Fall „zu prüfen" und darf nicht als Fehler erscheinen.
    await setupDashboard(page.context(), {
      db: db({ verifiziert: false, mitDokument: true }), user: ADMIN })
    await zumBetreiber(page)
    await expect(page.locator('#admin-dok-hinweis')).toBeHidden()
  })
})

test.describe('die Zusage aus der Mail', () => {
  test('steht wirklich in der Mail-Funktion', async () => {
    // Ohne diesen Satz wäre die ganze Runde gegenstandslos. Verschwindet
    // er, muss auch der Hinweis im Betreiber-Bereich neu gedacht werden.
    const fn = lies('supabase/functions/mail-ereignis/index.ts')
    expect(fn).toContain('direkt wieder gelöscht')
  })

  test('und der Betreiber-Knopf hält sie ein', async () => {
    // Erst löschen, dann freischalten — und bei einem Fehler abbrechen.
    // Andersherum wäre die Zusage schon raus, bevor das Löschen scheitert.
    const quelle = lies('js/admin.js')
    const iLoeschen = quelle.indexOf("storage.from('verifizierung').remove")
    const iSetzen = quelle.indexOf('verifiziert: freischalten')
    expect(iLoeschen).toBeGreaterThan(0)
    expect(iSetzen).toBeGreaterThan(iLoeschen)
    expect(quelle).toContain('Dokument konnte nicht gelöscht werden')
  })
})

test.describe('die SQL-Datei zieht die Zusage in die Datenbank', () => {
  const sql = lies('supabase/ausweis-weg-bei-freigabe.sql')
  const wirksam = sql.slice(sql.indexOf('create or replace function'),
                            sql.indexOf('-- DIE ZWEI ALTEN DATEIEN'))

  test('greift nur beim Wechsel auf verifiziert', async () => {
    // Bei jedem Speichern zu löschen wäre falsch: Ein wartender Schüler
    // verlöre sein gerade hochgeladenes Dokument.
    expect(wirksam).toMatch(/new\.verifiziert is true/)
    expect(wirksam).toMatch(/coalesce\(old\.verifiziert, false\) is false/)
  })

  test('räumt Ablage und Profil auf', async () => {
    expect(wirksam).toContain('delete from storage.objects')
    expect(wirksam).toContain("bucket_id = 'verifizierung'")
    expect(wirksam).toMatch(/new\.schuelerausweis_url\s*:=\s*null/)
    expect(wirksam).toMatch(/new\.schulbestaetigung_url\s*:=\s*null/)
  })

  test('sagt, dass die zwei alten Dateien Sanads Entscheidung sind', async () => {
    // Ich lösche keine Ausweisdokumente von Minderjährigen auf eigene
    // Faust — aber verschweigen darf ich sie auch nicht.
    expect(sql).toContain('NICHT angefasst')
    expect(sql).toMatch(/Entscheidung gehoert dir|Entscheidung gehört dir/)
  })
})
