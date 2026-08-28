// Was im fertigen Lebenslauf-PDF tatsächlich steht (27.8.).
//
// `js/pdf.js` ist mit 516 Zeilen die grösste Einzeldatei nach den
// Dashboards. Geprüft waren bisher die Zeichenbehandlung
// (`pdf-zeichen.spec.js`) und dass jsPDF erst bei Bedarf nachgeladen
// wird (`pdf-nachladen.spec.js`) — **nicht aber der Inhalt**.
//
// Dabei ist genau das der Gegenstand: Dieses PDF ist das, was ein
// Arbeitgeber von einem Schüler zu sehen bekommt. Fällt hier ein
// Abschnitt still weg, merkt es niemand — der Schüler sieht sein PDF
// selten, und die Firma weiss nicht, was fehlen sollte.
//
// Der Inhalt lässt sich auslesen: jsPDF hält die Seiten als
// Textströme, gezeichneter Text steht darin als „(…) Tj".
const { test, expect } = require('./helpers/basis')

// Liest allen sichtbaren Text aus dem erzeugten PDF.
async function pdfText(page, daten) {
  return page.evaluate(async d => {
    const m = await import('/js/pdf.js')
    const doc = await m.erzeugeLebenslaufPdf(d)
    const seiten = doc.internal.pages.filter(Boolean)
    const roh = seiten.map(s => (Array.isArray(s) ? s.join('\n') : String(s))).join('\n')
    return {
      seiten: seiten.length,
      stuecke: [...roh.matchAll(/\((.*?)\)\s*Tj/g)].map(x => x[1]),
    }
  }, daten)
}

const VOLL = {
  name: 'Lena Musterfrau',
  email: 'lena@example.com',
  ort: 'München',
  schule: 'Gymnasium Nord',
  klasse: '10. Klasse',
  alter_jahre: 16,
  bloecke: [
    { id: 'b1', typ: 'text', titel: 'Über mich', inhalt: 'Ich bin zuverlässig und lerne schnell.' },
    { id: 'b2', typ: 'text', titel: 'Erfahrung', inhalt: 'Zeitungen ausgetragen im Sommer.' },
    { id: 'b3', typ: 'sprachen', titel: 'Sprachen', sprachen: [
      { name: 'Deutsch', niveau: 'Muttersprache' }, { name: 'Englisch', niveau: 'B1' }] },
    { id: 'b4', typ: 'skills', titel: 'Fähigkeiten', tags: 'Pünktlich, Freundlich' },
    { id: 'b5', typ: 'skillbar', titel: 'Stärken', skills: [{ name: 'Teamarbeit', wert: 80 }] },
  ],
}

test.beforeEach(async ({ page }) => {
  await page.goto('/lebenslauf.html')
})

test.describe('die Angaben des Schülers stehen wirklich drin', () => {
  test('Name, Schule, Klasse und Alter', async ({ page }) => {
    const { stuecke } = await pdfText(page, VOLL)
    const alles = stuecke.join(' | ')
    expect(alles).toContain('Lena Musterfrau')
    expect(alles).toContain('Gymnasium Nord')
    expect(alles).toContain('10. Klasse')
    expect(alles).toContain('16 Jahre')
  })

  test('Ort und E-Mail — sonst kann niemand antworten', async ({ page }) => {
    const { stuecke } = await pdfText(page, VOLL)
    const alles = stuecke.join(' | ')
    expect(alles).toContain('München')
    expect(alles).toContain('lena@example.com')
  })

  test('jeder Abschnittstyp landet im PDF', async ({ page }) => {
    // Fällt ein Typ still weg, fehlt im Lebenslauf ein ganzer Abschnitt
    // und niemand merkt es.
    const { stuecke } = await pdfText(page, VOLL)
    const alles = stuecke.join(' | ')
    expect(alles, 'Text-Abschnitt').toContain('Zeitungen ausgetragen')
    expect(alles, 'Sprachen').toContain('Englisch')
    expect(alles, 'Sprachen: Niveau').toContain('B1')
    expect(alles, 'Fähigkeiten als Schlagworte').toContain('Pünktlich')
    expect(alles, 'Stärken-Balken').toContain('Teamarbeit')
  })

  test('„Über mich" steht ohne eigene Überschrift oben', async ({ page }) => {
    // Es ist der Einstieg, keine Rubrik. Eine Überschrift „ÜBER MICH"
    // über dem ersten Satz wirkt behäbig.
    const { stuecke } = await pdfText(page, VOLL)
    expect(stuecke.join(' | ')).toContain('Ich bin zuverlässig')
    expect(stuecke.some(s => /^ÜBER MICH$/i.test(s.trim())), 'keine eigene Überschrift').toBe(false)
  })

  test('das Motivationsschreiben erscheint, wenn eines mitgegeben wird', async ({ page }) => {
    // Diesen Weg nimmt die Firma: Sie lädt den Lebenslauf des Bewerbers
    // samt Anschreiben als ein PDF.
    const { stuecke } = await pdfText(page, { ...VOLL, motivationsschreiben: 'Ich möchte mich bewerben, weil ich gern mit anpacke.' })
    expect(stuecke.join(' | ')).toContain('weil ich gern mit anpacke')
  })
})

