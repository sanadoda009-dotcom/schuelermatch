// Statische Basics: 404-Seite, robots.txt, sitemap.xml, Rechtsseiten.
const { test, expect } = require('./helpers/basis')

test('404-Seite ist gebrandet und verlinkt zurück', async ({ page }) => {
  await page.goto('/404.html')
  await expect(page.locator('body')).toContainText('404')
  await expect(page.getByRole('link', { name: /Jobs/i }).first()).toBeVisible()
  // noindex, damit Google die Fehlerseite nicht listet
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('robots.txt sperrt die Dashboards, erlaubt den Rest', async ({ request }) => {
  const res = await request.get('/robots.txt')
  expect(res.ok()).toBeTruthy()
  const text = await res.text()
  expect(text).toContain('Disallow: /dashboard-schueler.html')
  expect(text).toContain('Disallow: /dashboard-firma.html')
  expect(text).toContain('Sitemap:')
})

test('sitemap.xml ist gültiges XML und enthält die öffentlichen Seiten', async ({ request }) => {
  const res = await request.get('/sitemap.xml')
  expect(res.ok()).toBeTruthy()
  const xml = await res.text()
  expect(xml).toContain('<urlset')
  expect(xml).toContain('https://schuelermatch.de/jobs.html')
  expect(xml).toContain('https://schuelermatch.de/')
})

test('Impressum und Datenschutz sind erreichbar und befüllt', async ({ page }) => {
  await page.goto('/impressum.html')
  await expect(page.locator('body')).toContainText('Impressum')
  await page.goto('/datenschutz.html')
  await expect(page.locator('body')).toContainText('Datenschutz')
  await expect(page.locator('body')).toContainText('DSGVO')
})

test('alle öffentlichen Seiten laden ohne Konsolen-Fehler', async ({ page }) => {
  const seiten = ['/index.html', '/jobs.html', '/login.html', '/register.html', '/jugendarbeitsschutz.html', '/impressum.html', '/datenschutz.html']
  const fehler = []
  page.on('console', msg => {
    if (msg.type() === 'error') fehler.push(`${page.url()}: ${msg.text()}`)
  })
  page.on('pageerror', err => fehler.push(`${page.url()}: ${err.message}`))

  for (const seite of seiten) {
    await page.goto(seite, { waitUntil: 'networkidle' })
  }
  expect(fehler).toEqual([])
})
