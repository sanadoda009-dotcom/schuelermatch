// Job-Detailseite (job.html + js/job-detail.js):
// Rendern, dynamischer Titel/Meta, JSON-LD JobPosting (Google Jobs), Fehlerfälle.
const { test, expect, standardAntworten } = require('./helpers/basis')

const JOB_ID = 'aaaaaaaa-0000-4000-8000-000000000002' // Mathe-Nachhilfe

test('rendert Job mit Titel, Lohn, Aufrufen und Bewerben-CTA', async ({ page }) => {
  await page.goto(`/job.html?id=${JOB_ID}`)
  await expect(page.locator('h1')).toHaveText('Mathe-Nachhilfe für 7. Klasse')
  await expect(page.locator('.lohn-highlight')).toHaveText('16 €/Std')
  await expect(page.locator('.job-meta')).toContainText('17 Aufrufe')
  await expect(page.getByRole('link', { name: /Kostenlos registrieren/ })).toBeVisible()
  await expect(page).toHaveTitle('Mathe-Nachhilfe für 7. Klasse – SchülerMatch')
})

test('JSON-LD JobPosting ist vorhanden und korrekt befüllt', async ({ page }) => {
  await page.goto(`/job.html?id=${JOB_ID}`)
  await expect(page.locator('h1')).toHaveText(/Mathe-Nachhilfe/)

  const ld = await page.locator('script[type="application/ld+json"]').textContent()
  const daten = JSON.parse(ld)
  expect(daten['@type']).toBe('JobPosting')
  expect(daten.title).toBe('Mathe-Nachhilfe für 7. Klasse')
  expect(daten.employmentType).toBe('PART_TIME')
  expect(daten.jobLocation.address.addressLocality).toBe('München')
  expect(daten.baseSalary.value.value).toBe(16)
  expect(daten.directApply).toBe(true)
})

test('zeigt den Bewertungs-Leerzustand, wenn es keine Bewertungen gibt', async ({ page }) => {
  await page.goto(`/job.html?id=${JOB_ID}`)
  await expect(page.locator('body')).toContainText('Noch keine Bewertungen.')
})

test.describe('mit Bewertungen', () => {
  const antworten = standardAntworten()
  antworten.bewertungen = [
    { sterne: 5, kommentar: 'Super nette Familie!', schueler_name: 'Mia', erstellt_am: '2026-06-01T10:00:00Z' },
    { sterne: 4, kommentar: null, schueler_name: null, erstellt_am: '2026-05-01T10:00:00Z' },
  ]
  test.use({ antworten })

  test('zeigt Durchschnitt und Einzelbewertungen', async ({ page }) => {
    await page.goto(`/job.html?id=${JOB_ID}`)
    await expect(page.locator('.bewertung-summary .schnitt')).toHaveText('4.5')
    await expect(page.locator('.bewertung-card')).toHaveCount(2)
    await expect(page.locator('.bewertung-card').first()).toContainText('Super nette Familie!')
    await expect(page.locator('.bewertung-card').first()).toContainText('Mia')
  })
})

test('unbekannte Job-ID zeigt eine hilfreiche Fehlerseite', async ({ page }) => {
  await page.goto('/job.html?id=gibt-es-nicht')
  await expect(page.locator('h1')).toHaveText('Job nicht verfügbar')
  await expect(page.getByRole('link', { name: /Alle aktuellen Jobs/ })).toBeVisible()
})

test('ganz ohne ID: „Job nicht gefunden" mit Rückweg', async ({ page }) => {
  await page.goto('/job.html')
  await expect(page.locator('h1')).toHaveText('Job nicht gefunden')
})