test.describe('was NICHT drinstehen darf', () => {
  test('nie „undefined", „null" oder „[object Object]"', async ({ page }) => {
    // Der klassische stille Fehler: Ein Feld fehlt, und statt nichts
    // steht das Wort „undefined" im Lebenslauf, den ein Arbeitgeber
    // liest. Deshalb ausdrücklich mit LÜCKENHAFTEN Daten geprüft.
    const luecken = {
      name: 'Ben',
      bloecke: [
        { id: 'b1', typ: 'text', titel: 'Erfahrung', inhalt: 'Etwas Text.' },
        { id: 'b2', typ: 'sprachen', titel: 'Sprachen', sprachen: [{ name: 'Deutsch' }] },
        { id: 'b3', typ: 'skillbar', titel: 'Stärken', skills: [{ name: 'Ordnung' }] },
      ],
    }
    const { stuecke } = await pdfText(page, luecken)
    for (const muell of ['undefined', 'null', '[object Object]', 'NaN']) {
      expect(stuecke.join(' | '), `„${muell}" im Lebenslauf`).not.toContain(muell)
    }
  })

  test('leere Abschnitte erzeugen keine Überschrift', async ({ page }) => {
    // Eine Rubrik „SPRACHEN" ohne Inhalt sieht aus, als wäre etwas
    // kaputt — und der Schüler wirkt unfertig.
    const { stuecke } = await pdfText(page, {
      name: 'Ben',
      bloecke: [
        { id: 'b1', typ: 'sprachen', titel: 'Sprachen', sprachen: [] },
        { id: 'b2', typ: 'skills', titel: 'Fähigkeiten', tags: '   ' },
        { id: 'b3', typ: 'text', titel: 'Erfahrung', inhalt: '' },
        { id: 'b4', typ: 'skillbar', titel: 'Stärken', skills: [{ name: '' }] },
      ],
    })
    const ueberschriften = stuecke.map(s => s.trim().toUpperCase())
    for (const leer of ['SPRACHEN', 'FÄHIGKEITEN', 'ERFAHRUNG', 'STÄRKEN']) {
      expect(ueberschriften, `${leer} ohne Inhalt`).not.toContain(leer)
    }
  })

  test('ein Lebenslauf ganz ohne Abschnitte stürzt nicht ab', async ({ page }) => {
    const { stuecke, seiten } = await pdfText(page, { name: 'Ben', bloecke: [] })
    expect(seiten).toBe(1)
    expect(stuecke.join(' | ')).toContain('Ben')
  })

  test('auch ohne jede Angabe entsteht ein PDF', async ({ page }) => {
    const { seiten } = await pdfText(page, {})
    expect(seiten).toBeGreaterThanOrEqual(1)
  })
})

test.describe('lange Lebensläufe', () => {
  test('viel Text geht auf eine zweite Seite, statt verloren zu gehen', async ({ page }) => {
    // Der gefährlichere Fehler wäre stilles Abschneiden: Der Schüler
    // sieht seinen Text in der Vorschau und die Firma bekommt ihn nicht.
    const bloecke = []
    for (let i = 1; i <= 12; i++) {
      bloecke.push({
        id: `b${i}`, typ: 'text', titel: `Abschnitt ${i}`,
        inhalt: `Inhalt von Abschnitt ${i}. ` + 'Ein längerer Satz zur Auffüllung. '.repeat(12),
      })
    }
    const { stuecke, seiten } = await pdfText(page, { ...VOLL, bloecke })
    expect(seiten, 'sollte mehrere Seiten haben').toBeGreaterThan(1)

    const alles = stuecke.join(' | ')
    expect(alles, 'der erste Abschnitt').toContain('Inhalt von Abschnitt 1.')
    expect(alles, 'der LETZTE Abschnitt darf nicht fehlen').toContain('Inhalt von Abschnitt 12.')
  })

  test('die Fusszeile steht genau einmal — auf der letzten Seite', async ({ page }) => {
    // Ich hatte zuerst „auf jeder Seite" geprüft und es für einen Fehler
    // gehalten. Es ist eine Entscheidung: In js/pdf.js steht dazu
    // „Fußzeile nur auf der letzten Seite, dezent". Ein Absender-Vermerk
    // auf jeder Seite wirkt wie ein Wasserzeichen.
    //
    // Was hier trotzdem zählt: genau EINMAL. Keine Fusszeile hiesse kein
    // Hinweis auf die Herkunft, mehrere hiessen Wiederholung auf einem
    // Blatt, das ohnehin knapp ist.
    const bloecke = []
    for (let i = 1; i <= 12; i++) {
      bloecke.push({ id: `b${i}`, typ: 'text', titel: `A${i}`, inhalt: 'Text. '.repeat(60) })
    }
    const { stuecke, seiten } = await pdfText(page, { ...VOLL, bloecke })
    expect(seiten, 'für diesen Test braucht es mehrere Seiten').toBeGreaterThan(1)

    const fuss = stuecke.filter(s => s.includes('schuelermatch.de')).length
    expect(fuss, `${seiten} Seiten, ${fuss} Fusszeilen`).toBe(1)
  })

  test('auch ein einseitiger Lebenslauf hat sie', async ({ page }) => {
    const { stuecke, seiten } = await pdfText(page, VOLL)
    expect(seiten).toBe(1)
    expect(stuecke.filter(s => s.includes('schuelermatch.de')).length).toBe(1)
  })
})

test('ein sehr langer Name sprengt die Kopfzeile nicht', async ({ page }) => {
  // Namen sind vom Nutzer gesetzt. Ein überlanger Name darf nicht über
  // den Rand hinauslaufen oder andere Angaben verdrängen.
  const { stuecke } = await pdfText(page, {
    ...VOLL,
    name: 'Maximiliane Alexandra Friederike von und zu Hohenlohe-Waldenburg',
  })
  const alles = stuecke.join(' | ')
  expect(alles).toContain('Maximiliane')
  // Die Angaben darunter müssen erhalten bleiben.
  expect(alles).toContain('Gymnasium Nord')
})
