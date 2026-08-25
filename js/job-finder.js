// Job-Finder: fünf Fragen, dann passende Jobideen.
//
// Warum es das gibt (25.8.2026): Beim Vergleich mit ausbildung.de fiel
// deren "Berufscheck" auf – ein kurzer Test für alle, die noch nicht
// wissen, was sie wollen. Genau das fehlte hier: Die Plattform heißt
// SchülerMatch, gematcht wurde aber nur nach Alter und Ort.
//
// Der Test läuft komplett im Browser. Keine Anmeldung, keine Daten an
// den Server – das senkt die Hemmschwelle, und bei Minderjährigen ist
// es auch datenschutzrechtlich der einfachere Weg.

const FRAGEN = [
  {
    frage: 'Wie alt bist du?',
    hinweis: 'Davon hängt ab, was erlaubt ist – nicht davon, wie fit du bist.',
    antworten: [
      { text: '13 oder 14', wert: 13 },
      { text: '15', wert: 15 },
      { text: '16 oder älter', wert: 16 },
    ],
    schluessel: 'alter',
  },
  {
    frage: 'Drinnen oder draußen?',
    antworten: [
      { text: 'Lieber draußen', wert: 'draussen' },
      { text: 'Lieber drinnen', wert: 'drinnen' },
      { text: 'Ist mir egal', wert: 'egal' },
    ],
    schluessel: 'ort',
  },
  {
    frage: 'Wie gern hast du mit Menschen zu tun?',
    antworten: [
      { text: 'Sehr gern – ich rede gern mit Leuten', wert: 'viel' },
      { text: 'Geht so – lieber für mich', wert: 'wenig' },
      { text: 'Kommt drauf an', wert: 'egal' },
    ],
    schluessel: 'kontakt',
  },
  {
    frage: 'Wann hättest du Zeit?',
    antworten: [
      { text: 'Ein paar Stunden nach der Schule', wert: 'nachmittags' },
      { text: 'Am Wochenende', wert: 'wochenende' },
      { text: 'Vor allem in den Ferien', wert: 'ferien' },
    ],
    schluessel: 'zeit',
  },
  {
    frage: 'Was ist dir am wichtigsten?',
    antworten: [
      { text: 'Möglichst viel verdienen', wert: 'geld' },
      { text: 'Flexibel bleiben', wert: 'flexibel' },
      { text: 'Etwas lernen für später', wert: 'lernen' },
    ],
    schluessel: 'ziel',
  },
]

