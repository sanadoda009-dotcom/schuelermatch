// Die E-Mail im Profil darf niemand frei setzen (4.9.2026).
//
// DER BEFUND, aus der laufenden Datenbank gelesen:
//
//   Regel   "Eigenes Profil bearbeiten"  UPDATE using (auth.uid() = id)
//   Trigger trg_schuetze_profil -> schuetze_profil_felder()
//             friert ein: ist_admin, verifiziert, firma_status, role
//
// `email` steht nicht darunter, und RLS wirkt auf ZEILEN, nicht auf
// Spalten. Über die API mit dem öffentlichen anon-Key kann also jeder
// angemeldete Nutzer `profiles.email` auf eine beliebige Adresse setzen.
//
// Das zählt, weil die Edge Function `mail-ereignis` den Empfänger seit
// dem Security-Fix #2 bewusst AUTORITATIV aus der Datenbank lädt
// (`.select('email, name, verifiziert, firma_status')`) statt aus der
// eingehenden Payload. Der Fix hat die Payload dichtgemacht — aber die
// Quelle, auf die er ausweicht, ist selbst beschreibbar.
//
// WAS HIER GEPRÜFT WIRD
// Die Regel liegt in der Datenbank; ändern kann sie nur Sanad
// (supabase/profil-email-festnageln.sql). Prüfbar sind die zwei
// Annahmen, auf denen sie steht:
//   1. Kein Code im Frontend schreibt `profiles.email` — sonst würde der
//      Trigger einen legitimen Weg still abwürgen.
//   2. `mail-ereignis` liest den Empfänger wirklich aus dieser Spalte —
//      sonst ginge die Begründung ins Leere.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = p => fs.readFileSync(path.join(WURZEL, p), 'utf8')

test.describe('die Annahmen der Regel', () => {
  test('kein Frontend-Code schreibt profiles.email', async () => {
    // Wächter: Käme so eine Stelle dazu, würde der Trigger sie still
    // zurücksetzen — der Nutzer sähe „gespeichert" und nichts passierte.
    // Dann muss diese Runde neu gedacht werden, nicht der Test gelockert.
    for (const datei of ['js/dashboard-schueler.js', 'js/dashboard-firma.js', 'js/auth.js']) {
      const quelle = lies(datei)
      const bloecke = quelle.split('const updates = {')
        .slice(1)
        .map(b => b.slice(0, b.indexOf('}')))
      for (const block of bloecke) {
        expect(block, `${datei}: schreibt email ins Profil`).not.toMatch(/\bemail\s*:/)
      }
    }
  })

  test('mail-ereignis nimmt den Empfänger aus profiles.email', async () => {
    const fn = lies('supabase/functions/mail-ereignis/index.ts')
    expect(fn).toContain("from('profiles')")
    expect(fn).toMatch(/\.select\('email/)
  })
})

test.describe('die SQL-Datei', () => {
  const sql = lies('supabase/profil-email-festnageln.sql')
  const wirksam = sql.slice(sql.indexOf('create or replace function'),
                            sql.indexOf('-- NACHHER PRUEFEN'))

  test('nimmt email dazu', async () => {
    expect(wirksam).toMatch(/new\.email\s*:=\s*old\.email/)
  })

  test('behält die vier bisherigen Spalten', async () => {
    // Die Funktion wird ERSETZT, nicht ergänzt. Fiele hier eine Spalte
    // weg, risse diese Datei eine ältere Lücke wieder auf — genau der
    // Fehler, den `rls-stand.sql` am 27.8. beinahe verursacht hätte.
    for (const spalte of ['ist_admin', 'verifiziert', 'firma_status', 'role']) {
      expect(wirksam, `${spalte} fehlt`).toMatch(
        new RegExp(`new\\.${spalte}\\s*:=\\s*old\\.${spalte}`))
    }
  })

  test('lässt Admins weiter durch', async () => {
    expect(wirksam).toContain('ist_admin()')
  })
})

test.describe('Richtigstellung zu bewerbung-inhalt-schuetzen.sql', () => {
  test('OFFENE-PUNKTE.md sagt, dass die Datei nicht nötig ist', async () => {
    // Am 2.9. als offene Lücke gemeldet: Eine Firma könne den Text einer
    // fremden Bewerbung ändern. Die UPDATE-Regel schränkt tatsächlich
    // keine Spalten ein — aber `trg_schuetze_bewerbung` fängt es längst
    // ab und setzt `motivationsschreiben` still zurück. Die Lücke gibt
    // es nicht; ich hatte die Trigger nicht gelesen.
    //
    // Dieser Test hält die Richtigstellung fest, damit sie nicht beim
    // nächsten Aufräumen wieder herausfällt.
    const punkte = lies('OFFENE-PUNKTE.md')
    expect(punkte).toContain('Richtigstellung')
    expect(punkte).toContain('trg_schuetze_bewerbung')
    // Und die Datei steht nicht mehr in der Pflichttabelle.
    expect(punkte).not.toMatch(/^\| `supabase\/bewerbung-inhalt-schuetzen\.sql` \|/m)
  })
})
