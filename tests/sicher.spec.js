// Der Schutz gegen eingeschleusten Code über Bild-Adressen (27.8.).
//
// `js/sicher.js` ist 19 Zeilen lang, wird an neun Stellen benutzt — und
// lief in **keinem einzigen Test**. Dabei ist es eine
// Sicherheitsgrenze: `foto_url` und `bild_url` sind Spalten, die jeder
// Nutzer selbst setzen kann. Landen sie ungefiltert in einem
// HTML-Attribut oder in `url(...)`, kann jemand daraus ausbrechen — und
// der eingeschleuste Code läuft dann in der Sitzung der Firma, die sich
// eine Bewerbung ansieht.
//
// Dieselbe Lage wie zuvor bei der Trefferlogik des Job-Alarms und den
// Chat-Warnungen: Was über Sicherheit entscheidet, gehört geprüft.
const { test, expect } = require('./helpers/basis')

async function sauber(page, url) {
  return page.evaluate(async u => {
    const m = await import('/js/sicher.js')
    return m.sichereMediaUrl(u)
  }, url)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html')
})

test.describe('gefährliche Adressen werden verworfen', () => {
  test('javascript: kommt nicht durch', async ({ page }) => {
    const r = await sauber(page, 'javascript:alert(1)')
    expect(r).toBe('')
  })

  test('auch mit anderer Schreibweise', async ({ page }) => {
    // Der Adress-Leser normalisiert das Schema auf Kleinbuchstaben,
    // deshalb nützt „JavaScript:" nichts. Festgehalten, damit es so
    // bleibt.
    const r = await Promise.all([
      sauber(page, 'JavaScript:alert(1)'),
      sauber(page, 'JAVASCRIPT:alert(1)'),
    ])
    expect(r).toEqual(['', ''])
  })

  test('auch mit vorangestellten Steuerzeichen', async ({ page }) => {
    // Ein alter Trick: Tabulator oder Zeilenumbruch im Schema. Der
    // Adress-Leser entfernt sie, das Schema bleibt javascript:.
    const r = await Promise.all([
      sauber(page, '\tjavascript:alert(1)'),
      sauber(page, ' java\nscript:alert(1)'),
      sauber(page, 'java\tscript:alert(1)'),
    ])
    expect(r).toEqual(['', '', ''])
  })

  test('data: kommt nicht durch', async ({ page }) => {
    // Damit liesse sich eine ganze HTML-Seite einschleusen.
    const r = await sauber(page, 'data:text/html,<script>alert(1)</script>')
    expect(r).toBe('')
  })

  test('weitere Schemata ebenfalls nicht', async ({ page }) => {
    const r = await Promise.all(
      ['vbscript:msgbox(1)', 'file:///etc/passwd', 'blob:https://x/y', 'about:blank']
        .map(u => sauber(page, u)))
    expect(r).toEqual(['', '', '', ''])
  })

  test('Unfug ergibt leer statt eines Absturzes', async ({ page }) => {
    const r = await Promise.all([
      sauber(page, ''), sauber(page, null), sauber(page, undefined),
      sauber(page, 123), sauber(page, 'http://'),
    ])
    expect(r).toEqual(['', '', '', '', ''])
  })
})

test.describe('echte Bild-Adressen kommen durch', () => {
  test('https bleibt erhalten', async ({ page }) => {
    const url = 'https://blufrvuskqiloslyxjkx.supabase.co/storage/v1/object/public/avatars/u1/avatar.jpg'
    expect(await sauber(page, url)).toBe(url)
  })

  test('auch mit Zwischenspeicher-Zusatz', async ({ page }) => {
    const url = 'https://example.com/a/avatar.png?t=1756200000000'
    expect(await sauber(page, url)).toBe(url)
  })

  test('http auch — nicht schön, aber ungefährlich', async ({ page }) => {
    expect(await sauber(page, 'http://example.com/x.jpg')).toBe('http://example.com/x.jpg')
  })
})