// Dieselben Ideen wie auf jobideen.html, hier mit Eigenschaften versehen.
// `ab` = Mindestalter, der Rest sind die Merkmale, nach denen der Test
// vergleicht. `warum` erklärt dem Nutzer, warum gerade das vorgeschlagen
// wird – ein Ergebnis ohne Begründung wirkt beliebig.
const JOBS = [
  { name: 'Nachhilfe geben', ab: 13, ort: 'drinnen', kontakt: 'viel', zeit: ['nachmittags', 'wochenende'],
    ziel: ['geld', 'lernen', 'flexibel'], lohn: '10–15 € pro Stunde',
    warum: 'Gut bezahlt, du bestimmst die Zeiten selbst – und du lernst den Stoff dabei nochmal richtig.' },
  { name: 'Zeitungen austragen', ab: 13, ort: 'draussen', kontakt: 'wenig', zeit: ['nachmittags', 'wochenende'],
    ziel: ['flexibel'], lohn: '8–12 € pro Stunde',
    warum: 'Du bist allein unterwegs, feste Route, danach hast du den Tag frei.' },
  { name: 'Hunde ausführen', ab: 13, ort: 'draussen', kontakt: 'wenig', zeit: ['nachmittags', 'wochenende'],
    ziel: ['flexibel'], lohn: '8–12 € pro Runde',
    warum: 'Draußen, ohne viel Reden, und du kannst es gut neben der Schule machen.' },
  { name: 'Im Garten helfen', ab: 13, ort: 'draussen', kontakt: 'wenig', zeit: ['wochenende', 'ferien'],
    ziel: ['geld', 'flexibel'], lohn: '8–12 € pro Stunde',
    warum: 'Körperliche Arbeit an der frischen Luft, meist am Wochenende.' },
  { name: 'Babysitten', ab: 13, ort: 'drinnen', kontakt: 'viel', zeit: ['nachmittags', 'wochenende'],
    ziel: ['geld', 'lernen'], lohn: '8–15 € pro Stunde',
    warum: 'Viel Kontakt, gute Bezahlung – und Verantwortung, die sich später im Lebenslauf gut macht.' },
  { name: 'Nachbarschafts-Einkäufe', ab: 13, ort: 'draussen', kontakt: 'viel', zeit: ['nachmittags', 'wochenende'],
    ziel: ['flexibel'], lohn: '5–10 € pro Einkauf',
    warum: 'Kleiner Einstieg mit Kontakt zu Menschen, oft direkt in der Nachbarschaft.' },
  { name: 'Regale einräumen', ab: 15, ort: 'drinnen', kontakt: 'wenig', zeit: ['wochenende', 'ferien'],
    ziel: ['geld'], lohn: '12–14 € pro Stunde',
    warum: 'Feste Zeiten, feste Bezahlung, wenig Überraschungen – und du arbeitest weitgehend für dich.' },
  { name: 'Service im Café', ab: 15, ort: 'drinnen', kontakt: 'viel', zeit: ['wochenende', 'ferien'],
    ziel: ['geld', 'lernen'], lohn: '12–14 € plus Trinkgeld',
    warum: 'Trinkgeld macht den Unterschied, und du lernst den Umgang mit Kunden.' },
  { name: 'Eisverkauf', ab: 15, ort: 'drinnen', kontakt: 'viel', zeit: ['wochenende', 'ferien'],
    ziel: ['geld'], lohn: '12–14 € pro Stunde',
    warum: 'Saisonjob mit viel Kundenkontakt. Bewirb dich im Frühjahr – im Sommer ist alles weg.' },
  { name: 'Ferienjob im Lager', ab: 15, ort: 'drinnen', kontakt: 'wenig', zeit: ['ferien'],
    ziel: ['geld'], lohn: '13–15 € pro Stunde',
    warum: 'In vier Ferienwochen kommt hier am meisten zusammen – und du arbeitest für dich.' },
  { name: 'Erntehelfer', ab: 15, ort: 'draussen', kontakt: 'wenig', zeit: ['ferien'],
    ziel: ['geld'], lohn: '12–14 € pro Stunde',
    warum: 'Draußen, gut bezahlt, meist am Stück in den Ferien.' },
  { name: 'Küchenhilfe', ab: 15, ort: 'drinnen', kontakt: 'wenig', zeit: ['wochenende', 'ferien'],
    ziel: ['geld', 'lernen'], lohn: '12–14 € pro Stunde',
    warum: 'Weniger Kundenkontakt als im Service – gut, wenn dir das lieber ist.' },
  { name: 'Prospekte verteilen', ab: 15, ort: 'draussen', kontakt: 'wenig', zeit: ['nachmittags', 'wochenende'],
    ziel: ['flexibel'], lohn: '8–12 € pro Stunde',
    warum: 'Du teilst dir die Zeit selbst ein. Rechne aber vorher aus, was pro Stunde übrig bleibt.' },
  { name: 'Training im Verein', ab: 15, ort: 'drinnen', kontakt: 'viel', zeit: ['nachmittags', 'wochenende'],
    ziel: ['lernen', 'flexibel'], lohn: 'Übungsleiterpauschale, oft steuerfrei',
    warum: 'Wenn du selbst im Verein bist: Bis 3.000 € im Jahr sind steuerfrei – ein echter Vorteil.' },
  { name: 'Kassieren im Einzelhandel', ab: 16, ort: 'drinnen', kontakt: 'viel', zeit: ['wochenende', 'ferien'],
    ziel: ['geld', 'lernen'], lohn: '13–15 € pro Stunde',
    warum: 'Verantwortung für Geld und Kundenkontakt – macht sich später im Lebenslauf gut.' },
  { name: 'Lieferdienst mit dem Rad', ab: 16, ort: 'draussen', kontakt: 'wenig', zeit: ['nachmittags', 'wochenende'],
    ziel: ['geld', 'flexibel'], lohn: '12–15 € plus Trinkgeld',
    warum: 'Flexible Zeiten, du bist an der Luft und weitgehend für dich.' },
  { name: 'Kino oder Freizeitpark', ab: 16, ort: 'drinnen', kontakt: 'viel', zeit: ['wochenende', 'ferien'],
    ziel: ['geld', 'lernen'], lohn: '12–14 € pro Stunde',
    warum: 'Abends und am Wochenende – passt gut zur Schule, und oft gibt es Vergünstigungen dazu.' },
  { name: 'Messe- und Eventhilfe', ab: 16, ort: 'drinnen', kontakt: 'viel', zeit: ['ferien', 'wochenende'],
    ziel: ['geld'], lohn: '13–16 € pro Stunde',
    warum: 'Wenige Tage am Stück, überdurchschnittlich bezahlt.' },
]

const antworten = {}
let schritt = 0

