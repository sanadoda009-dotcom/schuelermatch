// Trefferlogik des Job-Alarms (26.8.).
//
// Diese Logik entscheidet, welche Anzeigen ein Schüler per E-Mail
// bekommt — und sie war bisher **völlig ungeprüft**. Sie steckte mitten
// in der Edge Function, die man ohne Datenbank und ohne Deno-Laufzeit
// nicht ausführen kann.
//
// Herausgezogen nach `supabase/functions/mail-job-alarm/treffer.js`:
// reines JavaScript, ohne Deno- oder Supabase-Abhängigkeiten. Die Edge
// Function importiert es, und dieser Test lädt dasselbe Modul über den
// Testserver.
//
// Der heikelste Teil ist die Altersprüfung. Wer sie falsch herum
// schreibt, schickt einem 13-Jährigen Anzeigen ab 16 zu.
const { test, expect } = require('./helpers/basis')

const MODUL = '/supabase/functions/mail-job-alarm/treffer.js'

// Führt einen Ausdruck gegen das echte Modul aus.
async function rechne(page, ausdruck) {
  return page.evaluate(async ([pfad, code]) => {
    const m = await import(pfad)
    return new Function('m', `return ${code}`)(m)
  }, [MODUL, ausdruck])
}

// Ein Alarm ohne jede Einschränkung, als Ausgangspunkt.
const ALARM = {
  ort: null, lat: null, lon: null, umkreis_km: 25,
  kategorie: null, arbeitszeit: null, min_lohn: null,
  zuletzt_gesendet: '2026-08-01T00:00:00Z',
}
const JOB = {
  titel: 'Nachhilfe', ort: 'München', kategorie: 'Nachhilfe',
  arbeitszeit: 'Nachmittags', stundenlohn: 12, mindestalter: 14,
  lat: 48.137, lon: 11.575, erstellt_am: '2026-08-20T10:00:00Z',
}
const PROFIL = { alter_jahre: 16 }

// Hilfsschreibweise: passt(job-Änderungen, alarm-Änderungen, profil-Änderungen)
function ruf(job = {}, alarm = {}, profil = {}) {
  return `m.passtZumAlarm(${JSON.stringify({ ...JOB, ...job })}, `
    + `${JSON.stringify({ ...ALARM, ...alarm })}, `
    + `${JSON.stringify({ ...PROFIL, ...profil })})`
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html')
})

test('ein passender Job wird gefunden', async ({ page }) => {
  expect(await rechne(page, ruf())).toBe(true)
})

// -----------------------------------------------------------------------
// Jugendschutz — der wichtigste Teil.
// -----------------------------------------------------------------------
test.describe('Altersgrenze', () => {
  test('ein zu junger Schüler bekommt die Anzeige NICHT', async ({ page }) => {
    expect(await rechne(page, ruf({ mindestalter: 16 }, {}, { alter_jahre: 13 })),
      'ein 13-Jähriger darf keine Anzeige ab 16 zugeschickt bekommen').toBe(false)
  })

  test('genau das Mindestalter reicht', async ({ page }) => {
    // Die klassische Stelle für einen Vorzeichenfehler.
    expect(await rechne(page, ruf({ mindestalter: 15 }, {}, { alter_jahre: 15 }))).toBe(true)
  })

  test('ein Jahr zu jung reicht nicht', async ({ page }) => {
    expect(await rechne(page, ruf({ mindestalter: 15 }, {}, { alter_jahre: 14 }))).toBe(false)
  })

  test('ohne Mindestalter an der Anzeige wird nicht ausgeschlossen', async ({ page }) => {
    expect(await rechne(page, ruf({ mindestalter: null }, {}, { alter_jahre: 13 }))).toBe(true)
  })

  test('ohne Altersangabe im Profil wird nicht ausgeschlossen', async ({ page }) => {
    // Lieber einmal zu viel zeigen als jemanden grundlos aussperren —
    // das Mindestalter steht an jeder Anzeige ohnehin dabei.
    expect(await rechne(page, ruf({ mindestalter: 16 }, {}, { alter_jahre: null }))).toBe(true)
  })
})

