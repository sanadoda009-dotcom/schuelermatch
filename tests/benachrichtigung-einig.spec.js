// Sagen alle drei Stellen dasselbe über die Mail-Einstellung? (8.9.2026)
//
// `profiles.benachrichtigung` steuert, ob eine Firma E-Mails über neue
// Bewerbungen bekommt: 'sofort' · 'taeglich' (Vorgabe der Spalte) · 'aus'.
// Die Spalte ist NULLABLE — der Vorgabewert greift nur beim Anlegen ohne
// die Spalte.
//
// DER BEFUND: Bei NULL sagten die drei Stellen nicht dasselbe.
//
//   js/dashboard-firma.js   `benachrichtigung || 'taeglich'`
//                           → Profil zeigt „Einmal täglich gesammelt
//                             (empfohlen)"
//   mail-ereignis           `=== 'sofort'`
//                           → keine Sofort-Mail. Richtig.
//   mail-digest             `!== 'taeglich'`  → ÜBERSPRUNGEN
//
// Eine Firma mit NULL sah also im Profil „täglich" und bekam **nie** eine
// Mail — weder sofort noch gesammelt. Still, und deshalb schwer zu
// bemerken: Die Bewerbungen stapeln sich im Dashboard, und ein Schüler
// wartet derweil auf eine Antwort.
//
// Am 8.9.2026 gab es keine Firma mit NULL — die Lücke war latent, nicht
// akut. Geschlossen wurde sie trotzdem: Ein Widerspruch zwischen dem, was
// die Seite anzeigt, und dem, was passiert, wird nicht dadurch besser,
// dass ihn gerade niemand trifft.
//
// Dieser Test hält die drei Stellen aneinander. Es ist dasselbe Muster
// wie bei `ALTERSOPTIONEN` gegen die HTML-Listen und bei `maxlength`
// gegen die CHECK-Regel: Zwei Orte, dieselbe Zahl, ein Test dazwischen.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')
const lies = p => fs.readFileSync(path.join(WURZEL, p), 'utf8')

test.describe('der Rückfall bei NULL ist überall „taeglich"', () => {
  test('das Firmenprofil zeigt es so an', async () => {
    const quelle = lies('js/dashboard-firma.js')
    expect(quelle).toMatch(/benachrichtigung \|\| 'taeglich'/)
  })

  test('die Tageszusammenfassung rechnet genauso', async () => {
    // Der eigentliche Fix dieser Runde.
    const fn = lies('supabase/functions/mail-digest/index.ts')
    expect(fn).toMatch(/benachrichtigung \?\? 'taeglich'/)
  })

  test('und die Sofort-Mail bleibt bei „sofort" streng', async () => {
    // Hier ist ein harter Vergleich richtig: NULL heißt „nicht sofort".
    // Ein Rückfall auf 'sofort' würde ungefragt Mails auslösen.
    const fn = lies('supabase/functions/mail-ereignis/index.ts')
    expect(fn).toMatch(/benachrichtigung === 'sofort'/)
  })
})

test.describe('die Reihenfolge der Prüfungen', () => {
  test('erst ob es die Firma gibt, dann ihre Einstellung', async () => {
    // Beim Einbau selbst hineingetreten: Steht der Zugriff auf
    // `firma.benachrichtigung` vor der Prüfung auf `!firma`, wirft er,
    // sobald die Verknüpfung leer ist — und der ganze Tageslauf bricht ab.
    const fn = lies('supabase/functions/mail-digest/index.ts')
    const iWaechter = fn.indexOf('if (!firma || !firma.email) continue')
    const iZugriff = fn.indexOf('firma.benachrichtigung ??')
    expect(iWaechter).toBeGreaterThan(0)
    expect(iZugriff).toBeGreaterThan(iWaechter)
  })
})

test.describe('die Zusammenfassung sagt den richtigen Zeitraum', () => {
  test('sie zählt 24 Stunden — und sagt das auch', async () => {
    // Der Zeitplan läuft 16:00 UTC. Das Fenster reicht also bis in den
    // Vorabend zurück; „heute" wäre dafür das falsche Wort gewesen.
    const fn = lies('supabase/functions/mail-digest/index.ts')
    expect(fn).toContain('24 * 3600 * 1000')
    expect(fn).toContain('in den letzten 24 Stunden')
    expect(fn).not.toContain('du hast heute')
    expect(fn).not.toContain('Bewerbungen heute')
  })
})

test.describe('die drei Werte selbst', () => {
  test('sind in Auswahl, Datenbank und Funktionen dieselben', async () => {
    // Käme ein vierter dazu, ohne dass die Funktionen ihn kennen, fiele
    // er stillschweigend durch — die Firma bekäme nichts.
    const werte = ['sofort', 'taeglich', 'aus']
    const html = lies('dashboard-firma.html')
    for (const w of werte) {
      expect(html, `${w} fehlt in der Auswahl`).toContain(`value="${w}"`)
    }
    const auswahl = html.slice(html.indexOf('id="profile-benachrichtigung"'))
    const gefunden = [...auswahl.slice(0, auswahl.indexOf('</select>'))
      .matchAll(/value="([a-z]+)"/g)].map(m => m[1])
    expect(gefunden.sort()).toEqual([...werte].sort())
  })
})
