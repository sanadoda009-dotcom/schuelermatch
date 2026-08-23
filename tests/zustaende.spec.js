// Fehler- und Leerzustände.
//
// Anlass (Messung am 23.8.): Bei einer Server-Störung bekam man überall
// die Botschaft "Aktuell keine Jobs" – die schlimmste aller Antworten,
// weil sie glaubwürdig klingt. Ohne Netz blieben die grauen Platzhalter
// für immer stehen. Und eingeloggte Nutzer landeten in einer endlosen
// Weiterleitungsschleife, weil ein fehlgeschlagener Profil-Abruf wie
// "falsche Rolle" behandelt wurde.
//
// Diese Tests halten die drei Regeln fest, die daraus folgen:
//   1. Eine Störung sagt, dass sie eine Störung ist – und bietet einen
//      Weg nach vorn ("Nochmal versuchen").
//   2. Eine Störung wird nie als Leerzustand ausgegeben.
//   3. Ein Leerzustand ist keine Sackgasse.
const { test, expect, bypassGate, seedSession, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA, warteAufDashboard } = require('./helpers/supabase-fake')

const HOST = 'blufrvuskqiloslyxjkx.supabase.co'
const LEER_BEHAUPTUNG = /keine (jobs|anzeige|einzige)|nichts dabei|schau bald/i

// Server antwortet, aber mit einem Fehler.
async function serverKaputt(context) {
  await context.route(`https://${HOST}/rest/v1/**`, route =>
    route.fulfill({ status: 500, contentType: 'application/json',
      body: JSON.stringify({ message: 'Datenbank nicht erreichbar' }) }))
}

async function inhalt(page, sel) {
  return page.evaluate(s => (document.querySelector(s)?.innerText || '').trim(), sel)
}

test.describe('Störung sieht wie eine Störung aus', () => {
  test('Jobbörse', async ({ page }) => {
    await bypassGate(page.context())
    await serverKaputt(page.context())
    await page.goto('/jobs.html')
    const grid = page.locator('#jobs-grid')
    await expect(grid.locator('.fehler-state')).toBeVisible({ timeout: 15_000 })
    await expect(grid.getByRole('button', { name: /nochmal versuchen/i })).toBeVisible()
    // Darf sich NICHT als "es gibt hier nichts" ausgeben.
    expect(await inhalt(page, '#jobs-grid')).not.toMatch(LEER_BEHAUPTUNG)
  })

  test('Startseite', async ({ page }) => {
    await bypassGate(page.context())
    await serverKaputt(page.context())
    await page.goto('/index.html')
    const grid = page.locator('#preview-jobs-grid')
    await expect(grid.locator('.fehler-state')).toBeVisible({ timeout: 15_000 })
    expect(await inhalt(page, '#preview-jobs-grid')).not.toMatch(LEER_BEHAUPTUNG)
  })

  test('Job-Detail', async ({ page }) => {
    await bypassGate(page.context())
    await serverKaputt(page.context())
    await page.goto('/job.html?id=aaaaaaaa-0000-4000-8000-000000000001')
    await expect(page.locator('.fehler-state')).toBeVisible({ timeout: 15_000 })
    // Früher blieb hier für immer "Lade Job..." stehen.
    expect(await inhalt(page, 'main')).not.toMatch(/lade job/i)
  })

  for (const [name, user, seite] of [
    ['Schüler-Dashboard', SCHUELER, '/dashboard-schueler.html'],
    ['Firmen-Dashboard', FIRMA, '/dashboard-firma.html'],
  ]) {
    test(name, async ({ page }) => {
      await bypassGate(page.context())
      await seedSession(page.context(), user)
      await serverKaputt(page.context())
      await page.goto(seite)
      await expect(page.locator('.fehler-state')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('button', { name: /nochmal versuchen/i })).toBeVisible()
    })
  }
})

test('gelöschte Anzeige ist keine Störung', async ({ page }) => {
  // Feiner, aber wichtiger Unterschied: Ein toter Link darf nicht als
  // "Verbindungsproblem" erscheinen – sonst versucht es jemand ewig neu,
  // obwohl die Anzeige einfach weg ist. (Genau das ging beim Umbau am
  // 23.8. kurzzeitig kaputt und wurde vom Test gefangen.)
  // Fake-DB antwortet normal – sie kennt diese ID nur nicht.
  await setupDashboard(page.context(), {})
  await page.goto('/job.html?id=gibt-es-nicht')
  await expect(page.locator('h1')).toHaveText('Job nicht verfügbar')
  await expect(page.locator('.fehler-state')).toHaveCount(0)
})

