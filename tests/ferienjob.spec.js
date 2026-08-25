// Ferienjob-Bereich (26.8.).
//
// Anlass: "Ferienjob" gab es längst als Arbeitszeit-Wert in der Datenbank
// und als Filter-Option - aber nirgends eine Seite, die erklärt, was in den
// Ferien überhaupt erlaubt ist. Die 4-Wochen-Regel (§ 5 Abs. 4 JArbSchG)
// kennt kaum ein Schüler, obwohl daran der ganze Ferienjob hängt.
//
// Der Ferienkalender ist der eigentliche Grund, warum jemand die Seite
// zweimal besucht: Er beantwortet "Wann habe ich frei und lohnt es sich,
// jetzt schon zu suchen?" Deshalb wird hier vor allem geprüft, dass die
// Rechnerei stimmt - ein falscher Countdown ist schlimmer als keiner.
const { test, expect } = require('./helpers/basis')
const { JOBS } = require('./helpers/fixtures')

test.describe('Ferienjob-Seite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ferienjob.html')
    await page.waitForFunction(() => {
      const el = document.getElementById('ferien-countdown')
      return el && !el.innerText.includes('werden geladen')
    })
  })

  test('der Countdown nennt Ferien, Tage und Zeitraum', async ({ page }) => {
    const text = await page.locator('#ferien-countdown').innerText()
    // Grosschreibung bewusst ignoriert: Die Kopfzeile wird per CSS in
    // Versalien gesetzt, innerText liefert den gerenderten Text.
    expect(text).toMatch(/herbstferien|weihnachtsferien|osterferien|frühjahrsferien|sommerferien/i)
    expect(text).toMatch(/noch \d+ tage|morgen geht es los|laufen gerade/i)
    expect(text).toMatch(/\d{2}\.\d{2}\.\d{4}/)
  })

  test('alle 16 Bundesländer stehen zur Wahl', async ({ page }) => {
    const anzahl = await page.locator('#bundesland option').count()
    expect(anzahl).toBe(16)
    const namen = await page.locator('#bundesland').innerText()
    expect(namen).toContain('Nordrhein-Westfalen')
    expect(namen).toContain('Thüringen')
  })

  test('ein anderes Bundesland ändert den Countdown und wird gemerkt', async ({ page }) => {
    const vorher = await page.locator('#ferien-countdown').innerText()

    // Hessen und Bayern haben nie gleichzeitig Herbstferien - der Text
    // muss sich also zwangsläufig ändern.
    await page.selectOption('#bundesland', 'HE')
    const hessen = await page.locator('#ferien-countdown').innerText()
    expect(hessen).toMatch(/hessen/i)
    expect(hessen).not.toBe(vorher)

    // Nach dem Neuladen ist die Wahl noch da.
    await page.reload()
    await page.waitForFunction(() => !document.getElementById('ferien-countdown').innerText.includes('werden geladen'))
    expect(await page.locator('#bundesland').inputValue()).toBe('HE')
    expect(await page.locator('#ferien-countdown').innerText()).toMatch(/hessen/i)
  })

  test('die Terminliste zeigt jeden kommenden Zeitraum mit Dauer', async ({ page }) => {
    await page.selectOption('#bundesland', 'NW')
    const zeilen = page.locator('#ferien-liste .lohn-zeile')
    // Kopfzeile plus mindestens ein Zeitraum.
    expect(await zeilen.count()).toBeGreaterThanOrEqual(2)
    const text = await page.locator('#ferien-liste').innerText()
    expect(text).toMatch(/\d{2}\.\d{2}\.–\d{2}\.\d{2}\./)
  })

  // ---------------------------------------------------------------------
  // Die Rechenlogik direkt, mit festen Stichtagen. Über die Oberfläche
  // ließe sich das nicht prüfen: dort ist "heute" immer der Testtag.
  // ---------------------------------------------------------------------
  test.describe('Ferien-Rechnung', () => {
    const rechne = (page, code) => page.evaluate(async ausdruck => {
      const m = await import('/js/ferien.js')
      return new Function('m', `return ${ausdruck}`)(m)
    }, code)

    test('zählt die Tage bis zum Ferienbeginn korrekt', async ({ page }) => {
      // 1.10.2026 -> Herbstferien NW beginnen am 17.10.2026: 16 Tage.
      const tage = await rechne(page, "m.tageBis('2026-10-17', new Date(2026, 9, 1))")
      expect(tage).toBe(16)
    })

    test('erkennt laufende Ferien statt auf die übernächsten zu zeigen', async ({ page }) => {
      // 20.10.2026 liegt mitten in den NRW-Herbstferien (17.-31.10.).
      const f = await rechne(page, "m.naechsteFerien('NW', new Date(2026, 9, 20))")
      expect(f.name).toBe('Herbstferien')
      expect(f.laeuft).toBe(true)
    })

    test('der letzte Ferientag zählt noch dazu', async ({ page }) => {
      // Am 31.10. sind die NRW-Herbstferien noch nicht vorbei.
      const f = await rechne(page, "m.naechsteFerien('NW', new Date(2026, 9, 31))")
      expect(f.name).toBe('Herbstferien')
      // Einen Tag später schon.
      const g = await rechne(page, "m.naechsteFerien('NW', new Date(2026, 10, 1))")
      expect(g.name).toBe('Weihnachtsferien')
    })

    test('die Dauer schließt beide Randtage ein', async ({ page }) => {
      // 17.10. bis 31.10. sind 15 Tage, nicht 14.
      const tage = await rechne(page, "m.dauerInTagen('2026-10-17', '2026-10-31')")
      expect(tage).toBe(15)
    })

    test('gibt ehrlich auf, wenn der Bestand ausgelaufen ist', async ({ page }) => {
      // Weit hinter dem letzten hinterlegten Termin.
      const f = await rechne(page, "m.naechsteFerien('NW', new Date(2030, 0, 1))")
      expect(f).toBe(null)
    })

    test('jedes Bundesland hat lückenlose, plausible Zeiträume', async ({ page }) => {
      // Schützt vor Tippfehlern in der Datentabelle: Ende nie vor Beginn,
      // keine unrealistisch langen Ferien, alle vier Zeiträume vorhanden.
      const fehler = await rechne(page, `(() => {
        const raus = []
        for (const [code, [name, zeiten]] of Object.entries(m.FERIEN)) {
          if (zeiten.length !== 4) raus.push(name + ': ' + zeiten.length + ' Zeiträume')
          for (const [bez, start, ende] of zeiten) {
            const d = m.dauerInTagen(start, ende)
            if (d < 1) raus.push(name + ' ' + bez + ': Ende vor Beginn')
            if (d > 50) raus.push(name + ' ' + bez + ': ' + d + ' Tage')
          }
        }
        return raus
      })()`)
      expect(fehler).toEqual([])
    })

    test('kein Bundesland fehlt und keins ist doppelt', async ({ page }) => {
      const codes = await rechne(page, 'Object.keys(m.FERIEN)')
      expect(codes.length).toBe(16)
      expect(new Set(codes).size).toBe(16)
    })
  })

  test('die Seite erklärt die Regeln, an denen alles hängt', async ({ page }) => {
    const text = await page.locator('main').innerText()
    // Die 4-Wochen-Regel ist der Kern - ohne sie ist die Seite wertlos.
    expect(text, 'nennt die 4-Wochen-Grenze').toMatch(/4 Wochen|vier Wochen/)
    expect(text, 'sagt, dass es ein Jahresbudget ist').toMatch(/Kalenderjahr|Jahresbudget/)
    expect(text, 'nennt die Tagesgrenze').toContain('8 Stunden')
    expect(text, 'nennt die Wochengrenze').toContain('40 Stunden')
    expect(text, 'nennt das Zeitfenster').toMatch(/6 und 20 Uhr/)
    // Und was am Ende übrig bleibt.
    expect(text, 'erklärt die kurzfristige Beschäftigung').toContain('kurzfristige Beschäftigung')
    expect(text, 'nennt die 70-Tage-Grenze').toMatch(/70 Arbeitstage/)
  })

  test('sie macht klar, dass sie keine Rechtsberatung ist', async ({ page }) => {
    await expect(page.locator('main')).toContainText('keine Rechtsberatung')
  })

  test('der Knopf führt direkt in die gefilterte Jobsuche', async ({ page }) => {
    const knopf = page.locator('a[href="jobs.html?zeit=Ferienjob"]').first()
    await expect(knopf).toBeVisible()
  })
})

