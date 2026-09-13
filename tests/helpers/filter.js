// Filter einstellen wie ein Mensch: Filterfeld öffnen, einstellen, schließen.
//
// Seit dem 13.9.2026 ist das geschlossene Filterfeld wirklich weg
// (`visibility: hidden`), nicht nur aus dem Bild geschoben. Vorher lief
// die Tab-Taste durch seine unsichtbaren Felder – und Tests konnten sie
// direkt ausfüllen, ohne das Feld je zu öffnen. Das ging nur, weil
// Playwright die verschobene Schublade für sichtbar hielt. Ein Besucher
// kann das nicht.
//
// Genau so ist dabei ein Fehler aufgefallen: Der Jugendschutz-Hinweis
// auf jobs.html stand im Filterfeld und war damit für jeden Besucher
// unsichtbar – der Test dazu war trotzdem grün.

const { expect } = require('@playwright/test')

async function imFilter(page, schritte) {
  const panel = page.locator('#filter-panel')
  const warOffen = /\boffen\b/.test((await panel.getAttribute('class')) || '')
  if (!warOffen) {
    await page.locator('#filter-oeffnen').click()
    await expect(panel).toBeVisible()
  }
  await schritte()
  if (!warOffen) {
    await page.locator('#filter-schliessen').click()
    await expect(panel).toBeHidden()
  }
}

module.exports = { imFilter }
