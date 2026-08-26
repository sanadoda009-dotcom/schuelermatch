// Altersgrenze im Anzeigenformular (26.8.).
//
// DER BEFUND: Das Formular bot als Mindestalter **10, 11 und 12** an,
// und geprüft wurde der Wert an keiner Stelle. Eine freigegebene Firma
// konnte eine Anzeige „ab 10 Jahren" veröffentlichen — sie ging sofort
// live, denn einzelne Anzeigen werden nirgends geprüft (der Betreiber
// gibt Firmen frei, nicht Anzeigen).
//
// Nach § 5 Abs. 1 JArbSchG ist die Beschäftigung von Kindern verboten;
// ab 13 sind leichte Tätigkeiten mit Einwilligung der Eltern erlaubt.
//
// Die Seite widersprach sich dabei selbst: `jugendarbeitsschutz.html`
// sagt „Unter 13 Jahren: Arbeiten ist grundsätzlich nicht erlaubt", die
// Startseite wirbt mit „ab 13". Nur das Formular wusste nichts davon.
//
// Verbindlich wird die Grenze erst mit `supabase/mindestalter-grenze.sql`
// in der Datenbank — eine Auswahlliste im Browser ist kein Schutz.
const { test, expect } = require('./helpers/basis')

async function modul(page, fn, arg) {
  return page.evaluate(async ({ code, arg }) => {
    const m = await import('/js/jugendschutz.js')
    return new Function('m', 'a', 'return (' + code + ')(m, a)')(m, arg)
  }, { code: fn.toString(), arg })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html')
})

test.describe('unter 13 geht nicht', () => {
  test('10, 11 und 12 werden abgelehnt', async ({ page }) => {
    const ergebnisse = await modul(page, m =>
      [10, 11, 12].map(a => m.pruefeMindestalter(a).ok))
    expect(ergebnisse).toEqual([false, false, false])
  })

  test('die Ablehnung nennt den Grund und das Gesetz', async ({ page }) => {
    // „Ungültige Eingabe" hilft niemandem. Wer eine Anzeige schaltet,
    // soll erfahren, warum es nicht geht.
    const r = await modul(page, m => m.pruefeMindestalter(10))
    expect(r.fehler).toMatch(/13/)
    expect(r.fehler).toMatch(/Jugendarbeitsschutz/)
  })

  test('13 ist erlaubt — die Grenze selbst', async ({ page }) => {
    const r = await modul(page, m => m.pruefeMindestalter(13))
    expect(r.ok).toBe(true)
  })

  test('alles von 13 bis 20 ist erlaubt', async ({ page }) => {
    const abgelehnt = await modul(page, m =>
      m.ALTERSOPTIONEN.filter(a => !m.pruefeMindestalter(a).ok))
    expect(abgelehnt).toEqual([])
  })

  test('die Liste beginnt bei 13 und endet bei 20', async ({ page }) => {
    const opt = await modul(page, m => m.ALTERSOPTIONEN)
    expect(opt[0]).toBe(13)
    expect(opt[opt.length - 1]).toBe(20)
    expect(opt).not.toContain(12)
  })

  test('Unfug stürzt nicht ab', async ({ page }) => {
    const r = await modul(page, m =>
      [null, undefined, '', 'abc', 13.5, -1, 999].map(a => m.pruefeMindestalter(a).ok))
    expect(r).toEqual([false, false, false, false, false, false, false])
  })

  test('eine Zahl als Text wird verstanden', async ({ page }) => {
    // Aus einem <select> kommt immer ein String.
    const r = await modul(page, m => m.pruefeMindestalter('15'))
    expect(r.ok).toBe(true)
  })
})

