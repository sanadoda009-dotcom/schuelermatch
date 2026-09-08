// Was die Firma über einen Bewerber sieht (8.9.2026).
//
// DER BEFUND: Neben jedem Bewerber stand eine Ampel — „Top-Match",
// „Passt teils", „Prüfen" — gerechnet aus drei Punkten:
//
//   verifiziert · Alter passt · Lebenslauf gefüllt
//
// Nachgerechnet trägt davon fast nichts:
//
//   verifiziert   Die INSERT-Regel auf `bewerbungen` verlangt
//                 `ist_verifiziert(auth.uid())`. JEDE Bewerbung kommt von
//                 einem verifizierten Schüler — in der laufenden
//                 Datenbank am 4.9. null Ausnahmen. Konstant wahr.
//   Alter passt   Wird mit `supabase/bewerben-nur-alt-genug.sql` ebenfalls
//                 konstant: Wer zu jung ist, kommt gar nicht mehr durch.
//
// Übrig bleibt EIN veränderliches Signal, vorgetragen als Urteil aus
// dreien. Eine Firma, die sich auf „Top-Match" verlässt, wird in die Irre
// geführt — und ein Mensch wird von der Plattform benotet, obwohl die
// Entscheidung der Firma gehört.
//
// Jetzt stehen dort Tatsachen: ob der Lebenslauf ausgefüllt ist, und ob
// ein Anschreiben dabei war.
//
// WICHTIG: Ein FEHLENDES Anschreiben ist ausdrücklich KEIN Minus. Es ist
// seit dem 2.9. freiwillig, und die Anzeigenseite sagt das auch. Es hier
// gegen den Schüler zu werten, wäre ein Wortbruch.

const { test, expect, setupDashboard, warteAufDashboard, FIRMA, SCHUELER, defaultDb } = require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = p => fs.readFileSync(path.join(WURZEL, p), 'utf8')

const JOB = {
  id: 'eigen-1', firma_id: FIRMA.id, firma_name: FIRMA.name,
  titel: 'Aushilfe Eistheke', beschreibung: 'Eis verkaufen.', ort: 'München',
  stundenlohn: 13, mindestalter: 15, kategorie: 'Gastronomie',
  arbeitszeit: 'Wochenende', aktiv: true, aufrufe: 1,
  erstellt_am: '2026-09-01T10:00:00Z', lat: null, lon: null, verfuegbarkeit: null,
}

function db({ cvVoll, anschreiben }) {
  const d = defaultDb()
  d.jobs = [{ ...JOB }]
  d.profiles = d.profiles.map(p => p.id === SCHUELER.id
    ? { ...p, verifiziert: true, alter_jahre: 17,
        lebenslauf_bloecke: cvVoll
          ? [{ id: 'b1', titel: 'Erfahrung', inhalt: 'Zeitungen ausgetragen' }]
          : [] }
    : p)
  d.bewerbungen = [{
    id: 'bw-1', job_id: 'eigen-1', schueler_id: SCHUELER.id, status: 'ausstehend',
    erstellt_am: '2026-09-02T10:00:00Z',
    motivationsschreiben: anschreiben ? 'Ich helfe gern im Café.' : null,
  }]
  return d
}

async function zurBewerbung(page) {
  await page.goto('/dashboard-firma.html')
  await warteAufDashboard(page)
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="bewerbungen"]').click()
  await expect(page.locator('.bewerber-item').first()).toBeVisible({ timeout: 20_000 })
}

test.describe('die Signale sagen, was wirklich unterschiedlich ist', () => {
  test('ausgefüllter Lebenslauf steht als solcher da', async ({ page }) => {
    await setupDashboard(page.context(), { db: db({ cvVoll: true, anschreiben: false }), user: FIRMA })
    await zurBewerbung(page)
    await expect(page.locator('.signal')).toContainText('Lebenslauf ausgefüllt')
  })

  test('leerer Lebenslauf ebenso — als offener Punkt, nicht als Note', async ({ page }) => {
    await setupDashboard(page.context(), { db: db({ cvVoll: false, anschreiben: false }), user: FIRMA })
    await zurBewerbung(page)
    await expect(page.locator('.signal')).toContainText('Lebenslauf noch leer')
  })

  test('ein Anschreiben wird als Plus gezeigt', async ({ page }) => {
    await setupDashboard(page.context(), { db: db({ cvVoll: true, anschreiben: true }), user: FIRMA })
    await zurBewerbung(page)
    await expect(page.locator('.signal')).toHaveCount(2)
    await expect(page.locator('.bewerber-item')).toContainText('mit Anschreiben')
  })

  test('ein fehlendes Anschreiben ist KEIN Minus', async ({ page }) => {
    // Der Kern. Seit dem 2.9. ist es freiwillig, und job.html sagt das
    // auch. Ein „ohne Anschreiben" hier wäre ein Wortbruch.
    await setupDashboard(page.context(), { db: db({ cvVoll: true, anschreiben: false }), user: FIRMA })
    await zurBewerbung(page)
    await expect(page.locator('.signal')).toHaveCount(1)
    await expect(page.locator('.bewerber-item')).not.toContainText('Anschreiben')
  })
})

test.describe('kein Urteil mehr über einen Menschen', () => {
  test('die alte Ampel ist weg', async ({ page }) => {
    await setupDashboard(page.context(), { db: db({ cvVoll: true, anschreiben: true }), user: FIRMA })
    await zurBewerbung(page)
    for (const wort of ['Top-Match', 'Passt teils', 'Prüfen']) {
      await expect(page.locator('.bewerber-item')).not.toContainText(wort)
    }
  })

  test('und auch im Code steht kein Punktestand mehr', async () => {
    // Nur der Code, nicht die Kommentare: Dort steht die alte Ampel
    // absichtlich noch, samt Begruendung, warum sie weg ist. Ein Test,
    // der das mitliest, verlangt das Vergessen der Vorgeschichte.
    const ohneKommentare = lies('js/dashboard-firma.js')
      .split(/\r?\n/).filter(z => !z.trim().startsWith('//')).join(' ')
    expect(ohneKommentare).not.toContain('bewerberAmpel')
    expect(ohneKommentare).not.toContain('Top-Match')
    expect(ohneKommentare).not.toContain('ampel-gruen')
  })
})

test.describe('warum die zwei alten Punkte nichts trugen', () => {
  test('Bewerben setzt Verifizierung voraus', async () => {
    // Deshalb ist „verifiziert" bei einer eingegangenen Bewerbung immer
    // wahr — und als Unterscheidungsmerkmal wertlos.
    expect(lies('supabase/bewerbung-verifiziert.sql'))
      .toContain('public.ist_verifiziert(auth.uid())')
  })

  test('und bald auch das passende Alter', async () => {
    expect(lies('supabase/bewerben-nur-alt-genug.sql'))
      .toContain('public.ist_alt_genug(auth.uid(), job_id)')
  })
})

test.describe('die Mail sagt es jetzt richtig', () => {
  test('kein „Verifiziert-Zeichen", das die Firma gar nicht sieht', async () => {
    // Die Firma sah nie ein Verifiziert-Zeichen — es war einer von drei
    // Punkten in der Ampel, und die gibt es nicht mehr.
    const fn = lies('supabase/functions/mail-ereignis/index.ts')
    expect(fn).not.toContain('Verifiziert-Zeichen')
    expect(fn).toContain('ausschließlich Bewerbungen von verifizierten')
  })
})
