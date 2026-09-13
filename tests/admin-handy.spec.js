// Der Betreiber-Bereich auf dem Handy (13.9.2026).
//
// DER BEFUND, beim Durchfotografieren aller Bereiche: Am Rechner war er
// in Ordnung, auf dem Handy unlesbar.
//   - Die automatische Silbentrennung – für Fließtext gedacht, gilt aber
//     auch für Knöpfe – zerhackte die Reiter: „Schü-ler-Verifi-zie-rung"
//     auf vier Zeilen, „Fir-men-Frei-gabe", „Mel-dun-gen". Der vierte
//     Reiter war abgeschnitten.
//   - In der Kopfzeile „← Zum Da-sh-board" über vier Zeilen und „Lo-gout".
//   - Von drei Zahlen rutschte die dritte allein in eine zweite Reihe.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, ADMIN, warteAufAdmin } =
  require('./helpers/supabase-fake')

test.use({ viewport: { width: 390, height: 844 } })

async function bereich(page) {
  await setupDashboard(page.context(), {
    user: ADMIN,
    db: defaultDb({ profiles: [profilZeile(ADMIN, { ist_admin: true }), profilZeile(SCHUELER), profilZeile(FIRMA)] }),
  })
  await page.goto('/admin.html')
  await warteAufAdmin(page)
}

// Wie viele Zeilen belegt der Text eines Elements?
const zeilen = el => {
  const r = document.createRange()
  r.selectNodeContents(el)
  return new Set([...r.getClientRects()].map(k => Math.round(k.top))).size
}

test('jeder Reiter steht auf einer Zeile', async ({ page }) => {
  await bereich(page)
  const reiter = await page.locator('.admin-tab').evaluateAll((els, fn) => {
    const z = new Function('return ' + fn)()
    return els.map(e => ({ text: e.firstChild.textContent.trim(), zeilen: z(e.firstChild.parentElement) }))
  }, zeilen.toString())
  expect(reiter.length).toBe(4)
  const zerhackt = reiter.filter(r => r.zeilen > 1)
  expect(zerhackt, 'Reiter über mehrere Zeilen umgebrochen').toEqual([])
})

test('auch der vierte Reiter ist erreichbar', async ({ page }) => {
  await bereich(page)
  const letzter = page.locator('.admin-tab[data-tab="statistik"]')
  await letzter.click()
  await expect(letzter).toHaveClass(/active/)
  await expect(page.locator('#panel-statistik')).toBeVisible()
})

test('„Zum Dashboard" und „Logout" bleiben ganz', async ({ page }) => {
  await bereich(page)
  for (const sel of ['.admin-topbar .ll-zurueck', '#logout-btn']) {
    const n = await page.locator(sel).evaluate((el, fn) => new Function('return ' + fn)()(el), zeilen.toString())
    expect(n, `${sel} umgebrochen`).toBe(1)
  }
})

test('die drei Zahlen stehen in einer Reihe', async ({ page }) => {
  await bereich(page)
  const reihen = await page.evaluate(() =>
    new Set([...document.querySelectorAll('#admin-stats .stat-box')].map(b => Math.round(b.getBoundingClientRect().top))).size)
  expect(reihen).toBe(1)
})

test('keine Seite scrollt seitlich', async ({ page }) => {
  await bereich(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(0)
})
