// Der Lebenslauf-Editor als Assistent (1.–2.9.2026).
//
// ANLASS 1 (1.9.): Sanad – „mir gefällt die Vorschau, aber wie man die
// Sachen eintippt, bearbeitet, reinschreibt, Pfeil nach oben schiebt ist
// einfach hässlich und man checkt es nicht ganz schnell". Angesehen:
// Resumonk, Kickresume, Rezi, Enhancv, lebenslauf.de. Daraus: ein Griff
// zum Ziehen, Werkzeuge mit Namen im Kartenfuß, eine benannte Auswahl.
//
// ANLASS 2 (2.9.): Sanad schickt Bilder von app.onlinelebenslauf.com –
// fünf Schritte mit Fortschrittsbalken, „Zurück"/„Weiter", pro Schritt
// eine Überschrift, die anspricht. Übernommen wurde die Form, nicht der
// Wortlaut: Dort steht „Berufserfahrung" und „Berufsbezeichnung",
// geschrieben für Berufstätige. Hier sind es Vierzehnjährige.
//
// Nicht übernommen: „Mit KI generieren". Dahinter steckt hier nichts, was
// den Knopf einlösen könnte – und ein Knopf, der etwas verspricht und
// nichts tut, ist schlimmer als keiner.
//
// Die Pfeile bleiben neben dem Ziehen – WCAG 2.2 (2.5.7 „Dragging
// Movements") verlangt einen Weg, der ohne Ziehen auskommt.

const { test, expect, setupDashboard, defaultDb, profilZeile, SCHUELER } =
  require('./helpers/supabase-fake')

function profilMitBloecken() {
  return profilZeile(SCHUELER, {
    lebenslauf_bloecke: [
      { id: 'b1', typ: 'text', titel: 'Erfahrung', inhalt: 'März 2026 · Praktikum Bäckerei' },
      { id: 'b2', typ: 'text', titel: 'Schulbildung', inhalt: 'seit 2023 · Gymnasium Nord' },
      { id: 'b3', typ: 'skillbar', titel: 'Fähigkeiten', skills: [{ name: 'Teamfähigkeit', wert: 80 }] },
      { id: 'b4', typ: 'sprachen', titel: 'Sprachen', sprachen: [{ name: 'Englisch', niveau: 'B1' }] },
      { id: 'b5', typ: 'skills', titel: 'Interessen', tags: 'Fußball, Technik' },
    ],
  })
}

// Öffnet den Editor und blättert bis zum gewünschten Schritt.
async function editor(page, schritt = 1) {
  const db = defaultDb({ profiles: [profilMitBloecken()] })
  await setupDashboard(page.context(), { user: SCHUELER, db })
  await page.goto('/lebenslauf.html')
  await expect(page.locator('#ll-schritt-name')).not.toBeEmpty({ timeout: 30_000 })
  for (let i = 1; i < schritt; i++) await page.locator('#ll-weiter').click()
  await expect(page.locator('#ll-schritt-nr')).toHaveText(String(schritt))
  await page.evaluate(() => document.querySelectorAll('.ll-karte').forEach(d => { d.open = true }))
  return db
}

const namen = page => page.locator('.ll-karte:not(.ll-karte-fest) .ll-karte-name')
  .evaluateAll(els => els.map(e => e.textContent.trim()))

