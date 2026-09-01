// Der umgebaute Lebenslauf-Editor (1.9.2026).
//
// ANLASS: Sanad – „mir gefällt die Vorschau, aber wie man die Sachen
// eintippt, bearbeitet, reinschreibt, Pfeil nach oben schiebt ist einfach
// hässlich und man checkt es nicht ganz schnell".
//
// Angesehen: Resumonk, Kickresume, Rezi, Enhancv, lebenslauf.de. Was dort
// überall gleich ist und hier gefehlt hat:
//   1. Ein Griff zum Ziehen statt Textpfeilchen in der Kopfzeile.
//   2. Werkzeuge im Fuß der Karte, mit Beschriftung, nicht als ✕ und ↑.
//   3. Ein neuer Abschnitt kommt aus einer benannten Auswahl.
// Dazu aus den deutschen Ratgebern: das Neueste zuerst (antichronologisch).
//
// Die Pfeile bleiben trotzdem – WCAG 2.2 (2.5.7 „Dragging Movements")
// verlangt einen Weg, der ohne Ziehen auskommt.
//
// Das Datenmodell ist unverändert: Die Vorschau und das PDF sehen genauso
// aus wie vorher. Umgebaut wurde nur das Bearbeiten.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER } =
  require('./helpers/supabase-fake')

function profilMitBloecken() {
  return profilZeile(SCHUELER, {
    lebenslauf_bloecke: [
      { id: 'b1', typ: 'text', titel: 'Schulbildung', inhalt: 'seit 2023 · Gymnasium Nord' },
      { id: 'b2', typ: 'skillbar', titel: 'Fähigkeiten', skills: [{ name: 'Teamfähigkeit', wert: 80 }] },
      { id: 'b3', typ: 'sprachen', titel: 'Sprachen', sprachen: [{ name: 'Englisch', niveau: 'B1' }] },
    ],
  })
}

async function editor(page) {
  const db = defaultDb({ profiles: [profilMitBloecken()] })
  await setupDashboard(page.context(), { user: SCHUELER, db })
  await page.goto('/lebenslauf.html')
  await expect(page.locator('.ll-karte').first()).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.querySelectorAll('.ll-karte').forEach(d => { d.open = true }))
  return db
}

test.describe('die Karte sagt, was sie ist', () => {
  test('die Art des Abschnitts steht in Worten da, nicht als SKILLBAR', async ({ page }) => {
    // Vorher stand an der Karte `${b.typ.toUpperCase()}` – also „SKILLBAR"
    // und „SPRACHEN". Das erste Wort versteht niemand.
    await editor(page)
    const arten = await page.locator('.ll-karte-typ')
      .evaluateAll(els => els.map(e => e.textContent.trim()))

    expect(arten).toContain('Fähigkeiten mit Balken')
    expect(arten.join(' ')).not.toMatch(/SKILLBAR|SPRACHEN|TEXT\b/)
  })

  test('jede verschiebbare Karte hat einen Griff zum Ziehen', async ({ page }) => {
    await editor(page)
    // „Persönliches" bleibt oben und bekommt deshalb keinen Griff.
    await expect(page.locator('.ll-karte:not(.ll-karte-fest) .ll-griff')).toHaveCount(3)
    await expect(page.locator('.ll-karte-fest .ll-griff')).toHaveCount(0)

    const griff = page.locator('.ll-griff').first()
    // Ohne das zieht der Finger am Handy die Seite statt die Karte.
    expect(await griff.evaluate(e => getComputedStyle(e).touchAction)).toBe('none')
  })
})

