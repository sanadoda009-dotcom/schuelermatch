// Speicherort und Prüfung der Verifizierungs-Dokumente (26.8.).
//
// Hier laden Minderjährige ihren Schülerausweis hoch. Die Erklärung im
// Betreiber-Bereich sagt ausdrücklich: „Nach der Entscheidung werden die
// Dokumente gelöscht (Datensparsamkeit)."
//
// DER BEFUND: Der Pfad wurde aus der Endung des Dateinamens gebaut
// (`file.name.split('.').pop()`). Wer erst ein Foto und später ein PDF
// hochlud, hinterließ ZWEI Dateien. In der Datenbank stand nur die
// neue — die alte war über keinen der beiden Löschwege mehr erreichbar,
// weder über den Knopf des Schülers noch über die Prüfung des
// Betreibers. Der Ausweis eines Minderjährigen wäre also für immer
// liegen geblieben, obwohl beide Seiten „gelöscht" gemeldet haben.
//
// Deshalb entscheidet jetzt der MIME-Typ über die Endung. Der ist vom
// Browser gesetzt und pro Dateiart eindeutig — ein Nutzer, eine
// Dokumentart, ein Pfad.
const { test, expect } = require('./helpers/basis')

async function modul(page, fn, arg) {
  return page.evaluate(async ({ code, arg }) => {
    const m = await import('/js/dokument-pfad.js')
    return new Function('m', 'a', 'return (' + code + ')(m, a)')(m, arg)
  }, { code: fn.toString(), arg })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html')
})

test.describe('ein Nutzer, eine Dokumentart, ein Pfad', () => {
  // Der Kern des Befundes.
  test('Foto und PDF derselben Art landen NICHT auf zwei Pfaden', async ({ page }) => {
    const [alsBild, alsPdf] = await modul(page, m => [
      m.dokumentPfad('u1', 'ausweis', 'image/jpeg'),
      m.dokumentPfad('u1', 'ausweis', 'application/pdf')
    ])
    // Sie dürfen sich unterscheiden — aber der Wechsel muss erkannt
    // werden, damit die alte Datei gelöscht wird (Test weiter unten).
    expect(alsBild).toBe('u1/ausweis.jpg')
    expect(alsPdf).toBe('u1/ausweis.pdf')
  })

  test('dieselbe Bildart ergibt immer denselben Pfad', async ({ page }) => {
    // Vorher hing das am Dateinamen: „Ausweis.JPG" und „ausweis.jpeg"
    // ergaben zwei verschiedene Pfade und damit eine verwaiste Datei.
    const pfade = await modul(page, m =>
      ['image/jpeg', 'image/JPEG', 'image/jpg'].map(t => m.dokumentPfad('u1', 'ausweis', t))
    )
    expect(new Set(pfade).size, 'derselbe Bildtyp muss einen Pfad ergeben').toBe(1)
    expect(pfade[0]).toBe('u1/ausweis.jpg')
  })

  test('die beiden Dokumentarten liegen getrennt', async ({ page }) => {
    const [a, b] = await modul(page, m => [
      m.dokumentPfad('u1', 'ausweis', 'image/png'),
      m.dokumentPfad('u1', 'bestaetigung', 'image/png')
    ])
    expect(a).not.toBe(b)
  })

  test('der Pfad beginnt mit der Nutzer-Id', async ({ page }) => {
    // Daran hängen die Storage-Regeln:
    // storage.foldername(name))[1] = auth.uid()
    // Stimmt der erste Ordner nicht, darf niemand mehr an die Datei.
    const pfad = await modul(page, m => m.dokumentPfad('abc-123', 'ausweis', 'image/png'))
    expect(pfad.split('/')[0]).toBe('abc-123')
  })

  test('ohne erlaubten Typ gibt es keinen Pfad', async ({ page }) => {
    const pfade = await modul(page, m =>
      ['application/zip', '', null, 'text/html'].map(t => m.dokumentPfad('u1', 'ausweis', t))
    )
    expect(pfade).toEqual([null, null, null, null])
  })
})

