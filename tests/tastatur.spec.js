// Tastaturbedienung & Fokus-Sichtbarkeit.
//
// Hält fest, was js/tastatur.js und der Fokus-Block in css/style.css
// leisten sollen. Der Anlass: bei einer Messung am 23.8. war auf jeder
// Filterseite kein einziges Eingabefeld sichtbar fokussiert, die
// Rollen-Auswahl auf Login/Register war per Tastatur gar nicht erreichbar,
// und keiner der modalen Dialoge reagierte auf Escape.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, ADMIN, warteAufDashboard, warteAufAdmin } = require('./helpers/supabase-fake')

// Prüft für jedes fokussierbare Element, ob ein Tastaturnutzer SIEHT,
// wo er gerade steht — und ob nichts Klickbares unerreichbar ist.
const PRUEFUNG = `(() => {
  const f = []
  const nenne = el => el.tagName.toLowerCase() + (el.id ? '#'+el.id : '')
    + (typeof el.className==='string' && el.className.trim() ? '.'+el.className.trim().split(/\\s+/)[0] : '')
  const sichtbar = el => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  }

  const gesehen = new Set()
  const liste = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [tabindex]')]
    .filter(el => sichtbar(el) && el.tabIndex >= 0 && !el.disabled)

  for (const el of liste) {
    const name = nenne(el)
    if (gesehen.has(name)) continue
    gesehen.add(name)
    const vorher = getComputedStyle(el).boxShadow
    el.focus()
    const nach = getComputedStyle(el)
    const outlineDa = nach.outlineStyle !== 'none' && parseFloat(nach.outlineWidth) > 0
    const shadowNeu = nach.boxShadow !== vorher && nach.boxShadow !== 'none'
    if (!outlineDa && !shadowNeu) f.push('Kein sichtbarer Fokus: ' + name)
    el.blur()
  }

  document.querySelectorAll('[tabindex]').forEach(el => {
    if (el.tabIndex > 0) f.push('Positiver tabindex bringt die Reihenfolge durcheinander: ' + nenne(el))
  })
  document.querySelectorAll('[role=button], [onclick]').forEach(el => {
    const echt = ['A','BUTTON','INPUT','SELECT','TEXTAREA'].includes(el.tagName)
    if (!echt && el.tabIndex < 0) f.push('Klickbar, aber per Tastatur nicht erreichbar: ' + nenne(el))
  })

  const skip = document.querySelector('.skip-link')
  if (!skip) f.push('Kein "Zum Inhalt springen"-Link')
  else if (!document.querySelector(skip.getAttribute('href'))) f.push('Sprunglink zeigt ins Leere: ' + skip.getAttribute('href'))
  return f
})()`

const OEFFENTLICH = [
  '/index.html', '/jobs.html', '/login.html', '/register.html',
  '/job.html?id=aaaaaaaa-0000-4000-8000-000000000001',
  '/jugendarbeitsschutz.html', '/jobideen.html', '/impressum.html', '/datenschutz.html',
  '/forgot-password.html', '/reset-password.html', '/404.html',
]

for (const pfad of OEFFENTLICH) {
  test(`Tastatur: ${pfad}`, async ({ page }) => {
    await setupDashboard(page.context(), {})
    await page.goto(pfad)
    await page.waitForTimeout(800)
    expect(await page.evaluate(PRUEFUNG)).toEqual([])
  })
}

test('Sprunglink führt wirklich in den Inhalt', async ({ page }) => {
  await setupDashboard(page.context(), {})
  await page.goto('/index.html')
  await page.waitForTimeout(500)
  // Erster Tab-Schritt muss den Sprunglink treffen — sonst nützt er nichts.
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.className)).toContain('skip-link')
  // ... und er muss im Blickfeld auftauchen, nicht unsichtbar bleiben.
  // (Er fährt mit einer kurzen Animation ein — die abwarten, sonst misst
  //  man einen Zwischenstand.)
  await page.waitForTimeout(300)
  const oben = await page.evaluate(() => document.querySelector('.skip-link').getBoundingClientRect().top)
  expect(oben).toBeGreaterThanOrEqual(0)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => document.activeElement?.tagName.toLowerCase())).toBe('main')
})

test.describe('Rollen-Auswahl ist ein echter Knopf', () => {
  for (const seite of ['/login.html', '/register.html']) {
    test(`bedienbar per Tastatur: ${seite}`, async ({ page }) => {
      await setupDashboard(page.context(), {})
      await page.goto(seite)
      await page.waitForTimeout(500)
      const tabs = page.locator('.role-tab')
      await expect(tabs).toHaveCount(2)
      // Muss ein <button> sein, sonst reagiert er nicht auf Enter/Leertaste
      expect(await tabs.first().evaluate(el => el.tagName.toLowerCase())).toBe('button')
      // Umschalten per Tastatur ändert die Rolle des Formulars
      await tabs.nth(1).focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(200)
      const form = page.locator('form').first()
      expect(await form.getAttribute('data-role')).toBe('firma')
      expect(await tabs.nth(1).getAttribute('aria-pressed')).toBe('true')
      expect(await tabs.nth(0).getAttribute('aria-pressed')).toBe('false')
    })
  }
})