// -----------------------------------------------------------------------
// Ort und Umkreis
// -----------------------------------------------------------------------
test.describe('Ort', () => {
  const MUENCHEN = { lat: 48.137, lon: 11.575 }
  const AUGSBURG = { lat: 48.371, lon: 10.898 }   // rund 55 km entfernt

  test('innerhalb des Umkreises: ja', async ({ page }) => {
    expect(await rechne(page, ruf(MUENCHEN, { ...MUENCHEN, umkreis_km: 25 }))).toBe(true)
  })

  test('außerhalb des Umkreises: nein', async ({ page }) => {
    expect(await rechne(page, ruf(AUGSBURG, { ...MUENCHEN, umkreis_km: 25 }))).toBe(false)
  })

  test('größerer Umkreis holt den entfernten Job wieder herein', async ({ page }) => {
    expect(await rechne(page, ruf(AUGSBURG, { ...MUENCHEN, umkreis_km: 80 }))).toBe(true)
  })

  test('die Entfernung stimmt ungefähr', async ({ page }) => {
    // München–Augsburg sind rund 55 km Luftlinie.
    const km = await rechne(page, 'm.entfernungKm(48.137, 11.575, 48.371, 10.898)')
    expect(km).toBeGreaterThan(45)
    expect(km).toBeLessThan(65)
  })

  test('ohne Koordinaten wird über den Ortsnamen verglichen', async ({ page }) => {
    const ohneKoord = { lat: null, lon: null }
    expect(await rechne(page, ruf({ ...ohneKoord, ort: 'Köln' }, { ...ohneKoord, ort: 'köln' })),
      'Groß- und Kleinschreibung darf keine Rolle spielen').toBe(true)
    expect(await rechne(page, ruf({ ...ohneKoord, ort: 'Hamburg' }, { ...ohneKoord, ort: 'Köln' })))
      .toBe(false)
  })

  test('Leerzeichen am Rand stören den Vergleich nicht', async ({ page }) => {
    const ohneKoord = { lat: null, lon: null }
    expect(await rechne(page, ruf({ ...ohneKoord, ort: ' Köln ' }, { ...ohneKoord, ort: 'Köln' })))
      .toBe(true)
  })

  test('ein Alarm ohne Ort schränkt nicht ein', async ({ page }) => {
    const ohneKoord = { lat: null, lon: null }
    expect(await rechne(page, ruf({ ...ohneKoord, ort: 'Flensburg' }, { ...ohneKoord, ort: null })))
      .toBe(true)
  })
})

// -----------------------------------------------------------------------
// Die übrigen Filter — leer heißt „egal", nicht „muss leer sein".
// -----------------------------------------------------------------------
test.describe('Kategorie, Arbeitszeit, Lohn', () => {
  test('falsche Kategorie fällt raus', async ({ page }) => {
    expect(await rechne(page, ruf({ kategorie: 'Verkauf' }, { kategorie: 'Nachhilfe' }))).toBe(false)
  })

  test('leere Kategorie im Alarm heißt egal', async ({ page }) => {
    expect(await rechne(page, ruf({ kategorie: 'Verkauf' }, { kategorie: null }))).toBe(true)
  })

  test('falsche Arbeitszeit fällt raus', async ({ page }) => {
    expect(await rechne(page, ruf({ arbeitszeit: 'Wochenende' }, { arbeitszeit: 'Nachmittags' })))
      .toBe(false)
  })

  test('zu niedriger Lohn fällt raus', async ({ page }) => {
    expect(await rechne(page, ruf({ stundenlohn: 9 }, { min_lohn: 12 }))).toBe(false)
  })

  test('genau der Mindestlohn reicht', async ({ page }) => {
    expect(await rechne(page, ruf({ stundenlohn: 12 }, { min_lohn: 12 }))).toBe(true)
  })

  test('eine Anzeige ohne Lohnangabe erfüllt keinen Mindestlohn', async ({ page }) => {
    // Sonst bekäme jemand mit „ab 12 €" Anzeigen ohne jede Angabe.
    expect(await rechne(page, ruf({ stundenlohn: null }, { min_lohn: 12 }))).toBe(false)
  })

  test('ohne Mindestlohn im Alarm ist eine Anzeige ohne Angabe in Ordnung', async ({ page }) => {
    expect(await rechne(page, ruf({ stundenlohn: null }, { min_lohn: null }))).toBe(true)
  })
})

// -----------------------------------------------------------------------
// Keine Wiederholungen
// -----------------------------------------------------------------------
test.describe('nur Neues', () => {
  test('was vor der letzten Mail da war, wird nicht erneut geschickt', async ({ page }) => {
    expect(await rechne(page, ruf(
      { erstellt_am: '2026-08-10T00:00:00Z' },
      { zuletzt_gesendet: '2026-08-15T00:00:00Z' })),
      'sonst bekommt jemand denselben Job jeden Tag').toBe(false)
  })

  test('genau der Zeitpunkt der letzten Mail zählt als schon geschickt', async ({ page }) => {
    expect(await rechne(page, ruf(
      { erstellt_am: '2026-08-15T00:00:00Z' },
      { zuletzt_gesendet: '2026-08-15T00:00:00Z' }))).toBe(false)
  })

  test('was danach kam, wird geschickt', async ({ page }) => {
    expect(await rechne(page, ruf(
      { erstellt_am: '2026-08-15T00:00:01Z' },
      { zuletzt_gesendet: '2026-08-15T00:00:00Z' }))).toBe(true)
  })
})

test('trefferFuer liefert nur die passenden Anzeigen', async ({ page }) => {
  const treffer = await rechne(page, `m.trefferFuer([
    ${JSON.stringify({ ...JOB, titel: 'passt' })},
    ${JSON.stringify({ ...JOB, titel: 'zu jung', mindestalter: 18 })},
    ${JSON.stringify({ ...JOB, titel: 'zu alt', erstellt_am: '2026-07-01T00:00:00Z' })}
  ], ${JSON.stringify(ALARM)}, ${JSON.stringify(PROFIL)}).map(j => j.titel)`)
  expect(treffer).toEqual(['passt'])
})
