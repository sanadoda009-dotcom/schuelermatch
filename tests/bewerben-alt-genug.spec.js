// Bewerben nur, wenn man alt genug ist (8.9.2026).
//
// DER BEFUND: Das Schüler-Dashboard holt nur Anzeigen, für die man alt
// genug ist —
//
//   js/dashboard-schueler.js:
//     query = query.lte('mindestalter', profile.alter_jahre || MIN_ALTER)
//
// Ein Vierzehnjähriger SIEHT einen „ab 16"-Job dort gar nicht. Die Regel,
// die das Bewerben erlaubt, prüft davon aber nichts:
//
//   „Schüler bewirbt sich"  INSERT with check (
//      auth.uid() = schueler_id and public.ist_verifiziert(auth.uid()))
//
// Über die API genügt die Job-Id — und die steht in jedem geteilten Link
// (job.html?id=…).
//
// DAS IST DIE VIERTE STELLE MIT DEMSELBEN MUSTER. Dreimal wurde sie am
// 26.8. in der Datenbank geschlossen: Mindestalter der Anzeige,
// Verifizierung vor der Bewerbung, Alter bei der Registrierung. Das Alter
// BEIM BEWERBEN blieb offen — auf einer Plattform, deren Kernversprechen
// der Jugendarbeitsschutz ist, ausgerechnet an der Stelle, an der es am
// meisten zählt. Die Altersgrenze einer Anzeige ist keine Empfehlung des
// Arbeitgebers; sie steht dort wegen des Gesetzes.
//
// Gefunden über die Zusagen in den E-Mails: Die Freischalt-Mail sagte
// „Du kannst dich jetzt auf alle Jobs bewerben." Das stimmte für niemanden
// unter dem höchsten Mindestalter — und schlimmer: es stimmte technisch
// sogar, weil nichts es verhinderte.

const { test, expect, setupDashboard, warteAufDashboard, SCHUELER, defaultDb } = require('./helpers/supabase-fake')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = p => fs.readFileSync(path.join(WURZEL, p), 'utf8')

test.describe('das Dashboard zeigt nur passende Anzeigen', () => {
  test('filtert serverseitig nach dem eigenen Alter', async () => {
    // Der Filter steht in der Abfrage, nicht erst im Rendern — sonst
    // lägen die Daten schon im Browser.
    const quelle = lies('js/dashboard-schueler.js')
    expect(quelle).toMatch(/lte\('mindestalter',\s*profile\.alter_jahre/)
  })

  test('und rechnet ohne Altersangabe mit dem Mindestalter', async () => {
    // `profile.alter_jahre || MIN_ALTER` — dieselbe Zahl muss in der
    // Datenbankregel stehen, sonst sagen beide Seiten etwas anderes.
    const quelle = lies('js/dashboard-schueler.js')
    expect(quelle).toMatch(/profile\.alter_jahre \|\| MIN_ALTER/)
    expect(lies('supabase/bewerben-nur-alt-genug.sql'))
      .toMatch(/coalesce\(p\.alter_jahre, 13\)/)
    // Und 13 ist wirklich MIN_ALTER.
    expect(lies('js/jugendschutz.js')).toMatch(/MIN_ALTER = 13/)
  })
})

test.describe('die Mail verspricht nicht mehr zu viel', () => {
  test('„auf alle Jobs" steht so nicht mehr da', async () => {
    const fn = lies('supabase/functions/mail-ereignis/index.ts')
    expect(fn).toContain('alt genug bist')
    expect(fn).not.toMatch(/auf alle Jobs bewerben\.\s*Arbeitgeber/)
  })
})

test.describe('die SQL-Datei zieht die Altersgrenze in die Datenbank', () => {
  const sql = lies('supabase/bewerben-nur-alt-genug.sql')
  const wirksam = sql.slice(sql.indexOf('create or replace function'),
                            sql.indexOf('-- NACHHER PRUEFEN'))

  test('die Regel prüft das Alter zusätzlich zur Verifizierung', async () => {
    expect(wirksam).toContain('public.ist_verifiziert(auth.uid())')
    expect(wirksam).toContain('public.ist_alt_genug(auth.uid(), job_id)')
    expect(wirksam).toContain('auth.uid() = schueler_id')
  })

  test('räumt BEIDE alten Regelnamen weg', async () => {
    // Am 26.8. stand die neue Regel neben der alten, und PostgreSQL
    // verknüpft mehrere erlaubende Regeln mit ODER — die großzügigere
    // gewinnt, die Prüfung war wirkungslos. Genau deshalb hier beides.
    expect(wirksam).toContain('drop policy if exists "Bewerben"')
    expect(wirksam).toContain('drop policy if exists "Schueler bewirbt sich"')
  })

  test('eine Anzeige ohne Altersangabe erlaubt keine Bewerbung', async () => {
    // Sonst wäre die Lücke nur verschoben: Kein Mindestalter, keine
    // Grenze. Das Dashboard blendet solche Anzeigen ebenfalls aus.
    expect(wirksam).toContain('job.mindestalter is not null')
  })

  test('vergleicht in die richtige Richtung', async () => {
    // `>=` und nicht `<=` — ein vertauschtes Zeichen kehrte die Regel um
    // und ließe genau die Falschen durch.
    expect(wirksam).toMatch(/coalesce\(p\.alter_jahre, 13\)\s*>=\s*job\.mindestalter/)
  })

  test('sagt, wie man nachprüft und wie man zurückkommt', async () => {
    expect(sql).toMatch(/NACHHER PRUEFEN/)
    expect(sql).toMatch(/Rueckgaengig/)
  })
})