test.describe('Verschieben', () => {
  test('die Knöpfe im Fuß tragen einen Namen, kein Zeichen', async ({ page }) => {
    await editor(page)
    const erste = page.locator('.ll-karte:not(.ll-karte-fest)').first()
    await expect(erste.locator('.ll-werkzeug', { hasText: 'Nach unten' })).toBeVisible()
    await expect(erste.locator('.ll-werkzeug', { hasText: 'Abschnitt löschen' })).toBeVisible()
  })

  test('an der ersten Karte ist „Nach oben" abgeschaltet, an der letzten „Nach unten"', async ({ page }) => {
    // Vorher taten die Pfeile an den Enden einfach nichts – man klickte
    // und fragte sich, ob es kaputt ist.
    await editor(page)
    const karten = page.locator('.ll-karte:not(.ll-karte-fest)')
    await expect(karten.first().locator('[data-hoch]')).toBeDisabled()
    await expect(karten.first().locator('[data-runter]')).toBeEnabled()
    await expect(karten.last().locator('[data-runter]')).toBeDisabled()
  })

  test('„Nach unten" vertauscht die Reihenfolge wirklich', async ({ page }) => {
    await editor(page)
    const namen = () => page.locator('.ll-karte:not(.ll-karte-fest) .ll-karte-name')
      .evaluateAll(els => els.map(e => e.textContent.trim()))

    expect(await namen()).toEqual(['Schulbildung', 'Fähigkeiten', 'Sprachen'])
    await page.locator('.ll-karte:not(.ll-karte-fest)').first()
      .locator('[data-runter]').click()
    await expect.poll(namen).toEqual(['Fähigkeiten', 'Schulbildung', 'Sprachen'])
  })

  test('Ziehen am Griff ordnet die Karten neu', async ({ page }) => {
    await editor(page)
    const namen = () => page.locator('.ll-karte:not(.ll-karte-fest) .ll-karte-name')
      .evaluateAll(els => els.map(e => e.textContent.trim()))
    expect(await namen()).toEqual(['Schulbildung', 'Fähigkeiten', 'Sprachen'])

    const griff = page.locator('.ll-karte:not(.ll-karte-fest)').first().locator('.ll-griff')
    const ziel = page.locator('.ll-karte:not(.ll-karte-fest)').nth(1)
    // Die Maus arbeitet in Bildschirmkoordinaten. Steht die Karte unter dem
    // sichtbaren Rand, zeigt boundingBox() auf einen Punkt ausserhalb und
    // es kommt kein einziges Ereignis an - erst herscrollen, dann messen.
    await griff.scrollIntoViewIfNeeded()
    const a = await griff.boundingBox()
    const b = await ziel.boundingBox()

    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(a.x + a.width / 2, b.y + b.height - 4, { steps: 12 })
    await page.mouse.up()

    await expect.poll(namen).toEqual(['Fähigkeiten', 'Schulbildung', 'Sprachen'])
  })

  test('Ziehen am Griff klappt die Karte nicht auf oder zu', async ({ page }) => {
    // `<summary>` reagiert auf jeden Klick. Ohne preventDefault klappte
    // die Karte beim Anfassen zu.
    await editor(page)
    const karte = page.locator('.ll-karte:not(.ll-karte-fest)').first()
    const griff = karte.locator('.ll-griff')
    await griff.scrollIntoViewIfNeeded()
    const box = await griff.boundingBox()

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.up()
    await expect(karte).toHaveAttribute('open', '')
  })
})

