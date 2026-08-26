// Sicherheits-Helfer gegen XSS über nutzergelieferte URLs (Security-Fix #3).
//
// foto_url/bild_url sind frei vom Nutzer setzbar (Profil-Spalten). Werden sie
// unescaped in ein HTML-Attribut oder eine CSS url(...)-Angabe eingesetzt, kann
// ein Angreifer aus dem Attribut ausbrechen und Code einschleusen – der dann
// z.B. in der Session der Firma läuft, die eine Bewerber-Karte ansieht.
//
// sichereMediaUrl():
//   - erlaubt nur http(s)-URLs (blockt javascript:, data: usw.)
//   - entfernt Zeichen, mit denen man aus url(...) oder Attributen ausbrechen
//     könnte (Anführungszeichen, Klammern, spitze Klammern, Backslash,
//     Backtick, Semikolon, geschweifte Klammern, Leerzeichen)
//   - gibt '' zurück, wenn die URL ungültig/gefährlich ist
//
// ACHTUNG, HIER STECKTE EIN FEHLER (gefunden am 27.8.2026):
// Ersetzt wurde mit `encodeURIComponent` als Ersetzungsfunktion. Die
// kodiert `'`, `(` und `)` aber ABSICHTLICH NICHT — das sind dort
// „unreservierte" Zeichen. Im PFAD einer Adresse überlebten sie damit
// unverändert. Und genau diese drei braucht man, um aus
//
//     background-image:url('...')
//
// auszubrechen, wie es in dashboard-firma.js und dashboard-schueler.js
// zusammengesetzt wird. Gemessen: `'`, `(`, `)` und `;` kamen im Pfad
// unbeschadet durch.
//
// Der Kommentar oben versprach also etwas, das der Code nicht hielt —
// und geprüft wurde die Funktion in keinem einzigen Test. Seit dem
// 27.8. hält `tests/sicher.spec.js` es fest.
//
// Deshalb jetzt eine eigene Kodierung statt encodeURIComponent. Alle
// betroffenen Zeichen sind ASCII, ein Byte je Zeichen genügt.
const AUSBRUCH = /["'()<>\\`;{}\s]/g

export function sichereMediaUrl(url) {
  if (typeof url !== 'string' || !url) return ''
  let u
  try { u = new URL(url, location.origin) } catch { return '' }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
  return u.href.replace(AUSBRUCH, z =>
    '%' + z.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))
}