test.describe('verwaiste Datei erkennen', () => {
  // Genau das fehlte: Beim Ersetzen blieb die alte Datei liegen.
  test('Wechsel von Bild auf PDF meldet die alte Datei', async ({ page }) => {
    const alt = await modul(page, m =>
      m.verwaisterPfad('u1/ausweis.jpg', m.dokumentPfad('u1', 'ausweis', 'application/pdf'))
    )
    expect(alt, 'die alte Datei muss zum Löschen gemeldet werden').toBe('u1/ausweis.jpg')
  })

  test('gleicher Pfad meldet nichts — upsert überschreibt ohnehin', async ({ page }) => {
    const alt = await modul(page, m => m.verwaisterPfad('u1/ausweis.jpg', 'u1/ausweis.jpg'))
    expect(alt).toBeNull()
  })

  test('beim ersten Hochladen gibt es nichts zu löschen', async ({ page }) => {
    const alt = await modul(page, m => m.verwaisterPfad(null, 'u1/ausweis.jpg'))
    expect(alt).toBeNull()
  })

  test('alte Pfade aus der Zeit davor werden mit erfasst', async ({ page }) => {
    // In der Datenbank stehen noch Pfade wie „ausweis.jpeg" oder
    // „ausweis.JPG". Lädt so jemand neu hoch, muss die alte Datei
    // mitgelöscht werden.
    const alt = await modul(page, m =>
      ['u1/ausweis.jpeg', 'u1/ausweis.JPG', 'u1/ausweis.heic'].map(p =>
        m.verwaisterPfad(p, m.dokumentPfad('u1', 'ausweis', 'image/jpeg')))
    )
    expect(alt).toEqual(['u1/ausweis.jpeg', 'u1/ausweis.JPG', 'u1/ausweis.heic'])
  })
})

test.describe('Datei prüfen, bevor sie losgeschickt wird', () => {
  test('ein Bild wird angenommen', async ({ page }) => {
    const r = await modul(page, m => m.pruefeDatei({ type: 'image/jpeg', size: 500000 }))
    expect(r.ok).toBe(true)
  })

  test('ein PDF wird angenommen', async ({ page }) => {
    const r = await modul(page, m => m.pruefeDatei({ type: 'application/pdf', size: 500000 }))
    expect(r.ok).toBe(true)
  })

  test('eine fremde Dateiart wird abgelehnt — auf Deutsch', async ({ page }) => {
    // Der Bucket lehnt sie ohnehin ab, aber mit einer englischen
    // Meldung. Ein 14-Jähriger soll lesen, was er tun soll.
    const r = await modul(page, m => m.pruefeDatei({ type: 'application/zip', size: 1000 }))
    expect(r.ok).toBe(false)
    expect(r.fehler).toMatch(/PDF/)
    expect(r.fehler, 'Meldung muss deutsch sein').not.toMatch(/mime type|not allowed|exceeded/i)
  })

  test('eine zu große Datei wird abgelehnt', async ({ page }) => {
    const r = await modul(page, m => m.pruefeDatei({ type: 'image/jpeg', size: m.MAX_BYTES + 1 }))
    expect(r.ok).toBe(false)
    expect(r.fehler).toMatch(/zu groß/)
  })

  test('die Grenze selbst ist noch erlaubt', async ({ page }) => {
    const r = await modul(page, m => m.pruefeDatei({ type: 'image/jpeg', size: m.MAX_BYTES }))
    expect(r.ok).toBe(true)
  })

  test('ohne Datei kommt kein Absturz', async ({ page }) => {
    const r = await modul(page, m => m.pruefeDatei(null))
    expect(r.ok).toBe(false)
  })

  test('die Grenze stimmt mit dem Bucket überein', async ({ page }) => {
    // supabase/rls-stand.sql: file_size_limit = 6291456
    const max = await modul(page, m => m.MAX_BYTES)
    expect(max).toBe(6291456)
  })

  test('nur Typen, die der Bucket auch zulässt', async ({ page }) => {
    // allowed_mime_types am Bucket. Steht hier ein Typ zu viel, meldet
    // die Seite „passt" und der Storage lehnt danach ab.
    const typen = await modul(page, m => Object.keys(m.ERLAUBTE_TYPEN))
    const amBucket = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf']
    expect(typen.sort()).toEqual(amBucket.sort())
  })
})

test.describe('Anzeige im Betreiber-Bereich', () => {
  test('ein PDF wird als PDF erkannt', async ({ page }) => {
    const r = await modul(page, m => ['u1/a.pdf', 'u1/a.PDF'].map(m.istPdf))
    expect(r).toEqual([true, true])
  })

  test('ein Bild nicht', async ({ page }) => {
    const r = await modul(page, m => ['u1/a.jpg', 'u1/a.png', '', null].map(m.istPdf))
    expect(r).toEqual([false, false, false, false])
  })
})