function el(id) { return document.getElementById(id) }

function zeigeFrage() {
  const f = FRAGEN[schritt]
  el('finder-fortschritt').style.width = ((schritt / FRAGEN.length) * 100) + '%'
  el('finder-schritt').textContent = `Frage ${schritt + 1} von ${FRAGEN.length}`

  el('finder-inhalt').innerHTML = `
    <h2 class="finder-frage">${f.frage}</h2>
    ${f.hinweis ? `<p class="finder-hinweis">${f.hinweis}</p>` : ''}
    <div class="finder-antworten">
      ${f.antworten.map((a, i) =>
        `<button type="button" class="finder-antwort" data-i="${i}">${a.text}</button>`).join('')}
    </div>
    ${schritt > 0 ? '<button type="button" class="finder-zurueck" id="finder-zurueck">← Eine Frage zurück</button>' : ''}
  `

  el('finder-inhalt').querySelectorAll('.finder-antwort').forEach(b => {
    b.addEventListener('click', () => {
      antworten[f.schluessel] = f.antworten[+b.dataset.i].wert
      schritt++
      if (schritt < FRAGEN.length) zeigeFrage()
      else zeigeErgebnis()
    })
  })
  el('finder-zurueck')?.addEventListener('click', () => { schritt--; zeigeFrage() })

  // Für Tastaturnutzer: direkt auf die erste Antwort springen.
  el('finder-inhalt').querySelector('.finder-antwort')?.focus()
}

// Punkte statt harter Filter: Sonst bleibt bei ungewöhnlichen Kombinationen
// nichts übrig, und ein leeres Ergebnis hilft niemandem.
function bewerte(job) {
  if (job.ab > antworten.alter) return -1        // Alter ist Pflicht, kein Wunsch
  let punkte = 0
  if (antworten.ort === 'egal' || job.ort === antworten.ort) punkte += 2
  if (antworten.kontakt === 'egal' || job.kontakt === antworten.kontakt) punkte += 2
  if (job.zeit.includes(antworten.zeit)) punkte += 2
  if (job.ziel.includes(antworten.ziel)) punkte += 3
  return punkte
}

function zeigeErgebnis() {
  el('finder-fortschritt').style.width = '100%'
  el('finder-schritt').textContent = 'Dein Ergebnis'

  const treffer = JOBS
    .map(j => ({ ...j, punkte: bewerte(j) }))
    .filter(j => j.punkte >= 0)
    .sort((a, b) => b.punkte - a.punkte)
    .slice(0, 4)

  const altersText = antworten.alter === 13
    ? 'Mit 13 oder 14 darfst du leichte Tätigkeiten ausüben, höchstens 2 Stunden am Tag und nur mit Erlaubnis deiner Eltern.'
    : antworten.alter === 15
      ? 'Ab 15 darfst du in den Ferien bis zu 4 Wochen im Jahr in Vollzeit arbeiten – während der Schulzeit bleibt es bei 2 Stunden täglich.'
      : 'Ab 16 darfst du bis 22 Uhr arbeiten, in Gaststätten sogar bis 23 Uhr.'

  el('finder-inhalt').innerHTML = `
    <h2 class="finder-frage">Das könnte zu dir passen</h2>
    <p class="finder-hinweis">${altersText}</p>

    <div class="ideen-liste finder-ergebnis">
      ${treffer.map((j, i) => `
        <article class="idee${i === 0 ? ' idee--top' : ''}">
          ${i === 0 ? '<span class="idee-top-marke">Passt am besten</span>' : ''}
          <h3>${j.name}</h3>
          <p class="idee-meta">
            <span class="idee-alter">ab ${j.ab}</span>
            <span class="idee-lohn">${j.lohn}</span>
          </p>
          <p>${j.warum}</p>
        </article>`).join('')}
    </div>

    <div class="finder-weiter">
      <p>Schau nach, ob gerade so ein Job in deiner Nähe frei ist – oder leg dir ein Profil an, damit du dich sofort bewerben kannst.</p>
      <div class="fehler-knoepfe" style="justify-content:flex-start;">
        <a class="btn btn-green" href="jobs.html">Jobs in meiner Nähe</a>
        <a class="btn btn-outline" href="register.html">Profil anlegen</a>
      </div>
      <button type="button" class="finder-zurueck" id="finder-neu">Nochmal von vorn</button>
    </div>
  `

  el('finder-neu').addEventListener('click', () => {
    schritt = 0
    for (const k of Object.keys(antworten)) delete antworten[k]
    zeigeFrage()
  })
  el('finder-inhalt').querySelector('h2')?.focus()
}

zeigeFrage()
