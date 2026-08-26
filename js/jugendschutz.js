// Die Altersregeln des Jugendarbeitsschutzes — an einer Stelle.
//
// WARUM ES DIESES MODUL GIBT (26.8.2026)
// Das Anzeigenformular bot als Mindestalter **10, 11 und 12** an, und
// geprüft wurde der Wert nirgends. Eine Firma konnte also eine Anzeige
// „ab 10 Jahren" veröffentlichen, und sie ging sofort live — auf einer
// Plattform, deren Kernversprechen der Jugendarbeitsschutz ist.
//
// Die Seite widersprach sich damit selbst. `jugendarbeitsschutz.html`
// sagt wörtlich: „Unter 13 Jahren: Arbeiten ist grundsätzlich nicht
// erlaubt." Die Startseite wirbt mit „ab 13". Nur das Formular wusste
// davon nichts.
//
// Eigenes Modul ohne Abhängigkeiten, damit die Regeln prüfbar sind und
// nicht ein zweites Mal auseinanderlaufen.
//
// RECHTSSTAND: § 5 Abs. 1 JArbSchG verbietet die Beschäftigung von
// Kindern; § 5 Abs. 3 erlaubt ab 13 leichte, kindgerechte Tätigkeiten
// mit Einwilligung der Eltern. Die Ausnahme in § 6 (Mitwirkung bei
// Veranstaltungen mit behördlicher Genehmigung) bildet diese Plattform
// bewusst NICHT ab — dafür ist sie nicht gedacht.
//
// Das ersetzt keine Rechtsberatung, sondern hält die Seite mit dem in
// Einklang, was sie selbst auf `jugendarbeitsschutz.html` erklärt.

// Unter 13 darf gar nicht gearbeitet werden — die harte Untergrenze.
export const MIN_ALTER = 13

// Nach oben offen gelassen: Ein Arbeitgeber darf einen Job auf
// Volljährige beschränken, das ist sein gutes Recht.
export const MAX_ALTER = 20

export const ALTERSOPTIONEN = Array.from(
  { length: MAX_ALTER - MIN_ALTER + 1 },
  (_, i) => MIN_ALTER + i
)

// Prüft das Mindestalter einer Anzeige.
// Gibt `{ ok: true }` oder `{ ok: false, fehler: '…' }` zurück.
// Liest eine Altersangabe. Gibt `null` zurueck, wenn gar nichts
// dasteht — WICHTIG, denn `Number('')` ist 0 und `Number.isInteger(0)`
// ist wahr. Ohne diesen Schritt bekam eine leere Auswahl die Meldung
// „unter 13 ist nicht erlaubt" statt „bitte waehle dein Alter".
function alsAlter(wert) {
  if (wert === null || wert === undefined) return null
  const t = String(wert).trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isInteger(n) ? n : null
}

export function pruefeMindestalter(alter) {
  const n = alsAlter(alter)

  if (n === null)
    return { ok: false, fehler: 'Bitte gib ein Mindestalter an.' }

  if (n < MIN_ALTER)
    return {
      ok: false,
      fehler: `Unter ${MIN_ALTER} Jahren ist Arbeiten in Deutschland nicht erlaubt (§ 5 Jugendarbeitsschutzgesetz). Bitte trage mindestens ${MIN_ALTER} ein.`
    }

  if (n > MAX_ALTER)
    return { ok: false, fehler: `Bitte gib ein Mindestalter von höchstens ${MAX_ALTER} an.` }

  return { ok: true }
}

// Ein Hinweis an den Arbeitgeber, passend zum gewählten Alter.
// Kein Verbot — die meisten wissen schlicht nicht, was für 13-Jährige
// gilt, und erfahren es sonst nirgends im Ablauf.
//
// Die Texte folgen `jugendarbeitsschutz.html`, damit die Seite nicht
// zweierlei erzählt.
export function hinweisFuer(alter) {
  const n = alsAlter(alter)
  if (n === null) return null

  if (n <= 14)
    return 'Bei 13- und 14-Jährigen sind nur leichte, kindgerechte Tätigkeiten erlaubt – höchstens 2 Stunden am Tag, nicht vor der Schule und nicht nach 18 Uhr. Die Eltern müssen schriftlich einwilligen.'

  if (n <= 17)
    return 'Bei Schulpflichtigen unter 18 gelten während der Schulzeit dieselben engen Grenzen. In den Ferien sind bis zu 8 Stunden täglich möglich, höchstens 4 Wochen im Jahr.'

  return null
}

// ---------------------------------------------------------------------
// Dieselbe Grenze auf der Schülerseite.
//
// Die Registrierung bot als Alter ebenfalls **10, 11 und 12** an — auf
// einer Plattform, die überall „ab 13" sagt. Ein Zehnjähriger konnte
// sich ein Konto anlegen. Geprüft wurde der Wert weder im Browser noch
// in der Datenbank (`chk_alter_jahre` liess ab 10 zu).
//
// Der Text ist ein anderer als bei der Anzeige: Hier liest ihn ein Kind,
// nicht ein Arbeitgeber. Deshalb ohne Paragraphen und ohne Vorwurf.
export function pruefeAlter(alter) {
  const n = alsAlter(alter)

  if (n === null)
    return { ok: false, fehler: 'Bitte wähle dein Alter.' }

  if (n < MIN_ALTER)
    return {
      ok: false,
      fehler: `SchülerMatch ist ab ${MIN_ALTER} Jahren. Jünger darf man in Deutschland leider noch nicht arbeiten.`
    }

  if (n > MAX_ALTER)
    return { ok: false, fehler: 'Bitte wähle ein Alter aus der Liste.' }

  return { ok: true }
}

// Braucht diese Person die Einwilligung der Eltern?
// Art. 8 DSGVO: In Deutschland ab 16 selbst einwilligungsfähig.
export const EINWILLIGUNG_BIS = 16

export function brauchtEinwilligung(alter) {
  const n = alsAlter(alter)
  // Ohne Altersangabe im Zweifel ja — lieber einmal zu viel fragen.
  if (n === null) return true
  return n < EINWILLIGUNG_BIS
}