test.describe('die fünf Schritte', () => {
  test('der Editor startet bei Schritt 1 und sagt, worum es geht', async ({ page }) => {
    await editor(page)
    await expect(page.locator('#ll-schritt-nr')).toHaveText('1')
    await expect(page.locator('#ll-schritt-name')).toHaveText('Über dich')
    await expect(page.locator('#ll-schritt-frage')).not.toBeEmpty()
    await expect(page.locator('#ll-schritt-hinweis')).not.toBeEmpty()
    // Am Anfang gibt es kein Zurück.
    await expect(page.locator('#ll-zurueck')).toBeDisabled()
  })

  test('Weiter und Zurück führen durch alle fünf Schritte', async ({ page }) => {
    await editor(page)
    const gesehen = []
    for (let i = 1; i <= 5; i++) {
      gesehen.push(await page.locator('#ll-schritt-name').textContent())
      if (i < 5) await page.locator('#ll-weiter').click()
    }
    expect(gesehen.map(t => t.trim())).toEqual(
      ['Über dich', 'Erfahrung', 'Schule', 'Was du kannst', 'Zum Schluss'])

    // Am Ende heißt der Knopf nicht mehr "Weiter" – es geht nicht weiter.
    await expect(page.locator('#ll-weiter')).toHaveText('Fertig')

    await page.locator('#ll-zurueck').click()
    await expect(page.locator('#ll-schritt-nr')).toHaveText('4')
  })

  test('jeder Schritt zeigt nur, was in ihn gehört', async ({ page }) => {
    // Das ist der Kern des Umbaus: nicht mehr alles auf einmal.
    await editor(page, 2)
    expect(await namen(page)).toEqual(['Erfahrung'])

    await page.locator('#ll-weiter').click()
    expect(await namen(page)).toEqual(['Schulbildung'])

    await page.locator('#ll-weiter').click()
    expect(await namen(page)).toEqual(['Fähigkeiten', 'Sprachen', 'Interessen'])
  })

  test('„Persönliches" steht nur im ersten Schritt', async ({ page }) => {
    await editor(page)
    await expect(page.locator('.ll-karte-fest')).toHaveCount(1)
    await page.locator('#ll-weiter').click()
    await expect(page.locator('.ll-karte-fest')).toHaveCount(0)
  })

  test('ein leerer Schritt erklärt sich, statt leer dazustehen', async ({ page }) => {
    // Ohne Text sieht ein leerer Schritt aus wie ein Fehler.
    const db = defaultDb({ profiles: [profilZeile(SCHUELER, { lebenslauf_bloecke: [] })] })
    await setupDashboard(page.context(), { user: SCHUELER, db })
    await page.goto('/lebenslauf.html')
    await expect(page.locator('#ll-schritt-name')).not.toBeEmpty({ timeout: 30_000 })
    await page.locator('#ll-weiter').click()

    const leer = page.locator('#ll-schritt-leer')
    await expect(leer).toBeVisible()
    expect((await leer.textContent()).trim().length).toBeGreaterThan(30)
  })

  test('die Vorlagen stehen nur am Anfang', async ({ page }) => {
    // Sie ersetzen den ganzen Lebenslauf – mitten im Ablauf wäre das eine
    // Falle.
    await editor(page)
    await expect(page.locator('#ll-vorlagen-box')).toBeVisible()
    await page.locator('#ll-weiter').click()
    await expect(page.locator('#ll-vorlagen-box')).toBeHidden()
  })

  test('es gibt keinen Knopf, der KI verspricht', async ({ page }) => {
    // Im Vorbild steht „Mit KI generieren". Hier gibt es dahinter nichts.
    for (let s = 1; s <= 5; s++) {
      await editor(page, s)
      await expect(page.locator('#ll-editor')).not.toContainText('KI', { timeout: 5000 })
    }
  })
})

test.describe('die Karte sagt, was sie ist', () => {
  test('die Art des Abschnitts steht in Worten da, nicht als SKILLBAR', async ({ page }) => {
    await editor(page, 4)
    const arten = await page.locator('.ll-karte-typ')
      .evaluateAll(els => els.map(e => e.textContent.trim()))
    expect(arten).toContain('Fähigkeiten mit Balken')
    expect(arten.join(' ')).not.toMatch(/SKILLBAR|SPRACHEN|TEXT\b/)
  })

  test('jede verschiebbare Karte hat einen Griff zum Ziehen', async ({ page }) => {
    await editor(page, 4)
    await expect(page.locator('.ll-karte:not(.ll-karte-fest) .ll-griff')).toHaveCount(3)

    const griff = page.locator('.ll-griff').first()
    // Ohne das zieht der Finger am Handy die Seite statt die Karte.
    expect(await griff.evaluate(e => getComputedStyle(e).touchAction)).toBe('none')
  })
})

