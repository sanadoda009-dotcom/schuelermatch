// Job-Suche: findet sie, was gemeint ist – und nicht mehr?
//
// Anlass (25.8.): Mit 23 realistischen Eingaben gemessen, wie sie ein
// 15-Jähriger tippt. NEUN fanden nichts, obwohl passende Jobs da waren:
//
//   "muenchen", "cafe", "einraeumen"  -> Umlaute umschrieben
//   "nachhilfe job", "gassi gehen"    -> ein Füllwort dazwischen
//   "kellnerin"                       -> andere Wortform
//   "nachhife"                        -> Tippfehler
//   "supermarkt"                      -> Umgangssprache
//
// Wer nichts findet, kommt nicht wieder. Deshalb sind diese Tests
// zweiseitig: Sie prüfen genauso, dass die Suche nicht plötzlich alles
// findet – eine zu großzügige Tippfehler-Toleranz wäre nicht besser.
const { test, expect, setupDashboard } = require('./helpers/supabase-fake')

// Die Testdaten der Jobbörse: Café-Service (München), Mathe-Nachhilfe
// (München), Regale einräumen (Augsburg), Hunde ausführen (München).
async function suche(page, text) {
  return page.evaluate(async (t) => {
    const { passtZurSuche } = await import('./js/suche.js')
    const jobs = [...document.querySelectorAll('.job-card')].map(k => ({
      titel: k.querySelector('h3')?.textContent || '',
      beschreibung: k.querySelector('.job-description')?.textContent || '',
      kategorie: k.querySelector('.kategorie-chip')?.textContent || '',
      ort: (k.querySelector('.company-name')?.textContent || '').trim(),
      arbeitszeit: k.querySelector('.arbeitszeit-chip')?.textContent || '',
    }))
    return jobs.filter(j => passtZurSuche(j, t)).map(j => j.titel)
  }, text)
}

test.beforeEach(async ({ page }) => {
  await setupDashboard(page.context(), {})
  await page.goto('/jobs.html')
  await expect(page.locator('.job-card').first()).toBeVisible({ timeout: 15_000 })
})

test.describe('findet, was gemeint ist', () => {
  const FAELLE = [
    ['nachhilfe', 'Nachhilfe'],
    ['Nachhilfe', 'Nachhilfe'],
    ['mathe', 'Nachhilfe'],
    ['kellner', 'Service'],
    ['kellnerin', 'Service'],
    ['service', 'Service'],
    ['gassi', 'Hunde'],
    ['supermarkt', 'Regale'],
  ]
  for (const [eingabe, erwartet] of FAELLE) {
    test(`"${eingabe}"`, async ({ page }) => {
      const treffer = await suche(page, eingabe)
      expect(treffer.join(' '), `"${eingabe}" findet ${erwartet}`).toContain(erwartet)
    })
  }
})

test.describe('verzeiht, wie Menschen wirklich tippen', () => {
  // Jede dieser Eingaben fand vor dem 25.8. nichts.
  const FAELLE = [
    ['nachhife', 'Nachhilfe', 'Tippfehler'],
    ['cafe', 'Service', 'Akzent weggelassen'],
    ['einraeumen', 'Regale', 'Umlaut umschrieben'],
    ['muenchen', 'Nachhilfe', 'Ort ohne Umlaut'],
    ['nachhilfe job', 'Nachhilfe', 'Füllwort dahinter'],
    ['job nachhilfe', 'Nachhilfe', 'Füllwort davor'],
    ['gassi gehen', 'Hunde', 'Füllwort dahinter'],
  ]
  for (const [eingabe, erwartet, grund] of FAELLE) {
    test(`"${eingabe}" (${grund})`, async ({ page }) => {
      const treffer = await suche(page, eingabe)
      expect(treffer.join(' '), grund).toContain(erwartet)
    })
  }
})

test.describe('findet aber nicht einfach alles', () => {
  // Die Kehrseite: Eine zu großzügige Toleranz wäre nicht besser als
  // gar keine. Diese Suchen dürfen NICHTS liefern.
  for (const eingabe of ['pizzabäcker', 'flugbegleiter', 'programmierung', 'zahnarzt']) {
    test(`"${eingabe}" liefert nichts`, async ({ page }) => {
      expect(await suche(page, eingabe)).toEqual([])
    })
  }

  test('kurze Wörter werden nicht verwechselt', async ({ page }) => {
    // "hand" darf nicht "Hunde" finden – deshalb greift die
    // Tippfehler-Toleranz erst ab fünf Zeichen.
    expect(await suche(page, 'hand')).toEqual([])
  })

  test('zwei Wörter grenzen wirklich ein', async ({ page }) => {
    // Beide müssen passen: Nachhilfe gibt es in München, nicht in Augsburg.
    const inMuenchen = await suche(page, 'nachhilfe münchen')
    expect(inMuenchen.join(' ')).toContain('Nachhilfe')
    expect(await suche(page, 'nachhilfe augsburg')).toEqual([])
  })
})

test('eine Suche ganz ohne Inhalt zeigt alles', async ({ page }) => {
  // "ich suche einen job" enthält keine Information – dann ist es
  // hilfreicher, alles zu zeigen, als nichts.
  const alle = await suche(page, '')
  expect(await suche(page, 'ich suche einen job')).toEqual(alle)
  expect(alle.length).toBeGreaterThan(0)
})
