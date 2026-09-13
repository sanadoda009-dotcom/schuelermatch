// Statische Basics: 404-Seite, robots.txt, sitemap.xml, Rechtsseiten.
const { test, expect } = require('./helpers/basis')

test('404-Seite ist gebrandet und verlinkt zurück', async ({ page }) => {
  await page.goto('/404.html')
  await expect(page.locator('body')).toContainText('404')
  await expect(page.getByRole('link', { name: /Jobs/i }).first()).toBeVisible()
  // noindex, damit Google die Fehlerseite nicht listet
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

/* Wie private Seiten aus Google herausgehalten werden (13.9.2026).
 *
 * Hier stand bis heute „robots.txt sperrt die Dashboards" – der Test
 * verlangte `Disallow: /dashboard-schueler.html`. Das ist die falsche
 * Hälfte: Eine Sperre in robots.txt verhindert nur das LESEN einer Seite,
 * nicht das Aufnehmen ihrer Adresse. Und weil Google die gesperrte Seite
 * nicht lesen darf, sieht es ein noindex darin nie. Die vier gesperrten
 * Seiten hatten gar keins.
 *
 * `admin.html` machte es im selben Projekt schon richtig herum: kein
 * Eintrag in robots.txt, dafür noindex in der Seite. Jetzt alle so.
 */
const fs = require('fs')
const path = require('path')
const WURZEL = path.join(__dirname, '..')

const PRIVAT = ['dashboard-schueler.html', 'dashboard-firma.html', 'forgot-password.html',
  'reset-password.html', 'admin.html', 'lebenslauf.html']

test('private Seiten tragen noindex', async () => {
  const ohne = PRIVAT.filter(f =>
    !/<meta name="robots" content="noindex">/.test(fs.readFileSync(path.join(WURZEL, f), 'utf8')))
  expect(ohne).toEqual([])
})

test('robots.txt sperrt keine Seite, die noindex trägt – sonst sieht Google es nie', async ({ request }) => {
  const res = await request.get('/robots.txt')
  expect(res.ok()).toBeTruthy()
  const text = await res.text()
  expect(text).toContain('Sitemap:')
  const gesperrt = [...text.matchAll(/^Disallow:\s*\/(\S+)/gm)].map(m => m[1])
  const widerspruch = gesperrt.filter(f =>
    fs.existsSync(path.join(WURZEL, f))
    && /name="robots"[^>]*noindex/.test(fs.readFileSync(path.join(WURZEL, f), 'utf8')))
  expect(widerspruch).toEqual([])
})

test('jede Seite ist entweder in der Sitemap, auf noindex oder bewusst dynamisch', async () => {
  // Der Wächter über alle Seiten: Eine neue Seite muss sich entscheiden.
  const sitemap = fs.readFileSync(path.join(WURZEL, 'sitemap.xml'), 'utf8')
  const ignoriert = fs.readFileSync(path.join(WURZEL, '.vercelignore'), 'utf8')
    .split('\n').map(z => z.trim()).filter(z => z && !z.startsWith('#'))
  // job.html und firma.html bekommen ihren Inhalt erst über ?id= und
  // setzen noindex selbst, wenn es ihn nicht gibt (siehe
  // verschwundene-anzeige.spec.js und firmenseite.spec.js).
  const DYNAMISCH = ['job.html', 'firma.html', 'index.html']
  const offen = fs.readdirSync(WURZEL).filter(f => f.endsWith('.html'))
    .filter(f => !ignoriert.includes(f))
    .filter(f => !DYNAMISCH.includes(f))
    .filter(f => !sitemap.includes(`/${f}</loc>`))
    .filter(f => !/name="robots"[^>]*noindex/.test(fs.readFileSync(path.join(WURZEL, f), 'utf8')))
  expect(offen, 'weder in der Sitemap noch auf noindex').toEqual([])
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
