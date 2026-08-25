// Ferienkalender für die Ferienjob-Seite.
//
// Die Termine stehen fest im Code statt aus einer Fremd-API zu kommen: die
// Seite soll auch dann etwas anzeigen, wenn ein fremder Dienst gerade nicht
// erreichbar ist, und ein einmal festgelegter Ferientermin ändert sich nicht
// mehr. Quelle sind die von der Kultusministerkonferenz veröffentlichten
// Ferienkalender.
//
// WARTUNG: Der Bestand reicht bis zu den Sommerferien 2027. Danach müssen
// neue Zeiträume ergänzt werden. Läuft der Bestand aus, zeigt die Seite
// ehrlich an, dass keine Termine hinterlegt sind, statt veralteter Angaben.
export const STAND = 'August 2026'
export const QUELLE = 'https://www.kmk.org/service/ferien.html'

// [Name, Beginn, Ende] - jeweils der erste und der letzte freie Tag.
// Einzelne bewegliche Ferientage (etwa Buß- und Bettag in Bayern) fehlen
// bewusst; für einen Ferienjob sind sie zu kurz.
export const FERIEN = {
  BW: ['Baden-Württemberg', [
    ['Herbstferien', '2026-10-26', '2026-10-31'],
    ['Weihnachtsferien', '2026-12-23', '2027-01-08'],
    ['Osterferien', '2027-03-30', '2027-04-03'],
    ['Sommerferien', '2027-07-29', '2027-09-11'],
  ]],
  BY: ['Bayern', [
    ['Herbstferien', '2026-11-02', '2026-11-06'],
    ['Weihnachtsferien', '2026-12-24', '2027-01-07'],
    ['Osterferien', '2027-03-22', '2027-04-02'],
    ['Sommerferien', '2027-08-02', '2027-09-13'],
  ]],
  BE: ['Berlin', [
    ['Herbstferien', '2026-10-19', '2026-10-31'],
    ['Weihnachtsferien', '2026-12-22', '2026-12-31'],
    ['Osterferien', '2027-03-22', '2027-04-02'],
    ['Sommerferien', '2027-07-01', '2027-08-14'],
  ]],
  BB: ['Brandenburg', [
    ['Herbstferien', '2026-10-19', '2026-10-30'],
    ['Weihnachtsferien', '2026-12-23', '2026-12-31'],
    ['Osterferien', '2027-03-22', '2027-04-03'],
    ['Sommerferien', '2027-07-01', '2027-08-14'],
  ]],
  HB: ['Bremen', [
    ['Herbstferien', '2026-10-12', '2026-10-24'],
    ['Weihnachtsferien', '2026-12-23', '2027-01-08'],
    ['Osterferien', '2027-03-22', '2027-04-03'],
    ['Sommerferien', '2027-07-08', '2027-08-18'],
  ]],
  HH: ['Hamburg', [
    ['Herbstferien', '2026-10-19', '2026-10-30'],
    ['Weihnachtsferien', '2026-12-20', '2026-12-31'],
    ['Frühjahrsferien', '2027-03-01', '2027-03-12'],
    ['Sommerferien', '2027-07-01', '2027-08-11'],
  ]],
  HE: ['Hessen', [
    ['Herbstferien', '2026-10-05', '2026-10-17'],
    ['Weihnachtsferien', '2026-12-23', '2027-01-11'],
    ['Osterferien', '2027-03-22', '2027-04-02'],
    ['Sommerferien', '2027-06-28', '2027-08-06'],
  ]],
  MV: ['Mecklenburg-Vorpommern', [
    ['Herbstferien', '2026-10-19', '2026-10-24'],
    ['Weihnachtsferien', '2026-12-23', '2027-01-04'],
    ['Osterferien', '2027-03-22', '2027-03-31'],
    ['Sommerferien', '2027-07-05', '2027-08-14'],
  ]],
  NI: ['Niedersachsen', [
    ['Herbstferien', '2026-10-12', '2026-10-24'],
    ['Weihnachtsferien', '2026-12-23', '2027-01-08'],
    ['Osterferien', '2027-03-22', '2027-04-03'],
    ['Sommerferien', '2027-07-08', '2027-08-18'],
  ]],
  NW: ['Nordrhein-Westfalen', [
    ['Herbstferien', '2026-10-17', '2026-10-31'],
    ['Weihnachtsferien', '2026-12-24', '2027-01-08'],
    ['Osterferien', '2027-03-22', '2027-04-03'],
    ['Sommerferien', '2027-07-19', '2027-08-31'],
  ]],
  RP: ['Rheinland-Pfalz', [
    ['Herbstferien', '2026-10-05', '2026-10-16'],
    ['Weihnachtsferien', '2026-12-23', '2027-01-07'],
    ['Osterferien', '2027-03-22', '2027-04-02'],
    ['Sommerferien', '2027-06-28', '2027-08-06'],
  ]],
  SL: ['Saarland', [
    ['Herbstferien', '2026-10-05', '2026-10-16'],
    ['Weihnachtsferien', '2026-12-20', '2026-12-31'],
    ['Osterferien', '2027-03-30', '2027-04-09'],
    ['Sommerferien', '2027-06-28', '2027-08-06'],
  ]],
  SN: ['Sachsen', [
    ['Herbstferien', '2026-10-12', '2026-10-24'],
    ['Weihnachtsferien', '2026-12-23', '2027-01-01'],
    ['Osterferien', '2027-03-26', '2027-04-02'],
    ['Sommerferien', '2027-07-10', '2027-08-20'],
  ]],
  ST: ['Sachsen-Anhalt', [
    ['Herbstferien', '2026-10-19', '2026-10-30'],
    ['Weihnachtsferien', '2026-12-20', '2026-12-31'],
    ['Osterferien', '2027-03-22', '2027-03-27'],
    ['Sommerferien', '2027-07-10', '2027-08-20'],
  ]],
  SH: ['Schleswig-Holstein', [
    ['Herbstferien', '2026-10-12', '2026-10-24'],
    ['Weihnachtsferien', '2026-12-23', '2027-01-08'],
    ['Osterferien', '2027-03-30', '2027-04-10'],
    ['Sommerferien', '2027-07-03', '2027-08-14'],
  ]],
  TH: ['Thüringen', [
    ['Herbstferien', '2026-10-12', '2026-10-24'],
    ['Weihnachtsferien', '2026-12-23', '2026-12-31'],
    ['Osterferien', '2027-03-22', '2027-04-03'],
    ['Sommerferien', '2027-07-10', '2027-08-20'],
  ]],
}