// -----------------------------------------------------------------------
// Der Deep-Link muss auf der Jobseite auch wirklich ankommen: Filter
// gesetzt UND Ergebnisliste eingegrenzt. Sonst führt der Knopf ins Leere.
// -----------------------------------------------------------------------
test.describe('Deep-Link in die Jobsuche', () => {
  const MIT_FERIENJOB = [
    { ...JOBS[0], id: 'aaaaaaaa-0000-4000-8000-00000000ff01', titel: 'Ferienaushilfe im Lager', arbeitszeit: 'Ferienjob' },
    ...JOBS,
  ]
  test.use({ antworten: { jobs: MIT_FERIENJOB, bewertungen: [], token: { status: 400, body: {} }, signup: { status: 200, body: null } } })

  test('jobs.html?zeit=Ferienjob zeigt nur Ferienjobs', async ({ page }) => {
    await page.goto('/jobs.html?zeit=Ferienjob')
    await page.waitForFunction(() => document.querySelectorAll('.job-card').length > 0 ||
      document.querySelector('.leer-zustand, .zustand-leer'))

    expect(await page.locator('#filter-arbeitszeit').inputValue()).toBe('Ferienjob')
    const karten = page.locator('.job-card')
    expect(await karten.count()).toBe(1)
    await expect(karten.first()).toContainText('Ferienaushilfe')
  })
})

// -----------------------------------------------------------------------
// Die Seite nützt nichts, wenn niemand sie findet.
// -----------------------------------------------------------------------
test('die Seite ist von der Startseite aus erreichbar', async ({ page }) => {
  await page.goto('/index.html')
  await expect(page.locator('footer a[href="ferienjob.html"]')).toHaveCount(1)
})
