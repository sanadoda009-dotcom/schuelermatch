// Gemeinsame Job-Suche mit Synonym-Verständnis.
// "kellner" findet Gastronomie-Jobs, "rasenmähen" findet Garten-Jobs usw.
// Genutzt von der öffentlichen Jobbörse (jobs.js) und dem Schüler-Dashboard.
//
// Am 25.8. mit 23 realistischen Eingaben gemessen – neun davon fanden
// nichts, obwohl es passende Jobs gab. Die Muster waren:
//   "muenchen", "cafe", "einraeumen"   -> Umlaute umschrieben
//   "nachhilfe job", "gassi gehen"     -> ein Füllwort dazwischen
//   "kellnerin"                        -> andere Wortform
//   "nachhife"                         -> Tippfehler
// Dagegen helfen die vier Schritte weiter unten.

const SYNONYME = {
  kellner: ['gastronomie', 'service', 'restaurant', 'café', 'cafe'],
  kellnern: ['gastronomie', 'service', 'restaurant'],
  kellnerin: ['gastronomie', 'service', 'restaurant'],
  servieren: ['gastronomie', 'restaurant'],
  bedienung: ['gastronomie', 'service'],
  verkäufer: ['verkauf', 'laden', 'einzelhandel'],
  verkäuferin: ['verkauf', 'laden', 'einzelhandel'],
  verkaufen: ['verkauf', 'laden'],
  kasse: ['verkauf', 'kassieren'],
  kassieren: ['verkauf'],
  kassierer: ['verkauf', 'kasse'],
  regale: ['verkauf', 'einräumen'],
  supermarkt: ['verkauf', 'einräumen', 'regale', 'markt'],
  laden: ['verkauf', 'einzelhandel'],
  markt: ['verkauf', 'einräumen'],
  tutor: ['nachhilfe', 'unterricht'],
  lehrer: ['nachhilfe', 'unterricht'],
  unterricht: ['nachhilfe'],
  lernen: ['nachhilfe'],
  mathe: ['nachhilfe', 'mathematik'],
  englisch: ['nachhilfe'],
  babysitter: ['babysitten', 'kinderbetreuung', 'kinder'],
  babysitting: ['babysitten', 'kinderbetreuung', 'kinder'],
  kinderbetreuung: ['babysitten', 'kinder'],
  aufpassen: ['babysitten', 'kinder'],
  rasenmähen: ['garten', 'haushalt', 'rasen'],
  rasen: ['garten'],
  gartenarbeit: ['garten', 'haushalt'],
  putzen: ['haushalt', 'reinigung'],
  reinigung: ['haushalt', 'putzen'],
  zeitung: ['lieferung', 'kurier', 'austragen', 'zeitungen'],
  austragen: ['lieferung', 'kurier', 'zeitungen'],
  bote: ['lieferung', 'kurier'],
  liefern: ['lieferung', 'kurier'],
  ausfahren: ['lieferung', 'kurier'],
  büro: ['organisation', 'office'],
  office: ['büro', 'organisation'],
  ferien: ['ferienjob'],
  ferienjob: ['ferien'],
  wochenendjob: ['wochenende'],
  gassi: ['tierbetreuung', 'hund', 'hunde'],
  hund: ['tierbetreuung', 'gassi'],
  hunde: ['tierbetreuung', 'gassi'],
  katze: ['tierbetreuung'],
  tiere: ['tierbetreuung'],
  haustier: ['tierbetreuung'],
  computer: ['technik', 'pc'],
  pc: ['technik', 'computer'],
  handy: ['technik', 'smartphone'],
  internet: ['technik', 'computer'],
  website: ['technik', 'computer'],
  eis: ['eisverkauf', 'eisdiele', 'gastronomie'],
  ernte: ['erntehelfer', 'hof', 'bauernhof'],
  lager: ['logistik', 'lagerhelfer'],
}

// Wörter, die jeder dazwischenschiebt, ohne etwas damit zu meinen.
// Ohne diese Liste scheitert "nachhilfe job" daran, dass "job" nirgends
// im Anzeigentext steht.
const FUELLWOERTER = new Set([
  'job', 'jobs', 'nebenjob', 'minijob', 'arbeit', 'arbeiten', 'stelle',
  'stellen', 'aushilfe', 'suche', 'suchen', 'gesucht', 'machen', 'gehen',
  'als', 'für', 'fuer', 'in', 'im', 'am', 'bei', 'mit', 'und', 'oder',
  'ein', 'eine', 'einen', 'der', 'die', 'das', 'ich', 'mein', 'meine',
])

// Macht aus "München" und "muenchen" dieselbe Zeichenfolge. Wer auf dem
// Handy tippt, lässt Umlaute oft weg – das darf kein leeres Ergebnis geben.
function vereinfache(text) {
  return (text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // é -> e, à -> a
}

// Erlaubt genau einen Tippfehler: ein Zeichen zu viel, zu wenig oder
// falsch. Bewusst erst ab fünf Zeichen – bei kurzen Wörtern würde das
// viel zu viel finden ("hund" träfe sonst auch "rund" und "hand").
function fastGleich(a, b) {
  if (a === b) return true
  if (a.length < 5 || b.length < 5) return false
  if (Math.abs(a.length - b.length) > 1) return false

  // Ein Durchlauf genügt: Beim ersten Unterschied wird die eine erlaubte
  // Abweichung verbraucht, danach muss der Rest genau passen.
  let i = 0, j = 0, abweichungen = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++abweichungen > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return abweichungen + (a.length - i) + (b.length - j) <= 1
}

// Steckt das gesuchte Wort im Text – als Teilwort oder mit einem Tippfehler?
function kommtVor(heuhaufen, wort) {
  if (heuhaufen.includes(wort)) return true
  // Nur bei längeren Wörtern lohnt der teurere Vergleich Wort für Wort.
  if (wort.length < 5) return false
  return heuhaufen.split(/[^a-z0-9]+/).some(w => fastGleich(w, wort))
}

// Prüft, ob ein Job zum Suchtext passt.
// Jedes bedeutungstragende Wort muss treffen – direkt, über ein Synonym
// oder mit einem Tippfehler.
export function passtZurSuche(job, suche) {
  if (!suche || !suche.trim()) return true

  const heuhaufen = vereinfache(
    [job.titel, job.beschreibung, job.kategorie, job.ort, job.arbeitszeit]
      .filter(Boolean).join(' '))

  const woerter = suche.toLowerCase().split(/\s+/).filter(Boolean)

  // Füllwörter raus. Bleibt nichts übrig ("ich suche einen job"), dann
  // hat der Nutzer nichts Konkretes gesagt – also alles zeigen.
  const wichtige = woerter.filter(w => !FUELLWOERTER.has(w))
  if (!wichtige.length) return true

  return wichtige.every(rohesWort => {
    const wort = vereinfache(rohesWort)
    if (kommtVor(heuhaufen, wort)) return true

    // Synonyme werden mit dem ursprünglichen Wort nachgeschlagen (dort
    // stehen die Umlaute noch), die Treffer dann vereinfacht verglichen.
    const alternativen = SYNONYME[rohesWort.toLowerCase()] || SYNONYME[wort] || []
    return alternativen.some(alt => kommtVor(heuhaufen, vereinfache(alt)))
  })
}