// '2026-10-17' -> lokales Date um Mitternacht. Bewusst nicht new Date(iso):
// das liest die ISO-Form als UTC und verschiebt den Tag je nach Zeitzone.
export function alsDatum(iso) {
  const [j, m, t] = iso.split('-').map(Number)
  return new Date(j, m - 1, t)
}

export function formatiere(iso) {
  return alsDatum(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatiereKurz(iso) {
  return alsDatum(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

// Ganze Tage von heute bis zum Stichtag. Beide Seiten auf Mitternacht
// normiert, damit die Uhrzeit des Aufrufs das Ergebnis nicht verschiebt.
export function tageBis(iso, heute = new Date()) {
  const jetzt = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate())
  return Math.round((alsDatum(iso) - jetzt) / 86400000)
}

// Dauer in Tagen, beide Randtage eingeschlossen.
export function dauerInTagen(start, ende) {
  return Math.round((alsDatum(ende) - alsDatum(start)) / 86400000) + 1
}

// Alle noch nicht vergangenen Zeiträume eines Landes. Laufende Ferien
// zählen mit - wer mittendrin sucht, will nicht auf die übernächsten
// verwiesen werden.
export function kommendeFerien(kuerzel, heute = new Date()) {
  const land = FERIEN[kuerzel]
  if (!land) return []
  const jetzt = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate())
  return land[1]
    .filter(eintrag => alsDatum(eintrag[2]) >= jetzt)
    .map(([name, start, ende]) => ({ name, start, ende, laeuft: alsDatum(start) <= jetzt }))
}

// Die nächsten Ferien, die noch nicht vorbei sind, oder null wenn der
// hinterlegte Bestand ausgelaufen ist.
export function naechsteFerien(kuerzel, heute = new Date()) {
  return kommendeFerien(kuerzel, heute)[0] || null
}