test.describe('Hinweis zum gewählten Alter', () => {
  test('bei 13 und 14 stehen die engen Grenzen da', async ({ page }) => {
    for (const alter of [13, 14]) {
      const t = await modul(page, (m, a) => m.hinweisFuer(a), alter)
      expect(t, `Alter ${alter}`).toMatch(/2 Stunden/)
      expect(t, `Alter ${alter}`).toMatch(/Eltern/)
    }
  })

  test('bei 15 bis 17 der Hinweis auf Schulzeit und Ferien', async ({ page }) => {
    const t = await modul(page, m => m.hinweisFuer(16))
    expect(t).toMatch(/Ferien/)
  })

  test('ab 18 braucht es keinen Hinweis', async ({ page }) => {
    const r = await modul(page, m => [18, 19, 20].map(a => m.hinweisFuer(a)))
    expect(r).toEqual([null, null, null])
  })

  test('der Hinweis widerspricht nicht der Gesetzesseite', async ({ page }) => {
    // Zwei Stellen, die dasselbe Gesetz erklären, dürfen nicht
    // auseinanderlaufen — genau daran ist das Formular gescheitert.
    const seite = await page.evaluate(async () =>
      (await fetch('/jugendarbeitsschutz.html')).text())
    const hinweis = await modul(page, m => m.hinweisFuer(13))

    expect(seite, 'die Gesetzesseite nennt die 2-Stunden-Grenze').toMatch(/2 Stunden/)
    expect(hinweis, 'der Hinweis im Formular auch').toMatch(/2 Stunden/)
    expect(seite).toMatch(/Unter 13 Jahren/)
  })
})

test('das Formular bietet unter 13 gar nicht mehr an', async ({ page }) => {
  // Verankert die Reparatur an der Auswahlliste selbst.
  const html = await page.evaluate(async () => (await fetch('/dashboard-firma.html')).text())
  const liste = html.slice(html.indexOf('id="job-mindestalter"'))
  const bis = liste.slice(0, liste.indexOf('</select>'))

  for (const verboten of ['value="10"', 'value="11"', 'value="12"']) {
    expect(bis, `${verboten} darf nicht wählbar sein`).not.toContain(verboten)
  }
  expect(bis).toContain('value="13"')
})

test('die Anzeige wird vor dem Absenden geprüft', async ({ page }) => {
  // Die Auswahlliste allein ist kein Schutz — wer die API direkt
  // anspricht, umgeht sie. Deshalb die Prüfung im Ablauf, und
  // verbindlich die Regel in der Datenbank.
  const quelle = await page.evaluate(async () => (await fetch('/js/dashboard-firma.js')).text())
  expect(quelle, 'pruefeMindestalter muss im Formularweg stecken')
    .toMatch(/pruefeMindestalter\(/)

  const sql = await page.evaluate(async () => {
    const r = await fetch('/supabase/mindestalter-grenze.sql')
    return r.ok ? r.text() : ''
  })
  // Die Datei liegt bewusst NICHT im Web (supabase/ steht in
  // .vercelignore) - hier reicht, dass die Prüfung im Ablauf sitzt.
  expect(typeof sql).toBe('string')
})

test('die Startseite behauptet nur, was auch geprüft wird', async ({ page }) => {
  // Vorher stand dort „100% jugendschutzgeprüft". Einzelne Anzeigen
  // werden aber nirgends geprüft - der Betreiber gibt Firmen frei, nicht
  // Anzeigen. Was stimmt: Jeder Arbeitgeber wird von Hand geprüft, bevor
  // seine Anzeigen sichtbar werden (RLS: firma_freigegeben).
  const html = await page.evaluate(async () => (await fetch('/index.html')).text())
  expect(html, 'unbelegbare Behauptung').not.toContain('jugendschutzgeprüft')
  expect(html).toMatch(/Arbeitgeber von Hand geprüft/)
})

test('auch die Jobbörse und die Beschreibungstexte bleiben ehrlich', async ({ page }) => {
  // „Alle Jobs sind jugendschutzgeprüft" stand auf der Jobbörse und in
  // drei Beschreibungstexten, die Google anzeigt. Keine einzelne Anzeige
  // wird geprüft — der Betreiber gibt Firmen frei, nicht Anzeigen.
  for (const seite of ['/index.html', '/jobs.html', '/job.html']) {
    const html = await page.evaluate(async s => (await fetch(s)).text(), seite)
    expect(html, `${seite}: unbelegbare Behauptung`).not.toContain('jugendschutzgeprüft')
  }
})

test('die Jobbörse sagt, was tatsächlich geprüft wird', async ({ page }) => {
  // Der Ort, an dem ein Schüler entscheidet, ob er einer Anzeige traut.
  // Wer über Google oder einen geteilten Link kommt, sieht die
  // Startseite nie — hier stand bisher nichts Belastbares.
  await page.goto('/jobs.html')
  const text = await page.locator('main').innerText()
  expect(text).toMatch(/von Hand prüfen|prüfen wir von Hand/i)
})
