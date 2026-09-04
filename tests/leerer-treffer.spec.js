// Wenn nichts passt: nicht Sackgasse, sondern Auskunft (4.9.2026).
//
// DER BEFUND: Wer alle Filter setzte und nichts fand, bekam einen Satz —
// „Keine Jobs passen zu diesem Filter." — und einen Knopf, der ALLE
// Filter wegwarf. Wer fünf Felder ausgefüllt hatte, verlor damit auch
// die vier, die nicht schuld waren. Und er erfuhr nie, welcher es war.
//
// Meistens ist es genau einer. Also: jeden gesetzten Filter einmal
// wegnehmen, nachzählen, und die Rücknahmen anbieten, die wirklich
// wieder Treffer bringen — mit der Zahl daneben.
//
// Die Rechnung steckt in `js/filter-vorschlag.js`, damit sie ohne
// Oberfläche prüfbar ist. Vorher stand die Filterbedingung mitten in
// `wendeFilterAn()` zwischen DOM-Zugriffen.

const { test, expect } = require('./helpers/basis')

// Die Testdaten der Jobbörse (tests/helpers/fixtures.js) — vier Anzeigen:
//   Café Sonnenschein  München   ab 16   14 €
//   Mathe-Nachhilfe    München   ab 15   16 €
//   Getränkemarkt      Augsburg  ab 14   12 €
//   Hunde ausführen    München   ab 13    9 €
// Kein Hamburg, kein Lohn über 16 € — darauf bauen die Deep-Links unten.

async function modul(page, fn, arg) {
  return page.evaluate(async ({ code, arg }) => {
    const m = await import('/js/filter-vorschlag.js')
    return new Function('m', 'a', 'return (' + code + ')(m, a)')(m, arg)
  }, { code: fn.toString(), arg })
}

const JOBS = [
  { id: 'a', titel: 'Kellnern', ort: 'München', mindestalter: 16, stundenlohn: 13, kategorie: 'Gastronomie', arbeitszeit: 'Wochenende' },
  { id: 'b', titel: 'Nachhilfe', ort: 'München', mindestalter: 15, stundenlohn: 15, kategorie: 'Nachhilfe', arbeitszeit: 'Nachmittags' },
  { id: 'c', titel: 'Regale', ort: 'Augsburg', mindestalter: 14, stundenlohn: 12, kategorie: 'Verkauf', arbeitszeit: 'Wochenende' },
]

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html')
})

test.describe('die Rechnung selbst', () => {
  test('ohne gesetzten Filter gibt es nichts vorzuschlagen', async ({ page }) => {
    const r = await modul(page, (m, a) => m.entlastungen(a.jobs, {}), { jobs: JOBS })
    expect(r).toEqual([])
  })

  test('nennt den einen Filter, der die Liste leer macht', async ({ page }) => {
    // Ort Augsburg + Kategorie Gastronomie: zusammen null Treffer.
    // Ohne den Ort wäre es einer, ohne die Kategorie ebenfalls einer.
    const r = await modul(page, (m, a) => m.entlastungen(a.jobs, {
      ort: 'augsburg', kategorie: 'Gastronomie',
    }), { jobs: JOBS })
    expect(r.map(v => v.schluessel).sort()).toEqual(['kategorie', 'ort'])
    expect(r.every(v => v.anzahl === 1)).toBe(true)
  })

  test('die größte Entlastung steht vorn', async ({ page }) => {
    // Alter 13 (nichts passt) + Ort Augsburg (einer passt).
    // Ohne das Alter bleibt der eine Augsburger; ohne den Ort bleibt
    // niemand, denn 13 Jahre reicht für keine der drei Anzeigen.
    const r = await modul(page, (m, a) => m.entlastungen(a.jobs, {
      alter: 13, ort: 'augsburg',
    }), { jobs: JOBS })
    expect(r[0].schluessel).toBe('alter')
    expect(r[0].anzahl).toBe(1)
  })

  test('schlägt nichts vor, was auch leer bliebe', async ({ page }) => {
    // Ein Lohn, den keine Anzeige erreicht, plus ein Ort, den es nicht
    // gibt: Egal welchen der beiden man wegnimmt, es bleibt leer.
    const r = await modul(page, (m, a) => m.entlastungen(a.jobs, {
      gehalt: 99, ort: 'hamburg',
    }), { jobs: JOBS })
    expect(r).toEqual([])
  })

  test('ein einzelner zu enger Filter wird auch benannt', async ({ page }) => {
    const r = await modul(page, (m, a) => m.entlastungen(a.jobs, { gehalt: 99 }),
      { jobs: JOBS })
    expect(r).toEqual([{ schluessel: 'gehalt', anzahl: 3 }])
  })

  test('0 gilt nicht als gesetzter Filter', async ({ page }) => {
    // `parseFloat('') || null` ergibt null, aber ein Feld könnte auch 0
    // liefern. `Number(null)` ist 0 — dieselbe Falle wie schon dreimal.
    const r = await modul(page, m => [
      m.istGesetzt(0), m.istGesetzt(null), m.istGesetzt(''),
      m.istGesetzt(undefined), m.istGesetzt(13),
    ])
    expect(r).toEqual([false, false, false, false, true])
  })

  test('filtert weiter richtig — Anzeigen ohne Altersangabe fallen raus', async ({ page }) => {
    // Der Fund von früher: `null > alter` ist falsch, so eine Anzeige
    // rutschte durch jeden Altersfilter.
    const r = await modul(page, (m, a) => m.filtere(a.jobs, { alter: 16 }).map(j => j.id),
      { jobs: [...JOBS, { id: 'x', titel: 'Ohne Alter', ort: 'München', mindestalter: null, stundenlohn: 12 }] })
    expect(r).toEqual(['a', 'b', 'c'])
  })
})

