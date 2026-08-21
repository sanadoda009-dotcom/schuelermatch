// Chat im Schüler-Dashboard: Sicherheits-Hinweise für Minderjährige.
// Session + Supabase gefälscht – keine echte DB, keine echten Nachrichten.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, warteAufDashboard } = require('./helpers/supabase-fake')

// Chat entsteht erst nach einer Zusage -> angenommene Bewerbung + Nachrichten anlegen.
function chatDb(nachrichtenTexte) {
  const db = defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] })
  db.bewerbungen = [{
    id: 'bw-chat', job_id: db.jobs[0].id, schueler_id: SCHUELER.id,
    status: 'angenommen', erstellt_am: '2026-08-01T10:00:00Z',
  }]
  db.nachrichten = nachrichtenTexte.map((text, i) => ({
    id: 'n-' + i,
    bewerbung_id: 'bw-chat',
    absender_id: FIRMA.id,          // von der Gegenseite
    text,
    gelesen: true,
    erstellt_am: `2026-08-0${i + 1}T10:00:00Z`,
  }))
  return db
}

async function oeffneChat(page) {
  await warteAufDashboard(page)            // erst wenn init() fertig ist
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="nachrichten"]').click()
  await page.locator('.konv-item').first().click()
  await expect(page.locator('.chat-thread')).toBeVisible({ timeout: 30_000 })
}

test('Chat zeigt die Sicherheits-Regeln (aufklappbar)', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: chatDb(['Hallo, wann kannst du?']) })
  await page.goto('/dashboard-schueler.html')
  await oeffneChat(page)

  const leiste = page.locator('.chat-sicherheit')
  await expect(leiste).toBeVisible()
  await expect(leiste.locator('summary')).toContainText('So chattest du sicher')

  // Aufklappen zeigt die Regeln
  await leiste.locator('summary').click()
  await expect(leiste).toContainText('Triff dich nie allein')
  await expect(leiste).toContainText('nie im Voraus zahlen')
})

test('normale Nachricht löst keine Warnung aus', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: chatDb(['Hallo, passt Samstag um 14 Uhr?']) })
  await page.goto('/dashboard-schueler.html')
  await oeffneChat(page)

  await expect(page.locator('.chat-msg--anderer')).toHaveCount(1)
  await expect(page.locator('.chat-warnung')).toHaveCount(0)
})

test('Nachricht mit Handynummer warnt vor Kontakt außerhalb', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: chatDb(['Schreib mir auf 0170 1234567']) })
  await page.goto('/dashboard-schueler.html')
  await oeffneChat(page)

  await expect(page.locator('.chat-warnung')).toHaveCount(1)
  await expect(page.locator('.chat-warnung')).toContainText('Bleib lieber hier im Chat')
})

test('Nachricht mit Vorkasse warnt vor Abzocke', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: chatDb(['Bitte erst 50 Euro Kaution überweisen']) })
  await page.goto('/dashboard-schueler.html')
  await oeffneChat(page)

  await expect(page.locator('.chat-warnung')).toContainText('im Voraus zahlen')
})

test('Einladung zum Alleintreffen warnt', async ({ page }) => {
  await setupDashboard(page.context(), { user: SCHUELER, db: chatDb(['Komm einfach zu mir nach hause']) })
  await page.goto('/dashboard-schueler.html')
  await oeffneChat(page)

  await expect(page.locator('.chat-warnung')).toContainText('Triff dich nie allein')
})

test('eigene Nachrichten bekommen weder Warnung noch Melden-Knopf', async ({ page }) => {
  const db = chatDb(['Schreib mir auf 0170 1234567'])
  db.nachrichten[0].absender_id = SCHUELER.id   // von mir selbst
  await setupDashboard(page.context(), { user: SCHUELER, db })
  await page.goto('/dashboard-schueler.html')
  await oeffneChat(page)

  await expect(page.locator('.chat-msg--ich')).toHaveCount(1)
  await expect(page.locator('.chat-warnung')).toHaveCount(0)
  await expect(page.locator('[data-melde-nachricht]')).toHaveCount(0)
})
