// Schriftschnitte: Was die Seite verlangt, muss geladen sein - und umgekehrt.
// Fehlt ein Schnitt, rechnet der Browser ihn kuenstlich hoch; das sieht
// sichtbar schlechter aus. Ein geladener, nirgends benutzter Schnitt ist
// verschenkte Ladezeit (rund 15-20 KB).
//
// Haeufige Ursache fuer fehlende Schnitte: <b> heisst "fetter ALS der
// Elternwert" - in einem 600er-Element landet das bei 900.
const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA } = require('./helpers/supabase-fake')
const SAMMLE = `(() => {
  const k = new Set()
  document.querySelectorAll('body *').forEach(el => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || !(el.textContent||'').trim()) return
    const fam = (cs.fontFamily||'').split(',')[0].replace(/["']/g,'').trim()
    if (['Bricolage Grotesque','IBM Plex Sans','IBM Plex Mono'].includes(fam)) k.add(fam + ' ' + cs.fontWeight)
  })
  return [...k]
})()`
test('geladene und benutzte Schriftschnitte stimmen ueberein', async ({ page }) => {
  const alle = new Set()
  await setupDashboard(page.context(), {})
  for (const p of ['/index.html','/jobs.html','/login.html','/register.html','/job.html?id=aaaaaaaa-0000-4000-8000-000000000001','/jugendarbeitsschutz.html','/impressum.html','/datenschutz.html','/404.html','/forgot-password.html','/reset-password.html']) {
    await page.goto(p); await page.waitForTimeout(700)
    ;(await page.evaluate(SAMMLE)).forEach(x => alle.add(x))
  }
  const db = defaultDb({ profiles: [profilZeile(SCHUELER, { verifiziert:true, schule:'Gym', klasse:'10. Klasse',
    lebenslauf_bloecke:[{id:'b1',typ:'text',titel:'Über mich',inhalt:'Test'},{id:'b2',typ:'sprachen',titel:'S',sprachen:[{name:'Deutsch',niveau:'C1'}]},{id:'b3',typ:'skillbar',titel:'F',skills:[{name:'Team',wert:70}]}] }), profilZeile(FIRMA)] })
  await setupDashboard(page.context(), { user: SCHUELER, db })
  for (const p of ['/dashboard-schueler.html','/lebenslauf.html']) {
    await page.goto(p); await page.waitForTimeout(2500)
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true }))
    await page.waitForTimeout(400)
    ;(await page.evaluate(SAMMLE)).forEach(x => alle.add(x))
  }
  // Am 25.8. umgestellt: Space Grotesk -> Bricolage Grotesque,
  // Inter -> IBM Plex Sans (passt zum vorhandenen Plex Mono).
  // Grund: Beide alten Schriften stehen auf jeder zweiten generierten
  // Seite; die Seite sollte weniger nach Vorlage aussehen.
  const GELADEN = new Set(['Bricolage Grotesque 600','Bricolage Grotesque 700','IBM Plex Sans 400','IBM Plex Sans 500','IBM Plex Sans 600','IBM Plex Sans 700','IBM Plex Mono 400','IBM Plex Mono 500'])
  const fehlend = [...alle].filter(k => !GELADEN.has(k)).sort()
  const ungenutzt = [...GELADEN].filter(k => !alle.has(k)).sort()

  // Verlangt, aber nicht geladen -> Browser rechnet künstlich hoch (sieht schlechter aus)
  expect(fehlend, 'Schnitte werden verlangt, aber nicht geladen').toEqual([])
  // Geladen, aber nirgends benutzt -> verschenkte Ladezeit (~15-20 KB je Schnitt)
  expect(ungenutzt, 'Schnitte werden geladen, aber nirgends benutzt').toEqual([])
})