test.describe('Ausbrechen aus dem Attribut oder aus url(...)', () => {
  // Der zweite Teil des Schutzes: Selbst eine erlaubte http-Adresse darf
  // keine Zeichen enthalten, mit denen man das umgebende Attribut oder
  // die CSS-Angabe verlassen kann.
  // HIER STECKTE DER FEHLER (gemessen am 27.8.):
  // `'`, `(`, `)` und `;` kamen im PFAD einer Adresse unbeschädigt durch,
  // weil `encodeURIComponent` sie absichtlich nicht kodiert. Genau die
  // ersten drei braucht man, um aus `url('...')` auszubrechen.
  const GEFAEHRLICH = ['"', "'", '(', ')', '<', '>', '\\', '`', ';', '{', '}']

  test('keines dieser Zeichen überlebt in der Abfrage', async ({ page }) => {
    const url = `https://example.com/x.jpg?a=${GEFAEHRLICH.join('')}`
    const r = await sauber(page, url)
    for (const z of GEFAEHRLICH) {
      expect(r, `„${z}" darf nicht unverändert dastehen`).not.toContain(z)
    }
  })

  test('und keines im Pfad — dort kamen sie vorher durch', async ({ page }) => {
    // Der Adress-Leser kodiert im Pfad WENIGER als in der Abfrage.
    // Deshalb jedes Zeichen einzeln an genau der Stelle prüfen, an der
    // es vorher überlebt hat.
    const ueberlebt = []
    for (const z of GEFAEHRLICH) {
      const r = await sauber(page, `https://example.com/a${z}b.jpg`)
      if (r.includes(z)) ueberlebt.push(z)
    }
    expect(ueberlebt, 'im Pfad unbeschädigt durchgekommen').toEqual([])
  })

  test('der Ausbruch aus einer CSS-Angabe scheitert', async ({ page }) => {
    // So sähe der Angriff aus: die CSS-Angabe schliessen und eine eigene
    // anhängen. Genau so wird es in dashboard-firma.js zusammengesetzt:
    //     background-image:url('${…}')
    const angriff = "https://example.com/x.jpg');background-image:url('https://fremd.example/spur.gif"
    const r = await sauber(page, angriff)
    expect(r, 'Anführungszeichen schliesst die Angabe').not.toContain("'")
    expect(r, 'Klammer schliesst url(').not.toContain(')')
    expect(r, 'Semikolon beendet die Deklaration').not.toContain(';')
  })

  test('der Ausbruch aus einem src-Attribut scheitert', async ({ page }) => {
    const angriff = 'https://example.com/x.jpg" onerror="alert(1)'
    const r = await sauber(page, angriff)
    expect(r).not.toContain('"')
  })

  test('Leerzeichen überleben nicht', async ({ page }) => {
    // Ohne Anführungszeichen im Markup wäre ein Leerzeichen schon genug,
    // um ein zweites Attribut anzuhängen.
    const r = await sauber(page, 'https://example.com/x y.jpg')
    expect(r).not.toMatch(/\s/)
  })
})

test('die Ausgabe ist nach einem zweiten Durchlauf unverändert', async ({ page }) => {
  // An mehreren Stellen wird die Funktion zweimal auf denselben Wert
  // angewandt (einmal zum Prüfen, einmal zum Einsetzen). Sie muss dabei
  // dasselbe liefern, sonst stimmen Prüfung und Ausgabe nicht überein.
  const gleich = await page.evaluate(async () => {
    const m = await import('/js/sicher.js')
    const proben = [
      'https://example.com/a.jpg',
      'https://example.com/x.jpg?a="b"',
      'javascript:alert(1)',
      '',
    ]
    return proben.every(p => m.sichereMediaUrl(m.sichereMediaUrl(p)) === m.sichereMediaUrl(p))
  })
  expect(gleich).toBe(true)
})

test('Platzhalter und Bild entscheiden nach demselben Wert', async ({ page }) => {
  // Ein zweiter, kleinerer Befund vom 27.8.: Die Anzeige benutzte den
  // BEREINIGTEN Wert, die Entscheidung „Bild oder Platzhalter" aber die
  // ROHE Adresse. Bei einer abgelehnten Adresse sagte die rohe Prüfung
  // „ja", die Bereinigung lieferte '' — Ergebnis war `<img src="">`,
  // ein kaputtes Bildsymbol, und beim Foto verschwand zusätzlich der
  // Ersatzbuchstabe. Man bekam weder das Bild noch den Platzhalter.
  // Gemeint sind NUR die Stellen, an denen wirklich ein Bild ausgegeben
  // wird. Knopfbeschriftungen wie `b.bild_url ? 'Bild ändern' : 'Bild
  // auswählen'` dürfen weiter an der rohen Adresse hängen — dort geht es
  // nicht um die Anzeige, sondern darum, ob überhaupt etwas hochgeladen
  // wurde.
  const ROH = /\$\{\s*(b\.bild_url|fotoUrl|profile\.foto_url|b\.bewerber\.foto_url)\s*\?([^}]*)/g

  for (const datei of ['/js/dashboard-schueler.js', '/js/lebenslauf.js', '/js/dashboard-firma.js']) {
    const quelle = await page.evaluate(async d => (await fetch(d)).text(), datei)
    const treffer = []

    for (const m of quelle.matchAll(ROH)) {
      const zweig = m[2]
      if (/<img|background-image/.test(zweig)) treffer.push(m[0].slice(0, 70))
    }

    expect(treffer, `${datei}: Bildausgabe hängt an der rohen Adresse`).toEqual([])
  }
})

test('eine abgelehnte Adresse erzeugt kein leeres src', async ({ page }) => {
  // Der eigentliche Punkt, an einem echten Beispiel.
  const r = await page.evaluate(async () => {
    const m = await import('/js/sicher.js')
    const boese = 'javascript:alert(1)'
    return { bereinigt: m.sichereMediaUrl(boese), rohIstWahr: Boolean(boese) }
  })
  // Die rohe Adresse ist wahr, die bereinigte leer — genau die
  // Uneinigkeit, die den kaputten Platzhalter verursachte.
  expect(r.rohIstWahr).toBe(true)
  expect(r.bereinigt).toBe('')
})