test('der Upload benutzt das Modul und löscht die alte Datei', async ({ page }) => {
  // Verankert die Einbindung: Nutzt der Upload wieder den Dateinamen,
  // ist der ganze Befund zurück, ohne dass ein Test darüber umfällt.
  const quelle = await page.evaluate(async () => (await fetch('/js/dashboard-schueler.js')).text())

  const bereich = quelle.slice(quelle.indexOf('async function ladeVerifizierungsDokument'))
    .slice(0, 2000)

  expect(bereich, 'Pfad darf nicht mehr aus dem Dateinamen kommen')
    .not.toMatch(/file\.name\.split/)
  expect(bereich, 'Pfad muss aus dem Modul kommen').toMatch(/dokumentPfad\(/)
  expect(bereich, 'Datei muss vorab geprüft werden').toMatch(/pruefeDatei\(/)
  expect(bereich, 'die alte Datei muss entfernt werden').toMatch(/verwaisterPfad\(/)
})

// ---------------------------------------------------------------------
// Dieselbe Falle steckte in vier weiteren Uploads: Profilfoto (zweimal),
// Lebenslauf-Bilder (zweimal) und Zeugnis zur Bewerbung. Bei den Fotos
// wiegt sie schwerer, denn `avatars` und `lebenslauf-bilder` sind
// ÖFFENTLICHE Ablagen — eine zurückgebliebene Datei bleibt unter ihrer
// alten Adresse für jeden abrufbar, auch nachdem der Schüler sein Foto
// ausgetauscht hat.

test.describe('jede Ablage hat ihre eigenen Grenzen', () => {
  test('die Tabelle stimmt mit storage.buckets überein', async ({ page }) => {
    // Weicht sie ab, meldet die Seite „passt" und der Storage lehnt
    // danach trotzdem ab — mit englischer Meldung.
    const b = await modul(page, m => m.BUCKETS)
    expect(b['verifizierung'].maxBytes).toBe(6291456)
    expect(b['zeugnisse'].maxBytes).toBe(6291456)
    expect(b['avatars'].maxBytes).toBe(3145728)
    expect(b['lebenslauf-bilder'].maxBytes).toBe(3145728)
    expect(b['avatars'].oeffentlich).toBe(true)
    expect(b['lebenslauf-bilder'].oeffentlich).toBe(true)
    expect(b['verifizierung'].oeffentlich).toBe(false)
    expect(b['zeugnisse'].oeffentlich).toBe(false)
  })

  test('in ein Profilfoto darf kein PDF', async ({ page }) => {
    const r = await modul(page, m => m.pruefeFuerBucket({ type: 'application/pdf', size: 1000 }, 'avatars'))
    expect(r.ok).toBe(false)
    expect(r.fehler, 'Meldung darf hier nicht von PDF sprechen').not.toMatch(/PDF/)
  })

  test('in ein Zeugnis schon', async ({ page }) => {
    const r = await modul(page, m => m.pruefeFuerBucket({ type: 'application/pdf', size: 1000 }, 'zeugnisse'))
    expect(r.ok).toBe(true)
  })

  test('4 MB sind fürs Foto zu viel, fürs Zeugnis nicht', async ({ page }) => {
    const [foto, zeugnis] = await modul(page, m => {
      const d = { type: 'image/jpeg', size: 4 * 1024 * 1024 }
      return [m.pruefeFuerBucket(d, 'avatars').ok, m.pruefeFuerBucket(d, 'zeugnisse').ok]
    })
    expect(foto).toBe(false)
    expect(zeugnis).toBe(true)
  })

  test('eine unbekannte Ablage wird abgelehnt statt durchgewinkt', async ({ page }) => {
    const r = await modul(page, m => m.pruefeFuerBucket({ type: 'image/jpeg', size: 10 }, 'gibtsnicht'))
    expect(r.ok).toBe(false)
  })

  test('was eine Ablage erlaubt, hat auch eine Endung', async ({ page }) => {
    // Die Invariante, die alles zusammenhält: Kommt eine Datei durch
    // pruefeFuerBucket, MUSS dokumentPfad einen Pfad liefern. Sonst
    // liefe der Upload mit `null` als Pfad ins Leere.
    const ohneEndung = await modul(page, m => {
      const fehlt = []
      for (const [name, regel] of Object.entries(m.BUCKETS))
        for (const typ of regel.typen)
          if (!m.dokumentPfad('u1', 'x', typ)) fehlt.push(name + ': ' + typ)
      return fehlt
    })
    expect(ohneEndung).toEqual([])
  })
})

test.describe('Pfad aus einer öffentlichen Adresse zurückgewinnen', () => {
  // Bei den öffentlichen Ablagen steht in der Datenbank die fertige
  // Adresse, nicht der Pfad. Ohne diesen Schritt liesse sich die
  // Vorgängerdatei gar nicht löschen.
  const BASIS = 'https://blufrvuskqiloslyxjkx.supabase.co/storage/v1/object/public'

  test('mit dem angehängten Zwischenspeicher-Zusatz', async ({ page }) => {
    const pfad = await modul(page, (m, url) => m.pfadAusUrl(url, 'avatars'),
      `${BASIS}/avatars/u1/avatar.jpg?t=1756200000000`)
    expect(pfad).toBe('u1/avatar.jpg')
  })

  test('ohne Zusatz', async ({ page }) => {
    const pfad = await modul(page, (m, url) => m.pfadAusUrl(url, 'lebenslauf-bilder'),
      `${BASIS}/lebenslauf-bilder/u1/block-7.png`)
    expect(pfad).toBe('u1/block-7.png')
  })

  test('die falsche Ablage ergibt nichts', async ({ page }) => {
    // Wichtig: Sonst würde beim Foto-Tausch versucht, eine Datei in der
    // falschen Ablage zu löschen.
    const pfad = await modul(page, (m, url) => m.pfadAusUrl(url, 'avatars'),
      `${BASIS}/lebenslauf-bilder/u1/block-7.png`)
    expect(pfad).toBeNull()
  })

  test('leer, kaputt oder gar nichts ergibt nichts', async ({ page }) => {
    const r = await modul(page, m =>
      ['', null, 'kein-link', 'https://example.com/foo.jpg'].map(u => m.pfadAusUrl(u, 'avatars')))
    expect(r).toEqual([null, null, null, null])
  })

  test('hin und zurück ergibt wieder denselben Pfad', async ({ page }) => {
    const gleich = await modul(page, (m, basis) => {
      const pfad = m.dokumentPfad('u1', 'avatar', 'image/png')
      return m.pfadAusUrl(`${basis}/avatars/${pfad}?t=1`, 'avatars') === pfad
    }, BASIS)
    expect(gleich).toBe(true)
  })
})

test('alle fünf Uploads benutzen das Modul', async ({ page }) => {
  // Verankert die Einbindung an allen Stellen auf einmal. Taucht
  // irgendwo wieder der Dateiname auf, ist der Befund zurück.
  for (const datei of ['/js/dashboard-schueler.js', '/js/lebenslauf.js']) {
    const quelle = await page.evaluate(async d => (await fetch(d)).text(), datei)
    expect(quelle, `${datei}: Pfad darf nicht aus dem Dateinamen kommen`)
      .not.toMatch(/\.name\.split\('\.'\)/)
    expect(quelle, `${datei}: eigene Größengrenze statt der Tabelle`)
      .not.toMatch(/file\.size >/)
  }

  const dash = await page.evaluate(async () => (await fetch('/js/dashboard-schueler.js')).text())
  // Vier Uploads im Dashboard: Verifizierung, Blockbild, Foto, Zeugnis.
  expect((dash.match(/dokumentPfad\(/g) || []).length).toBeGreaterThanOrEqual(4)

  const ll = await page.evaluate(async () => (await fetch('/js/lebenslauf.js')).text())
  expect((ll.match(/dokumentPfad\(/g) || []).length).toBeGreaterThanOrEqual(2)
})

test('bei den öffentlichen Ablagen wird die alte Datei entfernt', async ({ page }) => {
  // Der eigentliche Schutz: `avatars` und `lebenslauf-bilder` sind
  // öffentlich. Bleibt eine Datei liegen, ist sie weiter abrufbar.
  for (const datei of ['/js/dashboard-schueler.js', '/js/lebenslauf.js']) {
    const quelle = await page.evaluate(async d => (await fetch(d)).text(), datei)
    expect(quelle, `${datei}: altes Foto muss gelöscht werden`)
      .toMatch(/from\('avatars'\)\.remove\(\[alterPfad\]\)/)
    expect(quelle, `${datei}: altes Lebenslauf-Bild muss gelöscht werden`)
      .toMatch(/from\('lebenslauf-bilder'\)\.remove\(\[alterPfad\]\)/)
  }
})
