// Der Anschreiben-Coach (27.8.).
//
// `fuer-firmen.html` verspricht: „Bewerbungen mit Substanz … auch von
// Fünfzehnjährigen, die so etwas zum ersten Mal schreiben. **Die
// Plattform hilft ihnen dabei.**"
//
// Geholfen hat sie mit einem Knopf, der einen von drei fertigen
// Beispieltexten ins Feld warf. Bewerben sich fünf Schüler, bekommt der
// Arbeitgeber fünfmal denselben Text — ein Anschreiben, das nichts über
// den Absender verrät, ist wertlos.
//
// Der Ansatz ist jetzt umgekehrt: **Das Gerüst kommt von uns, der
// Inhalt vom Schüler.** Drei kurze Fragen, die mittlere je nach Job-Art
// eine andere, und der Text entsteht aus seinen eigenen Antworten.
const { test, expect } = require('./helpers/basis')

async function modul(page, fn, arg) {
  return page.evaluate(async ({ code, arg }) => {
    const m = await import('/js/anschreiben.js')
    return new Function('m', 'a', 'return (' + code + ')(m, a)')(m, arg)
  }, { code: fn.toString(), arg })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html')
})

test.describe('die Fragen passen zum Job', () => {
  test('immer genau drei — wer sieben Felder sieht, bricht ab', async ({ page }) => {
    const n = await modul(page, m => m.fragenFuer({ kategorie: 'Nachhilfe' }).length)
    expect(n).toBe(3)
  })

  test('bei Nachhilfe wird nach Fächern gefragt', async ({ page }) => {
    const f = await modul(page, m => m.fragenFuer({ kategorie: 'Nachhilfe' })[1].frage)
    expect(f).toMatch(/Fächern/)
  })

  test('bei Babysitten nach Erfahrung mit Kindern', async ({ page }) => {
    const f = await modul(page, m => m.fragenFuer({ kategorie: 'Babysitten' })[1])
    expect(f.frage).toMatch(/Kinder/)
    // Wichtig: „noch nicht" muss ausdrücklich als gute Antwort gelten.
    // Sonst traut sich niemand ohne Erfahrung zu bewerben.
    expect(f.hinweis).toMatch(/noch nicht/)
  })

  test('bei Lieferung nach dem Fortbewegungsmittel', async ({ page }) => {
    const f = await modul(page, m => m.fragenFuer({ kategorie: 'Lieferung & Kurier' })[1].frage)
    expect(f).toMatch(/unterwegs/)
  })

  test('jede Kategorie der Jobbörse hat eine eigene Frage', async ({ page }) => {
    // Läuft eine Kategorie ins Leere, bekommt der Schüler die vage
    // Standardfrage — genau das, was den alten Beispieltext so leer
    // gemacht hat.
    const KATEGORIEN = ['Verkauf', 'Nachhilfe', 'Gastronomie', 'Lieferung & Kurier',
      'Babysitten', 'Haushalt & Garten', 'Büro & Organisation', 'Tierbetreuung',
      'Technik & Computer']
    const standard = await modul(page, m => m.fragenFuer({ kategorie: 'Sonstiges' })[1].frage)

    const wieStandard = []
    for (const k of KATEGORIEN) {
      const f = await modul(page, (m, kat) => m.fragenFuer({ kategorie: kat })[1].frage, k)
      if (f === standard) wieStandard.push(k)
    }
    expect(wieStandard, 'ohne eigene Frage').toEqual([])
  })

  test('„Sonstiges" bekommt eine brauchbare Standardfrage', async ({ page }) => {
    const f = await modul(page, m => m.fragenFuer({ kategorie: 'Sonstiges' })[1])
    expect(f.frage).toBeTruthy()
    // Auch hier: die Hürde niedrig halten.
    expect(f.hinweis).toMatch(/pünktlich|Muss nichts Großes/)
  })

  test('die Zeitfrage nimmt die Verfügbarkeit aus der Anzeige auf', async ({ page }) => {
    const f = await modul(page, m =>
      m.fragenFuer({ kategorie: 'Verkauf', verfuegbarkeit: 'Sa & So, 10–16 Uhr' })[2].hinweis)
    expect(f).toMatch(/Sa & So/)
  })

  test('ohne Verfügbarkeit trotzdem ein Beispiel', async ({ page }) => {
    const f = await modul(page, m => m.fragenFuer({})[2].hinweis)
    expect(f).toMatch(/nachmittags/)
  })
})

