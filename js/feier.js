// Der "Match-Moment" nach dem Veroeffentlichen einer Anzeige (24.11.2026).
//
// ANLASS: Sanad - "da kommt oben so eine schwarze Anzeige, das sieht sehr
// langweilig aus und man kann es uebersehen". Das Veroeffentlichen ist der
// wichtigste Moment fuer eine Firma; ein Hinweis in der Ecke, der nach
// drei Sekunden verschwindet, wird ihm nicht gerecht.
//
// Die Animation erzaehlt den Namen: Ein Punkt in Schueler-Gruen und einer
// in Firmen-Blau fliegen aufeinander zu, treffen sich - und heraus springt
// das Logo. Dazu Konfetti in den Markenfarben.
//
// Barrierearm: ein echter Dialog (.modal-overlay -> js/tastatur.js setzt
// Rolle, Fokus-Falle und Escape), der Fokus landet auf dem Hauptknopf, und
// wer "weniger Bewegung" eingestellt hat, sieht sofort das fertige Bild.

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s ?? ''
  return d.innerHTML
}

const HAKEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>'
const FARBEN = ['#19f0b8', '#00c896', '#7c83ff', '#2b2f8f', '#f0b429', '#ffffff']

/**
 * Zeigt den Match-Moment.
 * @param {object} o
 *   titel        Titel der Anzeige
 *   inPruefung   Firma noch nicht freigegeben: ehrlicher Text statt "online"
 *   zuAnzeigen   Klick auf den Hauptknopf
 *   nochEiner    Klick auf "Noch einen Job posten"
 */
export function zeigeVeroeffentlicht({ titel, inPruefung = false, zuAnzeigen, nochEiner } = {}) {
  document.getElementById('feier')?.remove()

  const konfetti = Array.from({ length: 28 }, (_, i) => {
    const w = (i / 28) * Math.PI * 2 + (i % 3) * 0.35
    const weite = 90 + (i * 37) % 80
    const x = Math.round(Math.cos(w) * weite * 1.5)
    const y = Math.round(Math.sin(w) * weite - 40)
    const r = (i * 67) % 360
    const v = (i % 5) * 40
    return `<i style="--x:${x}px;--y:${y}px;--r:${r}deg;--v:${v}ms;background:${FARBEN[i % FARBEN.length]}"></i>`
  }).join('')

  const ueberschrift = inPruefung ? 'Anzeige gespeichert' : 'Deine Anzeige ist online!'
  const text = inPruefung
    ? `„${esc(titel)}“ ist gespeichert. Sichtbar wird sie, sobald wir dein Konto geprüft und freigeschaltet haben.`
    : `„${esc(titel)}“ ist ab jetzt für Schüler in deiner Nähe sichtbar. Neue Bewerbungen findest du unter „Bewerbungen“.`

  const huelle = document.createElement('div')
  huelle.id = 'feier'
  huelle.className = 'modal-overlay feier-overlay'
  huelle.setAttribute('role', 'dialog')
  huelle.setAttribute('aria-modal', 'true')
  huelle.setAttribute('aria-labelledby', 'feier-titel')
  huelle.innerHTML = `
    <div class="feier-karte">
      <div class="feier-buehne" aria-hidden="true">
        <span class="feier-punkt feier-punkt--schueler"></span>
        <span class="feier-punkt feier-punkt--firma"></span>
        <span class="feier-ring"></span><span class="feier-ring feier-ring--2"></span>
        <div class="feier-konfetti">${konfetti}</div>
        <div class="feier-logo">
          <img src="assets/favicon.png" alt="" width="96" height="96">
          <span class="feier-haken">${HAKEN}</span>
        </div>
      </div>
      <div class="feier-text">
        <h2 id="feier-titel">${ueberschrift}</h2>
        <p>${text}</p>
        <div class="feier-knoepfe">
          <button type="button" class="btn btn-green feier-haupt">Zu meinen Anzeigen</button>
          <button type="button" class="btn btn-outline feier-noch">Noch einen Job posten</button>
        </div>
      </div>
      <!-- Absichtlich zuletzt: js/tastatur.js setzt den Fokus auf das erste
           Bedienelement, und das soll der Hauptknopf sein. -->
      <button type="button" class="feier-zu" aria-label="Schließen">×</button>
    </div>`
  document.body.appendChild(huelle)

  const schliessen = () => {
    huelle.classList.remove('open')
    huelle.remove()
  }
  huelle.querySelector('.feier-zu').addEventListener('click', () => { schliessen(); zuAnzeigen?.() })
  huelle.querySelector('.feier-haupt').addEventListener('click', () => { schliessen(); zuAnzeigen?.() })
  huelle.querySelector('.feier-noch').addEventListener('click', () => { schliessen(); nochEiner?.() })
  huelle.addEventListener('click', e => { if (e.target === huelle) { schliessen(); zuAnzeigen?.() } })
  // js/tastatur.js schliesst Dialoge mit Escape, indem es `.open` entfernt.
  // Dann soll er auch wirklich weg sein.
  new MutationObserver(() => { if (!huelle.classList.contains('open')) huelle.remove() })
    .observe(huelle, { attributes: true, attributeFilter: ['class'] })

  // Ein Bild weiter, damit die Animation sauber von vorn startet.
  requestAnimationFrame(() => {
    huelle.classList.add('open', 'feier-los')
    huelle.querySelector('.feier-haupt').focus()
  })
  return huelle
}
