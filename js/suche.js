// Gemeinsame Job-Suche mit Synonym-Verständnis.
// "kellner" findet Gastronomie-Jobs, "rasenmähen" findet Garten-Jobs usw.
// Genutzt von der öffentlichen Jobbörse (jobs.js) und dem Schüler-Dashboard.

const SYNONYME = {
  kellner: ['gastronomie', 'service', 'restaurant', 'café', 'cafe'],
  kellnern: ['gastronomie', 'service', 'restaurant'],
  servieren: ['gastronomie', 'restaurant'],
  bedienung: ['gastronomie', 'service'],
  verkäufer: ['verkauf', 'laden', 'einzelhandel'],
  verkaufen: ['verkauf', 'laden'],
  kasse: ['verkauf', 'kassieren'],
  kassieren: ['verkauf'],
  regale: ['verkauf', 'einräumen'],
  tutor: ['nachhilfe', 'unterricht'],
  lehrer: ['nachhilfe', 'unterricht'],
  unterricht: ['nachhilfe'],
  lernen: ['nachhilfe'],
  babysitter: ['babysitten', 'kinderbetreuung', 'kinder'],
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
  wochenendjob: ['wochenende']
}

// Prüft, ob ein Job zum Suchtext passt (jedes Wort muss treffen — direkt oder via Synonym).
export function passtZurSuche(job, suche) {
  if (!suche) return true
  const heuhaufen = [job.titel, job.beschreibung, job.kategorie, job.ort, job.arbeitszeit]
    .map(f => (f || '').toLowerCase()).join(' ')

  return suche.toLowerCase().split(/\s+/).filter(Boolean).every(wort => {
    if (heuhaufen.includes(wort)) return true
    const alternativen = SYNONYME[wort] || []
    return alternativen.some(alt => heuhaufen.includes(alt))
  })
}