test.describe('keine Weiterleitungsschleife bei Störung', () => {
  for (const [name, user, seite] of [
    ['Schüler', SCHUELER, 'dashboard-schueler.html'],
    ['Firma', FIRMA, 'dashboard-firma.html'],
  ]) {
    test(`${name} bleibt stehen, wo er ist`, async ({ page }) => {
      await bypassGate(page.context())
      await seedSession(page.context(), user)
      await serverKaputt(page.context())
      const aufrufe = []
      page.on('framenavigated', f => { if (f === page.mainFrame()) aufrufe.push(f.url()) })
      await page.goto('/' + seite)
      await page.waitForTimeout(5000)
      // Ein einziger Aufruf – vorher waren es endlos viele.
      expect(aufrufe.length, 'Seite lädt sich nicht immer wieder neu').toBeLessThanOrEqual(2)
      // Und eine Firma landet nicht im Schüler-Dashboard.
      expect(page.url()).toContain(seite)
    })
  }
})

test.describe('Leerzustand ist keine Sackgasse', () => {
  // Jeder leere Bereich muss mindestens einen Weg nach vorn anbieten.
  async function hatWegNachVorn(page, sel) {
    return page.evaluate(s => {
      const el = document.querySelector(s)
      if (!el) return false
      return [...el.querySelectorAll('button, a[href]')]
        .some(b => (b.textContent || '').trim().length > 0)
    }, sel)
  }

  test('Jobbörse ohne einen einzigen Job', async ({ page }) => {
    await bypassGate(page.context())
    await page.route(`https://${HOST}/rest/v1/**`, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.goto('/jobs.html')
    await expect(page.locator('#jobs-grid .empty-state')).toBeVisible({ timeout: 10_000 })
    expect(await hatWegNachVorn(page, '#jobs-grid'), 'Weg nach vorn vorhanden').toBe(true)
  })

  test('Filter trifft keinen Job', async ({ page }) => {
    await bypassGate(page.context())
    await page.goto('/jobs.html')
    await expect(page.locator('#jobs-grid .job-card').first()).toBeVisible({ timeout: 10_000 })
    await page.fill('#filter-suche', 'zzzgibtesnicht')
    await expect(page.locator('#jobs-grid .empty-state')).toBeVisible()
    await expect(page.locator('#filter-reset')).toBeVisible()
  })

  test.describe('eingeloggt', () => {
    test('Schüler ohne passende Jobs', async ({ page }) => {
      await setupDashboard(page.context(), { user: SCHUELER,
        db: defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true })], jobs: [] }) })
      await page.goto('/dashboard-schueler.html')
      await warteAufDashboard(page)
      await expect(page.locator('#jobs-grid .empty-state')).toBeVisible({ timeout: 10_000 })
      expect(await hatWegNachVorn(page, '#jobs-grid'), 'Weg nach vorn vorhanden').toBe(true)
    })

    test('Schüler-Filter trifft nichts', async ({ page }) => {
      await setupDashboard(page.context(), { user: SCHUELER,
        db: defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true })] }) })
      await page.goto('/dashboard-schueler.html')
      await warteAufDashboard(page)
      await page.fill('#filter-suche', 'zzzgibtesnicht')
      await expect(page.locator('#jobs-grid .empty-state')).toBeVisible()
      await expect(page.locator('#filter-reset-leer')).toBeVisible()
    })

    test('Schüler ohne Bewerbungen', async ({ page }) => {
      await setupDashboard(page.context(), { user: SCHUELER,
        db: defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert: true })] }) })
      await page.goto('/dashboard-schueler.html')
      await warteAufDashboard(page)
      await page.click('#sidebar-toggle')
      await page.click('.sidebar-item[data-view="bewerbungen"]')
      const knopf = page.locator('#bew-zu-jobs')
      await expect(knopf).toBeVisible({ timeout: 10_000 })
      // Der Knopf muss auch wirklich zu den Jobs führen.
      await knopf.click()
      await expect(page.locator('#jobs-grid')).toBeVisible()
    })

    test('Firma ohne eigene Anzeigen', async ({ page }) => {
      await setupDashboard(page.context(), { user: FIRMA,
        db: defaultDb({ profiles: [profilZeile(FIRMA)], jobs: [] }) })
      await page.goto('/dashboard-firma.html')
      await warteAufDashboard(page)
      // Firmen starten im Posten-Assistenten – erst zur Job-Liste wechseln.
      await page.click('#sidebar-toggle')
      await page.click('.sidebar-item[data-view="jobs"]')
      const knopf = page.locator('#leer-job-posten')
      await expect(knopf).toBeVisible({ timeout: 10_000 })
      // Der Knopf muss wirklich in den Posten-Assistenten führen.
      await knopf.click()
      await expect(page.locator('.sidebar-item[data-view="posten"]')).toHaveClass(/active/)
    })
  })
})
