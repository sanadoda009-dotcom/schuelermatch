// Die Umschaltung „Bearbeiten | Vorschau" verschwand unter der Kopfzeile (13.9.2026).
//
// DER BEFUND: Im Lebenslauf-Editor auf dem Handy klebt die Umschaltung
// beim Scrollen unter der Kopfzeile – fest bei `top: 52px`. Die Kopfzeile
// war dort aber höher, weil „← Zurück zum Dashboard" und „✓ Alle
// Änderungen gespeichert" umbrachen. Gemessen nach dem Hinunterscrollen:
//
//   360px breit: Kopfzeile 103px hoch, Umschaltung bei 52px → ganz verdeckt
//   390px breit: Kopfzeile  82px hoch → 30 von 36px verdeckt
//   430px breit: Kopfzeile  73px hoch → 21px verdeckt
//
// Wer beim Ausfüllen weiter unten die Vorschau sehen wollte, musste erst
// wieder nach oben. Jetzt misst js/lebenslauf.js die tatsächliche Höhe
// der Kopfzeile, und die Umschaltung klebt genau darunter – egal, wie
// lang die Speichermeldung gerade ist. Auf dem Handy steht außerdem nur
// noch „← Zurück": Das Logo daneben führt zum selben Ziel.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER } = require('./helpers/supabase-fake')

async function editor(page, breite) {
  await page.setViewportSize({ width: breite, height: 800 })
  await setupDashboard(page.context(), { user: SCHUELER, db: defaultDb({ profiles: [profilZeile(SCHUELER)] }) })
  await page.goto('/lebenslauf.html')
  await expect(page.locator('#ll-schritt-name')).not.toBeEmpty({ timeout: 30_000 })
}

async function verdeckt(page) {
  await page.evaluate(() => window.scrollTo(0, 600))
  await page.waitForTimeout(300)
  return page.evaluate(() => {
    const kopf = document.querySelector('.ll-topbar').getBoundingClientRect()
    const um = document.querySelector('.ll-mobil-toggle').getBoundingClientRect()
    return Math.round(kopf.bottom - um.top)
  })
}

for (const breite of [360, 390, 430]) {
  test(`${breite}px: nach dem Scrollen ist die Umschaltung ganz zu sehen`, async ({ page }) => {
    await editor(page, breite)
    expect(await verdeckt(page), 'Pixel der Umschaltung unter der Kopfzeile').toBeLessThanOrEqual(0)
  })
}

test('auch wenn die lange Fehlermeldung die Kopfzeile höher macht', async ({ page }) => {
  // Genau der Fall, in dem ein fester Wert nie stimmen kann.
  await editor(page, 360)
  await page.evaluate(() => {
    document.getElementById('save-status').textContent =
      '⚠ Speichern fehlgeschlagen – Änderungen sind lokal gesichert'
  })
  await page.waitForTimeout(300)
  expect(await verdeckt(page)).toBeLessThanOrEqual(0)
})

test('auf dem Handy steht nur „← Zurück" – das Logo führt ohnehin dorthin', async ({ page }) => {
  await editor(page, 390)
  await expect(page.locator('.ll-zurueck')).toHaveText(/Zurück/)
  await expect(page.locator('.ll-zurueck-lang')).toBeHidden()
  expect(await page.locator('.ll-topbar .logo').getAttribute('href'))
    .toBe(await page.locator('.ll-zurueck').getAttribute('href'))
})

test('am Rechner bleibt der volle Text', async ({ page }) => {
  await editor(page, 1280)
  await expect(page.locator('.ll-zurueck-lang')).toBeVisible()
})
