// Abmelden vom Job-Alarm (26.8.).
//
// Diese Seite wird aus einer E-Mail heraus aufgerufen, von jemandem,
// der gerade genervt ist. Sie muss deshalb drei Dinge können:
//   1. ohne Anmeldung funktionieren — sonst meldet sich niemand ab und
//      markiert die Mail stattdessen als Spam,
//   2. auch ohne Baustellen-Passwort erreichbar sein (kein gate.js),
//   3. bei kaputtem Link etwas Verständliches sagen statt stumm zu
//      bleiben. Mailprogramme schneiden lange Adressen gern ab.
const { test, expect } = require('./helpers/basis')

const TOKEN = 'b3f1c2d4-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

async function zustand(page) {
  return {
    titel: await page.locator('#zustand-titel').innerText(),
    text: await page.locator('#zustand-text').innerText(),
    klasse: await page.locator('#zustand').getAttribute('class'),
  }
}

test('mit gültigem Token wird abgemeldet', async ({ page }) => {
  let gerufen = null
  await page.route('**/rest/v1/rpc/job_alarm_abmelden', async route => {
    gerufen = route.request().postDataJSON()
    await route.fulfill({ status: 204, contentType: 'application/json', body: '' })
  })

  await page.goto(`/job-alarm-aus.html?token=${TOKEN}`)
  await expect(page.locator('#zustand-titel')).toHaveText('Erledigt')

  const z = await zustand(page)
  expect(z.text).toContain('keine E-Mails mehr')
  expect(z.klasse, 'Erfolg wird nicht als Fehler dargestellt').not.toContain('fehler')
  expect(gerufen, 'der Token wird an die Datenbank durchgereicht').toEqual({ p_token: TOKEN })
})

test('ohne Token kommt eine verständliche Meldung', async ({ page }) => {
  // Nichts darf an die Datenbank gehen, wenn der Link kaputt ist.
  let gerufen = false
  await page.route('**/rest/v1/rpc/job_alarm_abmelden', async route => {
    gerufen = true
    await route.fulfill({ status: 204, body: '' })
  })

  await page.goto('/job-alarm-aus.html')
  const z = await zustand(page)
  expect(z.titel).toContain('unvollständig')
  expect(z.text, 'erklärt, was zu tun ist').toContain('E-Mail')
  expect(z.klasse).toContain('fehler')
  expect(gerufen, 'ohne Token wird gar nicht erst gefragt').toBe(false)
})

test('ein abgeschnittener Token wird als solcher erkannt', async ({ page }) => {
  // Genau der Fall, den Mailprogramme verursachen.
  await page.goto('/job-alarm-aus.html?token=b3f1c2d4-5a6b-4c7d')
  expect((await zustand(page)).titel).toContain('unvollständig')
})

test('bei einem Serverfehler bleibt die Seite nicht stumm', async ({ page }) => {
  await page.route('**/rest/v1/rpc/job_alarm_abmelden', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) }))

  await page.goto(`/job-alarm-aus.html?token=${TOKEN}`)
  await expect(page.locator('#zustand-titel')).toHaveText(/nicht geklappt/)

  const z = await zustand(page)
  expect(z.text, 'nennt einen zweiten Weg').toContain('Dashboard')
  expect(z.klasse).toContain('fehler')
})

test('die Seite ist ohne Baustellen-Passwort erreichbar', async ({ page }) => {
  // Der Gate-Bypass der Test-Basis wird hier absichtlich ausgehebelt,
  // damit die Prüfung etwas wert ist.
  await page.addInitScript(() => { try { sessionStorage.removeItem('sm-zugang-ok') } catch {} })
  await page.goto(`/job-alarm-aus.html?token=${TOKEN}`)

  await expect(page.locator('#sm-gate'), 'kein Passwort-Overlay').toHaveCount(0)
  await expect(page.locator('h1')).toHaveText('Job-Alarm abbestellen')
})

test('die Seite bittet Suchmaschinen, sie nicht aufzunehmen', async ({ page }) => {
  await page.goto(`/job-alarm-aus.html?token=${TOKEN}`)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})
