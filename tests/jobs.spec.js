// Öffentliche Jobbörse (jobs.html + js/jobs.js):
// Rendern, Suche (inkl. Synonyme), Kategorie-Pills, Filter, Sortierung,
// URL-Sync/Deep-Links, Empty-State mit Reset, Job-Detail-Modal, NEU-Badge.
const { test, expect } = require('./helpers/basis')

test.beforeEach(async ({ page }) => {
  await page.goto('/jobs.html')
  await expect(page.locator('.job-card')).toHaveCount(4) // alle Fixtures geladen
})

test('zeigt alle Jobs mit Zähler, Lohn und Kategorie-Chip', async ({ page }) => {
  await expect(page.locator('#jobs-count')).toHaveText('4 Jobs gefunden')
  const ersteKarte = page.locator('.job-card').first()
  await expect(ersteKarte).toContainText('Service-Aushilfe im Café Sonnenschein')
  await expect(ersteKarte).toContainText('14 €/Std')
  await expect(ersteKarte.locator('.kategorie-chip')).toHaveText('Gastronomie')
})

test('NEU-Badge nur auf frischen Jobs (< 72h)', async ({ page }) => {
  await expect(page.locator('.neu-badge')).toHaveCount(1)
  await expect(page.locator('.job-card').first().locator('.neu-badge')).toBeVisible()
})

test('Direkte Suche filtert und schreibt die URL', async ({ page }) => {
  await page.locator('#filter-suche').fill('Nachhilfe')
  await expect(page.locator('.job-card')).toHaveCount(1)
  await expect(page.locator('#jobs-count')).toHaveText('1 Job gefunden')
  await expect(page.locator('.job-card')).toContainText('Mathe-Nachhilfe')
  await expect(page).toHaveURL(/q=Nachhilfe/)
})

test('Synonym-Suche: „kellner" findet Gastronomie, „gassi" findet Tierbetreuung', async ({ page }) => {
  await page.locator('#filter-suche').fill('kellner')
  await expect(page.locator('.job-card')).toHaveCount(1)
  await expect(page.locator('.job-card')).toContainText('Café Sonnenschein')

  await page.locator('#filter-suche').fill('gassi')
  await expect(page.locator('.job-card')).toHaveCount(1)
  await expect(page.locator('.job-card')).toContainText('Hunde ausführen')
})

test('Kategorie-Pills filtern; „Alle" hebt den Filter wieder auf', async ({ page }) => {
  await page.locator('#kategorie-pills .pill', { hasText: 'Verkauf' }).click()
  await expect(page.locator('.job-card')).toHaveCount(1)
  await expect(page.locator('.job-card')).toContainText('Getränkemarkt')
  await expect(page).toHaveURL(/kategorie=Verkauf/)

  await page.locator('#kategorie-pills .pill', { hasText: 'Alle' }).click()
  await expect(page.locator('.job-card')).toHaveCount(4)
})

test('Ort-, Alters-, Lohn- und Arbeitszeit-Filter kombinieren korrekt', async ({ page }) => {
  await page.locator('#filter-ort').fill('münchen')
  await expect(page.locator('.job-card')).toHaveCount(3) // Augsburg fliegt raus

  await page.locator('#filter-alter').selectOption('14')
  await expect(page.locator('.job-card')).toHaveCount(1) // nur Hunde (ab 13)
  await expect(page.locator('.job-card')).toContainText('Hunde ausführen')

  await page.locator('#filter-alter').selectOption('')
  await page.locator('#filter-gehalt').selectOption('14')
  await expect(page.locator('.job-card')).toHaveCount(2) // Café 14 + Nachhilfe 16

  await page.locator('#filter-arbeitszeit').selectOption('Wochenende')
  await expect(page.locator('.job-card')).toHaveCount(1)
  await expect(page.locator('.job-card')).toContainText('Café Sonnenschein')
})

test('Sortierung „Höchster Lohn" und „Niedrigstes Mindestalter"', async ({ page }) => {
  await page.locator('#sortierung').selectOption('lohn')
  await expect(page.locator('.job-card h3').first()).toHaveText('Mathe-Nachhilfe für 7. Klasse') // 16 €

  await page.locator('#sortierung').selectOption('alter')
  await expect(page.locator('.job-card h3').first()).toHaveText('Hunde ausführen am Nachmittag') // ab 13
})

test('Deep-Link ?q=&kategorie= stellt Filterzustand wieder her', async ({ page }) => {
  await page.goto('/jobs.html?q=mathe&kategorie=Nachhilfe')
  await expect(page.locator('#filter-suche')).toHaveValue('mathe')
  await expect(page.locator('#kategorie-pills .pill.active')).toHaveText('Nachhilfe')
  await expect(page.locator('.job-card')).toHaveCount(1)
})

test('Kein Treffer: Empty-State mit funktionierendem „Filter zurücksetzen"', async ({ page }) => {
  await page.locator('#filter-suche').fill('astronaut auf dem mond')
  await expect(page.locator('.empty-state')).toContainText('Keine Jobs passen zu diesem Filter.')
  await expect(page.locator('#jobs-count')).toHaveText('0 Jobs gefunden')

  await page.locator('#filter-reset').click()
  await expect(page.locator('.job-card')).toHaveCount(4)
  await expect(page.locator('#filter-suche')).toHaveValue('')
})

test('Klick auf Karte öffnet Detail-Modal mit Beschreibung und CTA', async ({ page }) => {
  await page.locator('.job-card', { hasText: 'Mathe-Nachhilfe' }).click()
  const modal = page.locator('#job-detail-overlay')
  await expect(modal).toHaveClass(/open/)
  await expect(page.locator('#detail-titel')).toHaveText('Mathe-Nachhilfe für 7. Klasse')
  await expect(page.locator('#detail-body')).toContainText('Geduld wichtiger als Einser-Zeugnis')
  await expect(modal.locator('a[href^="job.html?id="]')).toBeVisible()

  await page.locator('#detail-close').click()
  await expect(modal).not.toHaveClass(/open/)
})

test('Job-Karte ist per Tastatur bedienbar (Enter öffnet Detail)', async ({ page }) => {
  await page.locator('.job-card').first().focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#job-detail-overlay')).toHaveClass(/open/)
})

test('Deep-Link ?job= öffnet das Modal direkt', async ({ page }) => {
  await page.goto('/jobs.html?job=aaaaaaaa-0000-4000-8000-000000000003')
  await expect(page.locator('#job-detail-overlay')).toHaveClass(/open/)
  await expect(page.locator('#detail-titel')).toHaveText('Regale einräumen im Getränkemarkt')
})
