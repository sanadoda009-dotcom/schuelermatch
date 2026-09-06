// Grenzen für Bewerbungen und Freitext (4.9.2026).
//
// DER BEFUND: Alle UNIQUE- und CHECK-Regeln der laufenden Datenbank
// ausgelesen. Fast jede Tabelle hat welche —
//
//   bewertungen    UNIQUE (firma_id, schueler_id) · sterne 1–5 · kommentar ≤ 600
//   gemerkte_jobs  UNIQUE (schueler_id, job_id)
//   job_alarme     UNIQUE (schueler_id) · umkreis_km 1–200
//   nachrichten    text nicht leer und ≤ 2000
//   meldungen      grund/typ/status aus fester Liste · beschreibung ≤ 1000
//   jobs           mindestalter 13–20 · stundenlohn 0–100 · titel nicht leer
//   profiles       role/firma_status/benachrichtigung fest · alter_jahre 13–20
//
// — `bewerbungen` als EINZIGE gar keine.
//
// Daraus folgt dreierlei:
//
//   1. Ein Schüler kann sich beliebig oft auf dieselbe Anzeige bewerben.
//      Im Browser blendet `beworbenIds` den Knopf aus; über die API nicht.
//      Und an jedem INSERT hängt `bewerbung_mail_insert` → mail-ereignis
//      → Resend. Jede Doppelbewerbung ist eine weitere Mail von der
//      verifizierten Domain — Freitarif 100/Tag, danach kommt auch keine
//      Zusage mehr an.
//   2. `status` darf beliebiger Text sein, obwohl der Code genau drei
//      Werte kennt. Jede andere Status-Spalte im Projekt hat eine Liste.
//   3. `motivationsschreiben` hatte weder in der Datenbank noch im
//      Formular eine Obergrenze — ausgerechnet das Feld, das eine fremde
//      Firma zu lesen bekommt.
//
// Wieder dasselbe Muster: Was nur der Browser prüft, ist nicht geprüft.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = p => fs.readFileSync(path.join(WURZEL, p), 'utf8')

test.describe('das Formular nennt die Grenze', () => {
  test('das Anschreiben hat ein maxlength', async () => {
    const html = lies('dashboard-schueler.html')
    expect(html).toMatch(/id="bewerbung-motivation"[^>]*maxlength="2000"/)
  })

  test('und sie steht auch als Satz da', async () => {
    // Ein stilles maxlength schneidet eingefügten Text ab, ohne es zu
    // sagen. Wer 2500 Zeichen einfügt, soll wissen, was passiert ist.
    expect(lies('dashboard-schueler.html')).toContain('Höchstens 2000 Zeichen')
  })

  test('Formular und Datenbank nennen dieselbe Zahl', async () => {
    // Weichen sie ab, sagt das Formular „passt" und die Datenbank lehnt
    // danach ab — genau die Sackgasse, die am 24.8. beim Passwort
    // entstanden ist (Formular 8 Zeichen, Server 10).
    const html = lies('dashboard-schueler.html')
    const sql = lies('supabase/bewerbung-grenzen.sql')
    const ausHtml = html.match(/id="bewerbung-motivation"[^>]*maxlength="(\d+)"/)[1]
    const ausSql = sql.match(/char_length\(motivationsschreiben\) <= (\d+)/)[1]
    expect(ausHtml).toBe(ausSql)
  })

  test('dasselbe für „Wer ihr seid" der Firma', async () => {
    const ausHtml = lies('dashboard-firma.html')
      .match(/id="profile-ueber-uns"[^>]*maxlength="(\d+)"/)[1]
    const ausSql = lies('supabase/bewerbung-grenzen.sql')
      .match(/char_length\(ueber_mich\) <= (\d+)/)[1]
    expect(ausHtml).toBe(ausSql)
  })
})

test.describe('die SQL-Datei schließt die drei Lücken', () => {
  const sql = lies('supabase/bewerbung-grenzen.sql')
  const wirksam = sql.slice(sql.indexOf('create unique index'),
                            sql.indexOf('-- VORHER NACHZAEHLEN'))

  test('eine Bewerbung je Anzeige und Schüler', async () => {
    expect(wirksam).toMatch(/create unique index if not exists[\s\S]*bewerbungen \(job_id, schueler_id\)/)
  })

  test('nur die drei Stände, die der Code kennt', async () => {
    for (const stand of ['ausstehend', 'angenommen', 'abgelehnt']) {
      expect(wirksam).toContain(`'${stand}'`)
    }
  })

  test('die Stände stimmen mit dem Code überein', async () => {
    // Käme im Code ein vierter dazu, ohne dass die Regel ihn kennt,
    // schlüge das Speichern fehl — und niemand wüsste warum.
    const quelle = lies('js/absage.js') + lies('js/dashboard-firma.js')
    const imCode = new Set((quelle.match(/'(ausstehend|angenommen|abgelehnt)'/g) || [])
      .map(t => t.replace(/'/g, '')))
    for (const stand of imCode) {
      expect(wirksam, `Stand ${stand} fehlt in der Regel`).toContain(`'${stand}'`)
    }
    expect(imCode.size).toBeGreaterThan(1)
  })

  test('Obergrenzen für die drei offenen Freitextfelder', async () => {
    expect(wirksam).toContain('char_length(motivationsschreiben)')
    expect(wirksam).toContain('char_length(beschreibung)')
    expect(wirksam).toContain('char_length(ueber_mich)')
  })

  test('läuft auch beim zweiten Mal durch', async () => {
    // `create unique index` kennt `if not exists`, `add constraint`
    // nicht — deshalb steht vor jedem ein `drop constraint if exists`.
    // Ohne das bricht ein zweiter Aufruf mit einem Fehler ab.
    const anlegen = (wirksam.match(/add constraint/g) || []).length
    const wegraeumen = (wirksam.match(/drop constraint if exists/g) || []).length
    expect(wegraeumen).toBe(anlegen)
  })
})