test.describe('der Text entsteht aus den eigenen Worten', () => {
  const ANTWORTEN = {
    warum: 'Ich möchte mein erstes eigenes Geld verdienen',
    koennen: 'In Mathe stehe ich auf 2 und erkläre gern',
    zeit: 'Nachmittags ab 15 Uhr und samstags',
  }
  const JOB = { titel: 'Nachhilfe für Unterstufe', firma_name: 'Familie Schmidt', kategorie: 'Nachhilfe' }

  test('alle drei Antworten stehen darin', async ({ page }) => {
    const t = await modul(page, (m, a) =>
      m.baueAnschreiben({ antworten: a.ANTWORTEN, job: a.JOB, name: 'Lena' }), { ANTWORTEN, JOB })
    expect(t).toContain('erstes eigenes Geld')
    expect(t).toContain('In Mathe stehe ich auf 2')
    expect(t).toContain('Nachmittags ab 15 Uhr')
  })

  test('Anrede, Job und Name sitzen an der richtigen Stelle', async ({ page }) => {
    const t = await modul(page, (m, a) =>
      m.baueAnschreiben({ antworten: a.ANTWORTEN, job: a.JOB, name: 'Lena' }), { ANTWORTEN, JOB })
    expect(t.startsWith('Hallo Familie Schmidt,')).toBe(true)
    expect(t).toContain('Nachhilfe für Unterstufe')
    expect(t.trimEnd().endsWith('Lena')).toBe(true)
  })

  test('OHNE Antworten entsteht KEIN Text', async ({ page }) => {
    // Der Kern des Ganzen. Ein leeres Gerüst wäre wieder nur eine
    // Schablone — genau das, was ersetzt wurde.
    const t = await modul(page, (m, a) =>
      m.baueAnschreiben({ antworten: {}, job: a.JOB, name: 'Lena' }), { JOB })
    expect(t).toBe('')
  })

  test('auch bei nur Leerzeichen als Antwort nicht', async ({ page }) => {
    const t = await modul(page, (m, a) => m.baueAnschreiben({
      antworten: { warum: '   ', koennen: '', zeit: '\n' }, job: a.JOB }), { JOB })
    expect(t).toBe('')
  })

  test('eine einzige Antwort reicht schon', async ({ page }) => {
    const t = await modul(page, (m, a) => m.baueAnschreiben({
      antworten: { warum: 'Ich mag Tiere' }, job: a.JOB, name: 'Ben' }), { JOB })
    expect(t).toContain('Ich mag Tiere')
    expect(t).toContain('Ben')
  })

  test('zwei Schüler bekommen NICHT denselben Text', async ({ page }) => {
    // Das war der eigentliche Fehler am alten Beispieltext.
    const [a, b] = await modul(page, (m, j) => [
      m.baueAnschreiben({ antworten: { warum: 'Ich helfe gern im Laden' }, job: j, name: 'Lena' }),
      m.baueAnschreiben({ antworten: { warum: 'Ich will Geld für ein Fahrrad sparen' }, job: j, name: 'Ben' }),
    ], JOB)
    expect(a).not.toBe(b)
  })

  test('ein fehlender Punkt wird ergänzt', async ({ page }) => {
    // Sonst klebt im fertigen Text alles aneinander.
    const t = await modul(page, (m, a) => m.baueAnschreiben({
      antworten: { warum: 'Ich mag Tiere' }, job: a.JOB }), { JOB })
    expect(t).toContain('Ich mag Tiere.')
  })

  test('ein vorhandenes Satzzeichen wird nicht verdoppelt', async ({ page }) => {
    const t = await modul(page, (m, a) => m.baueAnschreiben({
      antworten: { warum: 'Ich mag Tiere!' }, job: a.JOB }), { JOB })
    expect(t).toContain('Ich mag Tiere!')
    expect(t).not.toContain('Tiere!.')
  })

  test('ohne Firmennamen bleibt die Anrede höflich', async ({ page }) => {
    const t = await modul(page, m => m.baueAnschreiben({
      antworten: { warum: 'Klingt gut' }, job: { titel: 'Aushilfe' } }))
    expect(t.startsWith('Hallo,')).toBe(true)
  })
})