// Gemeinsame Erwartung an jeden modalen Dialog: Der Fokus springt hinein,
// bleibt drin, Escape schließt, und danach steht man wieder da, wo man war.
async function dialogVerhaeltSichRichtig(page, overlaySel, oeffnen) {
  const vorher = await page.evaluate(() => {
    const a = document.activeElement
    return a ? a.tagName.toLowerCase() + '|' + (a.id || a.className || '') : ''
  })
  await oeffnen()
  await page.waitForTimeout(400)

  const zustand = await page.evaluate(sel => {
    const ov = document.querySelector(sel)
    return {
      offen: !!ov?.classList.contains('open'),
      rolle: ov?.getAttribute('role'),
      modal: ov?.getAttribute('aria-modal'),
      fokusDrin: !!(ov && document.activeElement && ov.contains(document.activeElement)),
    }
  }, overlaySel)
  expect(zustand.offen, 'Dialog ist offen').toBe(true)
  expect(zustand.rolle, 'als Dialog ausgewiesen').toBe('dialog')
  expect(zustand.modal).toBe('true')
  expect(zustand.fokusDrin, 'Fokus springt in den Dialog').toBe(true)

  // Fokus-Falle: 15 Tab-Schritte dürfen den Dialog nicht verlassen.
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab')
    const drin = await page.evaluate(sel =>
      !!document.querySelector(sel)?.contains(document.activeElement), overlaySel)
    expect(drin, `Fokus bleibt im Dialog (Schritt ${i + 1})`).toBe(true)
  }

  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  expect(await page.evaluate(sel =>
    !!document.querySelector(sel)?.classList.contains('open'), overlaySel), 'Escape schließt').toBe(false)

  // Fokus zurück dorthin, wo er vor dem Öffnen war.
  const nachher = await page.evaluate(() => {
    const a = document.activeElement
    return a ? a.tagName.toLowerCase() + '|' + (a.id || a.className || '') : ''
  })
  expect(nachher, 'Fokus kehrt zum Auslöser zurück').toBe(vorher)
}

test('Job-Detail auf der Jobbörse: Dialog-Verhalten', async ({ page }) => {
  await setupDashboard(page.context(), {})
  await page.goto('/jobs.html')
  await page.waitForTimeout(1000)
  await page.locator('[data-detail]').first().focus()
  await dialogVerhaeltSichRichtig(page, '#job-detail-overlay', () => page.keyboard.press('Enter'))
})

test('Job-Karte öffnet auch mit der Leertaste', async ({ page }) => {
  await setupDashboard(page.context(), {})
  await page.goto('/jobs.html')
  await page.waitForTimeout(1000)
  await page.locator('[data-detail]').first().focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(300)
  await expect(page.locator('#job-detail-overlay')).toHaveClass(/open/)
  // Die Leertaste darf dabei nicht die Seite wegscrollen.
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50)
})

test.describe('eingeloggt', () => {
  const db = () => defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true }), profilZeile(FIRMA)] })

  test('Schüler-Dashboard: keine Fokus-Lücken', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER, db: db() })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await page.waitForTimeout(600)
    expect(await page.evaluate(PRUEFUNG)).toEqual([])
  })

  test('Firmen-Dashboard: keine Fokus-Lücken', async ({ page }) => {
    await setupDashboard(page.context(), { user: FIRMA, db: db() })
    await page.goto('/dashboard-firma.html')
    await warteAufDashboard(page)
    await page.waitForTimeout(600)
    expect(await page.evaluate(PRUEFUNG)).toEqual([])
  })

  test('Jobtitel im Dashboard ist per Tastatur erreichbar', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER, db: db() })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await page.waitForTimeout(600)
    const titel = page.locator('.job-titel-btn').first()
    await expect(titel).toBeVisible()
    await titel.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
    await expect(page.locator('#job-detail-overlay')).toHaveClass(/open/)
  })

  test('Job-Detail im Dashboard: Dialog-Verhalten', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER, db: db() })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await page.waitForTimeout(600)
    await page.locator('.job-titel-btn').first().focus()
    await dialogVerhaeltSichRichtig(page, '#job-detail-overlay', () => page.keyboard.press('Enter'))
  })

  test('Seitenmenü: Fokus hinein, Escape zurück', async ({ page }) => {
    await setupDashboard(page.context(), { user: SCHUELER, db: db() })
    await page.goto('/dashboard-schueler.html')
    await warteAufDashboard(page)
    await page.waitForTimeout(400)
    await page.locator('#sidebar-toggle').focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
    expect(await page.evaluate(() =>
      !!document.getElementById('sidebar')?.contains(document.activeElement)), 'Fokus im Menü').toBe(true)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await expect(page.locator('#sidebar')).not.toHaveClass(/open/)
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('sidebar-toggle')
  })
})

// Der Betreiber-Bereich wurde bei sechs Runden Qualitaetsarbeit uebersehen -
// er stand in keiner einzigen dieser Pruefungen. Deshalb hier ausdruecklich
// mit dabei.
test('Tastatur: Admin-Bereich', async ({ page }) => {
  await setupDashboard(page.context(), { user: ADMIN, db: defaultDb({
    profiles: [profilZeile(ADMIN, { ist_admin: true }), profilZeile(SCHUELER), profilZeile(FIRMA)] }) })
  await page.goto('/admin.html')
  await warteAufAdmin(page)
  await page.waitForTimeout(800)
  expect(await page.evaluate(PRUEFUNG)).toEqual([])
})
