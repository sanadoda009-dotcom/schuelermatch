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
//     könnte (Anführungszeichen, Klammern, spitze Klammern, Backslash, Space)
//   - gibt '' zurück, wenn die URL ungültig/gefährlich ist
export function sichereMediaUrl(url) {
  if (typeof url !== 'string' || !url) return ''
  let u
  try { u = new URL(url, location.origin) } catch { return '' }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
  return u.href.replace(/["'()<>\\\s]/g, encodeURIComponent)
}