test.describe('die Rückmeldung sagt, was noch fehlt', () => {
  const JOB = { titel: 'Nachhilfe für Unterstufe', kategorie: 'Nachhilfe' }

  async function pruefe(page, text) {
    return modul(page, (m, a) => m.pruefeAnschreiben(a.text, a.job), { text, job: JOB })
  }

  test('bei leerem Feld weist sie auf die Fragen hin', async ({ page }) => {
    const r = await pruefe(page, '')
    expect(r[0].text).toMatch(/drei Fragen/)
  })

  test('ein zu kurzer Text wird benannt', async ({ page }) => {
    const r = await pruefe(page, 'Ich will den Job.')
    expect(r.some(p => /kurz/.test(p.text))).toBe(true)
  })

  test('fehlender Bezug zum Job wird benannt', async ({ page }) => {
    // Ein Anschreiben, das überall passen würde, sagt nichts aus.
    const r = await pruefe(page, 'Ich bin zuverlässig und pünktlich und arbeite gern mit anderen zusammen, ich lerne schnell und packe mit an wo es nötig ist. Viele Grüße')
    expect(r.some(p => /um welchen Job/.test(p.text))).toBe(true)
  })

  test('ein guter Text bekommt eine Bestätigung', async ({ page }) => {
    const r = await pruefe(page,
      'Hallo, ich habe eure Anzeige Nachhilfe für Unterstufe gesehen und möchte mich bewerben. ' +
      'In Mathe stehe ich auf 2 und erkläre wirklich gern, meiner kleinen Schwester helfe ich ständig. ' +
      'Nachmittags ab 15 Uhr hätte ich Zeit. Über eine Antwort würde ich mich freuen. Viele Grüße, Lena')
    expect(r).toHaveLength(1)
    expect(r[0].art).toBe('gut')
  })

  test('eine Handynummer im Text wird deutlich gemeldet', async ({ page }) => {
    // Hier wiegt es schwerer als im Chat: Die Nummer eines
    // Minderjährigen stünde dauerhaft in einer Bewerbung, die der
    // Arbeitgeber behält.
    const r = await pruefe(page,
      'Hallo, ich möchte mich auf Nachhilfe für Unterstufe bewerben. Ruf mich an unter 0176 12345678. ' +
      'Ich bin gut in Mathe und habe nachmittags Zeit. Viele Grüße Lena')
    const alarm = r.find(p => p.art === 'achtung')
    expect(alarm).toBeTruthy()
    expect(alarm.text).toMatch(/Handynummer|E-Mail/)
  })

  test('eine harmlose Terminangabe löst keinen Alarm aus', async ({ page }) => {
    // Dieselbe Erkennung wie im Chat, also gilt auch derselbe
    // Fehlalarm-Schutz: „ab 12 03 2026" ist kein Kontaktdatum.
    const r = await pruefe(page,
      'Hallo, ich möchte mich auf Nachhilfe für Unterstufe bewerben. Ich könnte ab 12 03 2026 anfangen, ' +
      'nachmittags ab 15 30 Uhr. In Mathe bin ich gut. Über eine Antwort würde ich mich freuen. Viele Grüße')
    expect(r.some(p => p.art === 'achtung'), 'Fehlalarm').toBe(false)
  })

  test('ein fehlender Schlusssatz wird benannt', async ({ page }) => {
    const r = await pruefe(page,
      'Ich möchte mich auf Nachhilfe für Unterstufe bewerben weil ich gut in Mathe bin und gerne erkläre, ' +
      'ich habe nachmittags ab 15 Uhr Zeit und könnte sofort anfangen')
    expect(r.some(p => /Schlusssatz/.test(p.text))).toBe(true)
  })

  test('sie blockiert nie — es ist seine Bewerbung', async ({ page }) => {
    // Jede Rückmeldung ist ein Hinweis, keine Sperre. Der Absenden-Knopf
    // hängt an keiner Stelle davon ab.
    const quelle = await page.evaluate(async () => (await fetch('/js/dashboard-schueler.js')).text())
    const bereich = quelle.slice(quelle.indexOf('async function sendeBewerbung'), quelle.indexOf('async function sendeBewerbung') + 1200)
    expect(bereich).not.toMatch(/pruefeAnschreiben/)
  })
})