test.describe('Verschieben', () => {
  test('die Knöpfe im Fuß tragen einen Namen, kein Zeichen', async ({ page }) => {
    await editor(page, 4)
    const erste = page.locator('.ll-karte').first()
    await expect(erste.locator('.ll-werkzeug', { hasText: 'Nach unten' })).toBeVisible()
    await expect(erste.locator('.ll-werkzeug', { hasText: 'Abschnitt löschen' })).toBeVisible()
  })

  test('an der ersten Karte ist „Nach oben" abgeschaltet, an der letzten „Nach unten"', async ({ page }) => {
    await editor(page, 4)
    const karten = page.locator('.ll-karte')
    await expect(karten.first().locator('[data-hoch]')).toBeDisabled()
    await expect(karten.first().locator('[data-runter]')).toBeEnabled()
    await expect(karten.last().locator('[data-runter]')).toBeDisabled()
  })

  test('„Nach unten" vertauscht die Reihenfolge wirklich', async ({ page }) => {
    await editor(page, 4)
    expect(await namen(page)).toEqual(['Fähigkeiten', 'Sprachen', 'Interessen'])
    await page.locator('.ll-karte').first().locator('[data-runter]').click()
    await expect.poll(() => namen(page)).toEqual(['Sprachen', 'Fähigkeiten', 'Interessen'])
  })

  test('Verschieben wirft keine Karte in einen anderen Schritt', async ({ page }) => {
    // Die Knöpfe liefen früher über den GESAMTEN Bestand. Mit Schritten
    // hätte „Nach oben" an der ersten Karte mit einer Karte aus einem
    // anderen Schritt getauscht – die wäre dann verschwunden.
    const db = await editor(page, 4)
    await page.locator('.ll-karte').first().locator('[data-runter]').click()
    await expect.poll(() => namen(page)).toEqual(['Sprachen', 'Fähigkeiten', 'Interessen'])

    await page.locator('#ll-zurueck').click()
    await page.locator('#ll-zurueck').click()
    expect(await namen(page)).toEqual(['Erfahrung'])
    await page.locator('#ll-weiter').click()
    expect(await namen(page)).toEqual(['Schulbildung'])
  })

  test('Ziehen am Griff ordnet die Karten neu', async ({ page }) => {
    await editor(page, 4)
    expect(await namen(page)).toEqual(['Fähigkeiten', 'Sprachen', 'Interessen'])

    const griff = page.locator('.ll-karte').first().locator('.ll-griff')
    const ziel = page.locator('.ll-karte').nth(1)
    // Die Maus arbeitet in Bildschirmkoordinaten. Steht die Karte unter dem
    // sichtbaren Rand, zeigt boundingBox() nach draußen und es kommt kein
    // einziges Ereignis an – erst herscrollen, dann messen.
    await griff.scrollIntoViewIfNeeded()
    const a = await griff.boundingBox()
    const b = await ziel.boundingBox()

    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(a.x + a.width / 2, b.y + b.height - 4, { steps: 12 })
    await page.mouse.up()

    await expect.poll(() => namen(page)).toEqual(['Sprachen', 'Fähigkeiten', 'Interessen'])
  })

  test('Ziehen am Griff klappt die Karte nicht auf oder zu', async ({ page }) => {
    // `<summary>` reagiert auf jeden Klick. preventDefault auf pointerdown
    // allein reicht nicht – der anschließende click klappt trotzdem um.
    await editor(page, 4)
    const karte = page.locator('.ll-karte').first()
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
  test('die Auswahl zeigt nur, was in diesen Schritt passt', async ({ page }) => {
    await editor(page, 2)
    await page.locator('#ll-abschnitt-btn').click()
    await expect(page.locator('#ll-abschnitt-wahl')).toBeVisible()
    const hier = await page.locator('.ll-wahl b').evaluateAll(e => e.map(x => x.textContent.trim()))
    expect(hier).toContain('Erfahrung')
    expect(hier).not.toContain('Sprachen')

    await page.locator('#ll-weiter').click()
    await page.locator('#ll-abschnitt-btn').click()
    const dort = await page.locator('.ll-wahl b').evaluateAll(e => e.map(x => x.textContent.trim()))
    expect(dort).toContain('Schulbildung')
    expect(dort).not.toContain('Erfahrung')
  })

  test('jeder Eintrag hat einen eigenen Namen und einen Satz dazu', async ({ page }) => {
    // Zwei Einträge hießen einmal beide „Eigener Abschnitt".
    for (const s of [2, 3, 4, 5]) {
      await editor(page, s)
      await page.locator('#ll-abschnitt-btn').click()
      const ohne = await page.locator('.ll-wahl').evaluateAll(els =>
        els.filter(e => !e.querySelector('b')?.textContent.trim() ||
                        (e.querySelector('span')?.textContent.trim().length || 0) < 15)
           .map(e => e.textContent.trim()))
      expect(ohne, `Schritt ${s}: Eintrag ohne Namen oder Erklärung`).toEqual([])
      const n = await page.locator('.ll-wahl b').evaluateAll(e => e.map(x => x.textContent.trim()))
      expect(n.length, `Schritt ${s}: doppelter Name`).toBe(new Set(n).size)
    }
  })

  test('ein neuer Abschnitt landet in dem Schritt, in dem man ihn anlegt', async ({ page }) => {
    await editor(page, 2)
    await page.locator('#ll-abschnitt-btn').click()
    await page.locator('.ll-wahl', { hasText: 'Nebenjobs' }).click()

    await expect(page.locator('.ll-karte')).toHaveCount(2)
    const neue = page.locator('.ll-karte').last()
    await expect(neue).toHaveAttribute('open', '')
    await expect(neue.locator('input, textarea').first()).toBeFocused()
    await expect(page.locator('#ll-abschnitt-wahl')).not.toBeVisible()

    // Und er bleibt dort, auch nach einem Rundgang durch die Schritte.
    await page.locator('#ll-weiter').click()
    await page.locator('#ll-zurueck').click()
    expect(await namen(page)).toEqual(['Erfahrung', 'Nebenjobs'])
  })

  test('Escape schließt die Auswahl', async ({ page }) => {
    await editor(page, 2)
    await page.locator('#ll-abschnitt-btn').click()
    await expect(page.locator('#ll-abschnitt-wahl')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#ll-abschnitt-wahl')).not.toBeVisible()
  })
})

test.describe('Eintippen', () => {
  test('das Textfeld wächst mit dem Text', async ({ page }) => {
    await editor(page, 2)
    const feld = page.locator('textarea.ll-inhalt').first()
    const vorher = await feld.evaluate(e => e.getBoundingClientRect().height)

    await feld.fill(Array.from({ length: 12 }, (_, i) => `Zeile ${i + 1}`).join('\n'))
    await expect.poll(() => feld.evaluate(e => e.getBoundingClientRect().height))
      .toBeGreaterThan(vorher + 40)
  })

  test('der Schieberegler sagt ein Wort, keine Prozentzahl', async ({ page }) => {
    await editor(page, 4)
    const stufe = page.locator('.ll-stufe').first()
    await expect(stufe).toHaveText('Sehr gut')      // 80
    await page.locator('.ll-skill-wert').first().fill('20')
    await expect(stufe).toHaveText('Grundlagen')
  })

  test('jedes Feld hat eine sichtbare Beschriftung', async ({ page }) => {
    for (const s of [1, 2, 4]) {
      await editor(page, s)
      const ohne = await page.evaluate(() => {
        const raus = []
        document.querySelectorAll('.ll-karte-body input:not([type=file]), .ll-karte-body select, .ll-karte-body textarea')
          .forEach(el => {
            if (!(el.id && document.querySelector(`label[for="${el.id}"]`))) {
              raus.push(el.className || el.id || el.tagName)
            }
          })
        return raus
      })
      expect(ohne, `Schritt ${s}: Feld ohne sichtbare Beschriftung`).toEqual([])
    }
  })

  test('unter dem Textfeld steht, dass das Neueste zuerst kommt', async ({ page }) => {
    await editor(page, 2)
    await expect(page.locator('.ll-feldhilfe', { hasText: 'Neueste zuerst' }).first()).toBeVisible()
  })
})
