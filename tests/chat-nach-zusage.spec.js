// Wann öffnet sich der Chat? (4.9.2026)
//
// DER BEFUND: Die Seite sagt an drei Stellen zu, dass der Chat erst nach
// einer Zusage offen ist —
//
//   dashboard-schueler.html  „Chats mit Firmen, die deine Bewerbung
//                             angenommen haben."
//   datenschutz.html         „…nach einer Zusage"
//   fuer-firmen.html         sagte bis zum 4.9. das GEGENTEIL:
//                            „antworten direkt im Chat und sagen zu oder ab"
//
// Der Code hält die Zusage: Der Knopf erscheint nur bei
// `status === 'angenommen'`. Die Datenbank nicht — die INSERT-Regel auf
// `nachrichten` prüft nur, ob man an der Bewerbung beteiligt ist, nicht
// den Stand.
//
// Das ist die Falle, die dieses Projekt schon dreimal hatte: EINE
// ZUSAGE, DIE NUR IM BROWSER GILT, IST KEINE ZUSAGE.
//
// Hier wiegt sie schwerer als bei den anderen drei Malen. Der Chat ist
// der einzige Kanal, in dem ein Erwachsener frei formulierten Text an
// ein Kind schicken kann. Genau deshalb hat die Absage bewusst KEIN
// Freitextfeld (js/absage.js) — ein Freitext an einen abgelehnten
// Schüler wäre derselbe Kanal durch die Hintertür. Ohne
// `supabase/chat-erst-nach-zusage.sql` steht die Hintertür offen.

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

function db(status) {
  const d = defaultDb()
  d.jobs = [{ ...JOB }]
  d.bewerbungen = [{
    id: 'bw-1', job_id: 'eigen-1', schueler_id: SCHUELER.id, status,
    erstellt_am: '2026-09-02T10:00:00Z', motivationsschreiben: 'Hallo.',
  }]
  return d
}

async function zurBewerbungsansicht(page) {
  await page.goto('/dashboard-firma.html')
  await warteAufDashboard(page)
  await page.locator('#sidebar-toggle').click()
  await page.locator('.sidebar-item[data-view="bewerbungen"]').click()
  await expect(page.locator('.bewerber-item').first()).toBeVisible({ timeout: 20_000 })
}

test.describe('im Firmen-Dashboard', () => {
  for (const stand of ['ausstehend', 'abgelehnt']) {
    test(`bei „${stand}" gibt es keinen Chat-Knopf`, async ({ page }) => {
      await setupDashboard(page.context(), { db: db(stand), user: FIRMA })
      await zurBewerbungsansicht(page)
      await expect(page.locator('[data-chat]')).toHaveCount(0)
    })
  }

  test('nach der Zusage schon', async ({ page }) => {
    await setupDashboard(page.context(), { db: db('angenommen'), user: FIRMA })
    await zurBewerbungsansicht(page)
    await expect(page.locator('[data-chat]')).toHaveCount(1)
  })
})

test.describe('die Seite sagt überall dasselbe', () => {
  // Vor dem 4.9. war fuer-firmen.html die eine Stelle, die dem Rest der
  // Seite widersprach. Ein Widerspruch in EINEM Satz reicht, damit ein
  // Arbeitgeber mit der falschen Erwartung anfängt.
  const SEITEN = ['fuer-firmen.html', 'dashboard-schueler.html', 'datenschutz.html']

  test('keine Seite stellt den Chat vor die Entscheidung', async () => {
    for (const seite of SEITEN) {
      const text = lies(seite)
      expect(text, `${seite} verspricht den Chat vor der Zusage`)
        .not.toContain('antworten direkt im Chat und sagen zu oder ab')
    }
  })

  test('fuer-firmen.html nennt die Reihenfolge ausdrücklich', async () => {
    const text = lies('fuer-firmen.html')
    expect(text).toContain('Erst nach einer Zusage')
  })

  test('und sagt auch, warum', async () => {
    // Eine Einschränkung ohne Begründung liest sich wie eine Schwäche
    // der Plattform. Sie ist das Gegenteil davon.
    expect(lies('fuer-firmen.html')).toMatch(/Minderjährige/)
  })
})

test.describe('die SQL-Datei zieht die Zusage in die Datenbank', () => {
  const sql = lies('supabase/chat-erst-nach-zusage.sql')
  const wirksam = sql.slice(sql.indexOf('drop policy'), sql.indexOf('-- NACHHER PRUEFEN'))

  test('verlangt den Stand „angenommen"', async () => {
    expect(wirksam).toMatch(/b\.status\s*=\s*'angenommen'/)
  })

  test('behält die bisherige Grenze bei', async () => {
    // Sonst tauscht man eine Lücke gegen eine größere: Ohne die Prüfung
    // auf Beteiligung dürfte jeder in jede fremde Bewerbung schreiben.
    expect(wirksam).toContain('absender_id = auth.uid()')
    expect(wirksam).toContain('b.schueler_id = auth.uid() or j.firma_id = auth.uid()')
  })

  test('ersetzt die alte Regel, statt eine zweite danebenzustellen', async () => {
    // Mehrere erlaubende Regeln werden mit ODER verknüpft — die
    // großzügigere gewinnt. Die Falle vom 27.8.
    expect(wirksam).toContain('drop policy if exists "Nachricht senden"')
  })

  test('fasst das Lesen nicht an', async () => {
    // Wird nach der Zusage doch noch abgelehnt, müssen beide Seiten den
    // Verlauf weiter sehen — und melden können. Wer ihn löscht, nimmt
    // einer Meldung die Grundlage.
    expect(wirksam).not.toMatch(/for\s+select/i)
    expect(sql).toContain('Das LESEN bleibt')
  })
})
