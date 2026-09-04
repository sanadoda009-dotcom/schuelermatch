// Die Filterlogik der Jobbörse — und die Antwort auf „woran liegt es?" (4.9.2026)
//
// ANLASS: Wer alle Filter setzte und nichts fand, bekam einen Satz:
// „Keine Jobs passen zu diesem Filter." Darunter ein Knopf, der ALLE
// Filter wegwirft. Das ist eine Sackgasse mit Notausgang — die Arbeit
// war umsonst, obwohl meistens genau EIN Filter zu eng steht.
//
// Ein Schüler, der Ort, Alter, Lohn und Arbeitszeit eingestellt hat,
// weiß nicht, welcher davon die Liste leer macht. Er probiert es aus,
// oder er geht.
//
// Deshalb hier: Nimm jeden gesetzten Filter einmal weg und zähl nach.
// Was dabei herauskommt, ist eine ehrliche Auskunft — „ohne den Ort
// wären es 12" — und keine Vermutung.
//
// EIGENES MODUL, damit die Rechnung ohne Browser prüfbar ist. Bisher
// steckte die Filterbedingung mitten in `wendeFilterAn()` in jobs.js,
// eingeschachtelt zwischen DOM-Zugriffen, und war nur über die Oberfläche
// zu testen. `js/suche.js` ist die einzige Abhängigkeit — sie kennt
// ebenfalls kein DOM.

import { passtZurSuche } from './suche.js'

// Die Reihenfolge bestimmt, welcher Vorschlag bei Gleichstand oben steht.
// Der Ort zuerst: Ihn zu weiten kostet am wenigsten, weil ein Job in der
// Nachbarstadt oft trotzdem erreichbar ist.
export const FILTER_SCHLUESSEL = ['ort', 'gehalt', 'arbeitszeit', 'kategorie', 'suche', 'alter']

// Ein leerer Filter ist kein Filter. '' und null und undefined heißen
// alle „egal"; 0 kommt bei keinem der Felder als echter Wert vor.
export function istGesetzt(wert) {
  return !(wert === null || wert === undefined || wert === '' || wert === 0)
}

// Ein einzelner Job gegen einen Filterzustand.
export function passtZumFilter(job, f) {
  if (!f) return true
  if (!passtZurSuche(job, f.suche)) return false
  if (istGesetzt(f.ort) && !(job.ort || '').toLowerCase().includes(String(f.ort).toLowerCase())) return false

  // Ohne Altersangabe lässt sich nicht sagen, ob die Anzeige für dieses
  // Alter erlaubt ist — also nicht zeigen, solange nach Alter gefiltert
  // wird. `null > alter` ist falsch; so eine Anzeige rutschte früher
  // durch jeden Altersfilter.
  if (istGesetzt(f.alter) && (job.mindestalter == null || job.mindestalter > f.alter)) return false

  if (istGesetzt(f.gehalt) && !(job.stundenlohn >= f.gehalt)) return false
  if (istGesetzt(f.kategorie) && job.kategorie !== f.kategorie) return false
  if (istGesetzt(f.arbeitszeit) && job.arbeitszeit !== f.arbeitszeit) return false
  return true
}

export function filtere(jobs, f) {
  return (jobs || []).filter(job => passtZumFilter(job, f))
}

// Welche EINZELNE Rücknahme bringt wieder Treffer?
//
// Bewusst nur ein Filter auf einmal: „Nimm den Ort UND den Lohn weg"
// wäre kein Vorschlag mehr, sondern das Zurücksetzen mit Umweg. Und
// bewusst nur Vorschläge mit mindestens einem Treffer — alles andere
// wäre eine Empfehlung ins Leere.
//
// Rückgabe: [{ schluessel, anzahl }], die größte Entlastung zuerst.
export function entlastungen(jobs, f) {
  const gesetzt = FILTER_SCHLUESSEL.filter(k => istGesetzt(f?.[k]))
  if (!gesetzt.length) return []

  const treffer = []
  gesetzt.forEach((k, rang) => {
    const ohne = { ...f, [k]: null }
    const anzahl = filtere(jobs, ohne).length
    if (anzahl > 0) treffer.push({ schluessel: k, anzahl, rang })
  })

  // Erst nach Ausbeute, bei Gleichstand nach der Reihenfolge oben.
  treffer.sort((a, b) => b.anzahl - a.anzahl || a.rang - b.rang)
  return treffer.map(({ schluessel, anzahl }) => ({ schluessel, anzahl }))
}