test.describe('in der Jobbörse', () => {
  test('nennt den Filter beim Namen statt nur „nichts gefunden"', async ({ page }) => {
    // Ort, den es in den Testdaten nicht gibt, per Deep-Link.
    await page.goto('/jobs.html?ort=Hamburg')
    await expect(page.locator('.empty-state')).toBeVisible({ timeout: 20_000 })
    const vorschlag = page.locator('[data-loesen="ort"]')
    await expect(vorschlag).toBeVisible()
    await expect(vorschlag).toContainText('Hamburg')
    await expect(vorschlag).toContainText('4')
  })

  test('ein Klick nimmt genau diesen einen Filter weg', async ({ page }) => {
    await page.goto('/jobs.html?ort=Hamburg&alter=16')
    await expect(page.locator('.empty-state')).toBeVisible({ timeout: 20_000 })
    await page.locator('[data-loesen="ort"]').click()

    // Der Ort ist weg, das Alter steht noch.
    await expect(page.locator('.job-card').first()).toBeVisible()
    await expect(page.locator('#filter-ort')).toHaveValue('')
    await expect(page.locator('#filter-alter')).toHaveValue('16')
  })

  test('sagt es ehrlich, wenn ein einzelner Filter nicht reicht', async ({ page }) => {
    // Zwei Filter, von denen jeder FÜR SICH schon nichts findet: einen
    // Ort ohne Anzeigen und ein Suchwort, das nirgends vorkommt. Beim
    // Lohn ginge das gar nicht — dessen höchste Stufe (16 €) trifft noch
    // eine Anzeige, und der Filter nimmt ohnehin nur Werte aus der Liste.
    await page.goto('/jobs.html?ort=Hamburg&q=raketenwissenschaft')
    await expect(page.locator('.empty-state')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-loesen]')).toHaveCount(0)
    await expect(page.locator('.empty-state')).toContainText('mehrere')
  })

  test('der Weg zurück auf alles bleibt', async ({ page }) => {
    await page.goto('/jobs.html?ort=Hamburg')
    await expect(page.locator('#filter-reset')).toBeVisible({ timeout: 20_000 })
    await page.locator('#filter-reset').click()
    await expect(page.locator('.job-card')).toHaveCount(4)
  })

  test('die Trefferzahl wird angesagt, nicht nur angezeigt', async ({ page }) => {
    // Ohne role="status" ändert sich beim Filtern für einen
    // Screenreader-Nutzer nichts Hörbares — die Liste tauscht sich
    // lautlos aus.
    await page.goto('/jobs.html')
    const zaehler = page.locator('#jobs-count')
    await expect(zaehler).toHaveAttribute('role', 'status', { timeout: 20_000 })
    await expect(zaehler).toHaveAttribute('aria-live', 'polite')
    await expect(zaehler).toContainText('4 Jobs gefunden')
  })
})