test.describe('Abschnitt hinzufügen', () => {
  test('ein Knopf klappt eine Auswahl auf, die erklärt, wofür jeder Eintrag da ist', async ({ page }) => {
    // Vorher: acht gleich aussehende Knöpfe nebeneinander, ohne Erklärung.
    await editor(page)
    await expect(page.locator('#ll-abschnitt-wahl')).not.toBeVisible()

    await page.locator('#ll-abschnitt-btn').click()
    await expect(page.locator('#ll-abschnitt-wahl')).toBeVisible()
    await expect(page.locator('#ll-abschnitt-btn')).toHaveAttribute('aria-expanded', 'true')

    // Jeder Eintrag hat einen Namen UND einen Satz dazu.
    const ohneErklaerung = await page.locator('.ll-wahl').evaluateAll(els =>
      els.filter(e => !e.querySelector('b')?.textContent.trim() ||
                      (e.querySelector('span')?.textContent.trim().length || 0) < 15)
         .map(e => e.textContent.trim()))
    expect(ohneErklaerung, 'Eintrag ohne Namen oder ohne Erklärung').toEqual([])

    // Zwei Einträge hießen beide „Eigener Abschnitt", weil ihr Titel in der
    // Karte leer bleibt. In einer Auswahl muss aber jeder Name eindeutig
    // sein, sonst rät man wieder.
    const namen = await page.locator('.ll-wahl b').evaluateAll(els => els.map(e => e.textContent.trim()))
    expect(namen.length, 'doppelter Name in der Auswahl').toBe(new Set(namen).size)
  })

  test('ein neuer Abschnitt steht gleich offen da und der Finger sitzt im Feld', async ({ page }) => {
    await editor(page)
    const vorher = await page.locator('.ll-karte').count()

    await page.locator('#ll-abschnitt-btn').click()
    await page.locator('.ll-wahl', { hasText: 'Erfahrung' }).click()

    await expect(page.locator('.ll-karte')).toHaveCount(vorher + 1)
    const neue = page.locator('.ll-karte').last()
    await expect(neue).toHaveAttribute('open', '')
    await expect(neue).toContainText('Erfahrung')
    // Man will tippen, nicht erst suchen, wo man tippt.
    await expect(neue.locator('input, textarea').first()).toBeFocused()
  })

  test('Escape schließt die Auswahl', async ({ page }) => {
    await editor(page)
    await page.locator('#ll-abschnitt-btn').click()
    await expect(page.locator('#ll-abschnitt-wahl')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#ll-abschnitt-wahl')).not.toBeVisible()
  })
})

test.describe('Eintippen', () => {
  test('das Textfeld wächst mit dem Text', async ({ page }) => {
    // Vorher blieb jedes Feld bei vier Zeilen stehen und man tippte in
    // ein Guckloch.
    await editor(page)
    const feld = page.locator('textarea.ll-inhalt').first()
    const vorher = await feld.evaluate(e => e.getBoundingClientRect().height)

    await feld.fill(Array.from({ length: 12 }, (_, i) => `Zeile ${i + 1}`).join('\n'))
    await expect.poll(() => feld.evaluate(e => e.getBoundingClientRect().height))
      .toBeGreaterThan(vorher + 40)
  })

  test('der Schieberegler sagt ein Wort, keine Prozentzahl', async ({ page }) => {
    await editor(page)
    const stufe = page.locator('.ll-stufe').first()
    await expect(stufe).toHaveText('Sehr gut')      // 80

    await page.locator('.ll-skill-wert').first().fill('20')
    await expect(stufe).toHaveText('Grundlagen')
  })

  test('jedes Feld hat eine sichtbare Beschriftung', async ({ page }) => {
    // Im alten Editor trugen die Zeilen für Sprachen und Fähigkeiten nur
    // ein aria-label – man sah nicht, was wohin gehört.
    await editor(page)
    const ohne = await page.evaluate(() => {
      const raus = []
      document.querySelectorAll('.ll-karte-body input:not([type=file]), .ll-karte-body select, .ll-karte-body textarea')
        .forEach(el => {
          const sichtbar = el.id && document.querySelector(`label[for="${el.id}"]`)
          if (!sichtbar) raus.push(el.className || el.id || el.tagName)
        })
      return raus
    })
    expect(ohne, 'Feld ohne sichtbare Beschriftung').toEqual([])
  })

  test('unter dem Textfeld steht, dass das Neueste zuerst kommt', async ({ page }) => {
    // Aus den deutschen Ratgebern: Ein Lebenslauf wird antichronologisch
    // gelesen. Das muss dastehen, sonst rät man.
    await editor(page)
    await expect(page.locator('.ll-feldhilfe', { hasText: 'Neueste zuerst' }).first()).toBeVisible()
  })
})