test('der alte Beispieltext ist verschwunden', async ({ page }) => {
  // Verankert die Ablösung: Käme der Knopf zurück, bekäme der
  // Arbeitgeber wieder fünfmal denselben Text.
  const quelle = await page.evaluate(async () => (await fetch('/js/dashboard-schueler.js')).text())
  expect(quelle, 'die feste Textschablone').not.toMatch(/MOTIVATIONS_STARTER/)

  const html = await page.evaluate(async () => (await fetch('/dashboard-schueler.html')).text())
  expect(html, 'der alte Knopf').not.toMatch(/motivation-tipp/)
  expect(html).toMatch(/coach-uebernehmen/)
})

// ---------------------------------------------------------------------
// Am echten Bewerbungs-Dialog
// ---------------------------------------------------------------------
const fake = require('./helpers/supabase-fake')

fake.test.describe('der Coach im Bewerbungs-Dialog', () => {
  const { expect: erwarte, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA } = fake

  function bewerbungsfaehig() {
    return profilZeile(SCHUELER, {
      verifiziert: true,
      schule: 'Gymnasium Nord',
      lebenslauf_bloecke: [{ id: 'b1', typ: 'text', titel: 'Über mich', inhalt: 'Ich bin zuverlässig.' }],
    })
  }

  async function oeffneBewerbung(page) {
    await setupDashboard(page.context(), {
      user: SCHUELER,
      db: defaultDb({ profiles: [bewerbungsfaehig(), profilZeile(FIRMA)] }),
    })
    await page.goto('/dashboard-schueler.html')
    await erwarte(page.locator('#view-jobs .job-card').first()).toBeVisible({ timeout: 30_000 })
    await page.locator('#view-jobs .job-card').first().getByRole('button', { name: 'Jetzt bewerben' }).click()
    await erwarte(page.locator('#bewerbung-overlay')).toHaveClass(/open/)
  }

  fake.test('er ist zugeklappt — niemand wird bevormundet', async ({ page }) => {
    // Wer einfach lostippen will, soll das können.
    await oeffneBewerbung(page)
    await erwarte(page.locator('#coach-auf')).toBeVisible()
    await erwarte(page.locator('#coach-inhalt')).toBeHidden()
  })

  fake.test('aufgeklappt stehen drei Fragen da', async ({ page }) => {
    await oeffneBewerbung(page)
    await page.locator('#coach-auf').click()
    await erwarte(page.locator('#coach-fragen .coach-frage')).toHaveCount(3)
  })

  fake.test('aus den Antworten entsteht der Text im Feld', async ({ page }) => {
    await oeffneBewerbung(page)
    await page.locator('#coach-auf').click()
    await page.locator('#coach-warum').fill('Ich möchte mein erstes eigenes Geld verdienen')
    await page.locator('#coach-zeit').fill('Nachmittags ab 15 Uhr')
    await page.locator('#coach-uebernehmen').click()

    const text = await page.locator('#bewerbung-motivation').inputValue()
    expect(text).toContain('erstes eigenes Geld')
    expect(text).toContain('Nachmittags ab 15 Uhr')
  })

  fake.test('ohne Antwort passiert nichts — kein leeres Gerüst', async ({ page }) => {
    await oeffneBewerbung(page)
    await page.locator('#coach-auf').click()
    await page.locator('#coach-uebernehmen').click()

    expect(await page.locator('#bewerbung-motivation').inputValue()).toBe('')
    await erwarte(page.locator('.toast')).toContainText(/mindestens eine Frage/)
  })

  fake.test('ein selbst geschriebener Text wird nicht einfach überschrieben', async ({ page }) => {
    // Beim ersten Klick nur ein Hinweis, erst beim zweiten wird ersetzt.
    await oeffneBewerbung(page)
    await page.locator('#bewerbung-motivation').fill('Das habe ich selbst getippt und will es behalten.')
    await page.locator('#coach-auf').click()
    await page.locator('#coach-warum').fill('Ich mag den Job')
    await page.locator('#coach-uebernehmen').click()

    expect(await page.locator('#bewerbung-motivation').inputValue())
      .toBe('Das habe ich selbst getippt und will es behalten.')
    await erwarte(page.locator('.toast')).toContainText(/Nochmal klicken/)

    await page.locator('#coach-uebernehmen').click()
    expect(await page.locator('#bewerbung-motivation').inputValue()).toContain('Ich mag den Job')
  })

  fake.test('die Rückmeldung erscheint beim Tippen', async ({ page }) => {
    await oeffneBewerbung(page)
    await page.locator('#bewerbung-motivation').fill('Zu kurz.')
    await erwarte(page.locator('#coach-rueckmeldung .coach-punkt').first()).toBeVisible()
    await erwarte(page.locator('#coach-rueckmeldung')).toContainText(/kurz/)
  })

  fake.test('eine Handynummer im Text wird rot gemeldet', async ({ page }) => {
    await oeffneBewerbung(page)
    await page.locator('#bewerbung-motivation').fill(
      'Hallo, ich will den Job. Ruf mich an unter 0176 12345678. Viele Grüße Lena')
    await erwarte(page.locator('#coach-rueckmeldung .coach-punkt--achtung')).toBeVisible()
  })

  fake.test('beim nächsten Job stehen die alten Antworten nicht mehr da', async ({ page }) => {
    // Sonst baute der Coach ein Anschreiben für die falsche Stelle.
    await oeffneBewerbung(page)
    await page.locator('#coach-auf').click()
    await page.locator('#coach-warum').fill('Antwort zum ersten Job')
    await page.locator('#bewerbung-close').click()

    await page.locator('#view-jobs .job-card').nth(1).getByRole('button', { name: 'Jetzt bewerben' }).click()
    await erwarte(page.locator('#bewerbung-overlay')).toHaveClass(/open/)
    await page.locator('#coach-auf').click()
    expect(await page.locator('#coach-warum').inputValue()).toBe('')
  })
})

