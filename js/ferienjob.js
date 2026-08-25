// Steuert den Ferienkalender auf ferienjob.html: Bundesland wählen,
// Countdown bis zu den nächsten Ferien, Liste der kommenden Zeiträume.
import { FERIEN, STAND, kommendeFerien, tageBis, dauerInTagen, formatiere, formatiereKurz } from './ferien.js'

const SPEICHER = 'sm-bundesland'
const auswahl = document.getElementById('bundesland')
const countdown = document.getElementById('ferien-countdown')
const liste = document.getElementById('ferien-liste')

// Bundesländer alphabetisch nach Namen, nicht nach Kürzel.
function sortierteLaender() {
  return Object.keys(FERIEN).sort((a, b) => FERIEN[a][0].localeCompare(FERIEN[b][0], 'de'))
}

function fuelleAuswahl() {
  auswahl.innerHTML = sortierteLaender()
    .map(k => `<option value="${k}">${FERIEN[k][0]}</option>`)
    .join('')
}

// Gemerkte Wahl vom letzten Besuch. Fällt auf Nordrhein-Westfalen zurück -
// das bevölkerungsreichste Land, also die wahrscheinlichste Antwort.
function gemerktesLand() {
  try {
    const gespeichert = localStorage.getItem(SPEICHER)
    if (gespeichert && FERIEN[gespeichert]) return gespeichert
  } catch (e) { /* privater Modus: dann eben ohne Gedächtnis */ }
  return 'NW'
}

function merkeLand(kuerzel) {
  try { localStorage.setItem(SPEICHER, kuerzel) } catch (e) { /* egal */ }
}

function tageText(tage) {
  if (tage === 1) return 'Morgen geht es los'
  return `Noch ${tage} Tage`
}

function zeichneCountdown(kuerzel) {
  const kommend = kommendeFerien(kuerzel)
  const naechste = kommend[0]
  const land = FERIEN[kuerzel][0]

  if (!naechste) {
    countdown.className = 'ferien-countdown leer'
    countdown.innerHTML = `
      <p class="ferien-gross">Keine Termine hinterlegt</p>
      <p class="ferien-klein">Für ${land} liegen uns über den ${STAND} hinaus noch keine Ferientermine vor.
      Die Jobsuche funktioniert trotzdem.</p>`
    return
  }

  const tage = tageBis(naechste.start)
  const dauer = dauerInTagen(naechste.start, naechste.ende)

  if (naechste.laeuft) {
    const restTage = tageBis(naechste.ende) + 1
    countdown.className = 'ferien-countdown laeuft'
    countdown.innerHTML = `
      <p class="ferien-label">${naechste.name} in ${land}</p>
      <p class="ferien-gross">Die Ferien laufen gerade</p>
      <p class="ferien-klein">Noch ${restTage} ${restTage === 1 ? 'Tag' : 'Tage'} bis zum ${formatiere(naechste.ende)}.</p>`
    return
  }

  countdown.className = 'ferien-countdown'
  countdown.innerHTML = `
    <p class="ferien-label">${naechste.name} in ${land}</p>
    <p class="ferien-gross">${tageText(tage)}</p>
    <p class="ferien-klein">${formatiere(naechste.start)} bis ${formatiere(naechste.ende)} &middot; ${dauer} Tage frei</p>`
}

function zeichneListe(kuerzel) {
  const kommend = kommendeFerien(kuerzel)
  if (!kommend.length) {
    liste.innerHTML = ''
    return
  }
  liste.innerHTML = `
    <div class="lohn-zeile lohn-kopf"><span>Ferien</span><span>Zeitraum</span><span>Tage</span></div>
    ${kommend.map(f => `
      <div class="lohn-zeile">
        <span>${f.name}${f.laeuft ? ' <b class="ferien-jetzt">jetzt</b>' : ''}</span>
        <span>${formatiereKurz(f.start)}&ndash;${formatiereKurz(f.ende)}</span>
        <span>${dauerInTagen(f.start, f.ende)}</span>
      </div>`).join('')}`
}

function aktualisiere() {
  const kuerzel = auswahl.value
  merkeLand(kuerzel)
  zeichneCountdown(kuerzel)
  zeichneListe(kuerzel)
}

fuelleAuswahl()
auswahl.value = gemerktesLand()
auswahl.addEventListener('change', aktualisiere)
aktualisiere()