fake.test('die Rückmeldungen sind lesbar (AA)', async ({ page }) => {
  // Der Coach steckt in einem Dialog, den die allgemeine
  // Kontrast-Prüfung nie geöffnet sieht. Deshalb hier ausdrücklich.
  const { expect: erwarte, setupDashboard, defaultDb, profilZeile, SCHUELER, FIRMA } = fake
  await setupDashboard(page.context(), {
    user: SCHUELER,
    db: defaultDb({
      profiles: [profilZeile(SCHUELER, {
        verifiziert: true, schule: 'Gymnasium Nord',
        lebenslauf_bloecke: [{ id: 'b1', typ: 'text', titel: 'Über mich', inhalt: 'Zuverlässig.' }],
      }), profilZeile(FIRMA)],
    }),
  })
  await page.goto('/dashboard-schueler.html')
  await erwarte(page.locator('#view-jobs .job-card').first()).toBeVisible({ timeout: 30_000 })
  await page.locator('#view-jobs .job-card').first().getByRole('button', { name: 'Jetzt bewerben' }).click()
  await page.locator('#coach-auf').click()
  await page.locator('#bewerbung-motivation').fill('Zu kurz.')
  await erwarte(page.locator('#coach-rueckmeldung .coach-punkt').first()).toBeVisible()

  const schwach = await page.evaluate(() => {
    const lum = ([r, g, b]) => {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const zahl = s => (s.match(/[\d.]+/g) || []).map(Number)
    // Halbdurchsichtige Flächen über den Untergrund legen.
    const grund = el => {
      let n = el, farbe = [255, 255, 255]
      while (n) {
        const c = zahl(getComputedStyle(n).backgroundColor)
        if (c.length >= 3 && (c[3] === undefined || c[3] > 0)) {
          const a = c[3] === undefined ? 1 : c[3]
          farbe = [0, 1, 2].map(i => Math.round(a * c[i] + (1 - a) * farbe[i]))
          if (a >= 1) break
        }
        n = n.parentElement
      }
      return farbe
    }
    const kontrast = (a, b) => {
      const l1 = lum(a), l2 = lum(b)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }
    const raus = []
    for (const el of document.querySelectorAll('.coach-punkt, .coach-hinweis, .coach-auf-mehr, .coach-frage label')) {
      if (!el.offsetParent) continue
      const k = kontrast(zahl(getComputedStyle(el).color).slice(0, 3), grund(el))
      if (k < 4.5) raus.push(`${el.className}: ${k.toFixed(2)}:1`)
    }
    return raus
  })

  expect(schwach, 'unter 4,5:1').toEqual([])
})
