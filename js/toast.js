// Dezente Bestätigungs-Nachrichten oben rechts (verschwinden nach 3 Sek.)
let container

function holeContainer() {
  if (!container) {
    container = document.createElement('div')
    container.className = 'toast-container'
    container.setAttribute('aria-live', 'polite')
    document.body.appendChild(container)
  }
  return container
}

// Der Text ist TEXT, kein HTML.
//
// Bis zum 11.9.2026 stand hier ein `innerHTML` mit dem Text mittendrin.
// Das war eine Luecke, und zwar eine ausnutzbare: In
// js/dashboard-schueler.js geht der Titel einer Anzeige in zwei
// Meldungen ein ("... ist ab 18 Jahren ausgeschrieben"), und den Titel
// schreibt die FIRMA. Gemessen mit dem Titel
// `Aushilfe <img src=x onerror="window.__xss=1">`: Der Code lief im
// angemeldeten Schuelerkonto. Ueber den geteilten Link
// (dashboard-schueler.html?job=...) reicht ein Klick.
//
// Keine der 93 Aufrufstellen uebergibt HTML - nachgesehen, bevor das
// hier umgestellt wurde. Wer hier je Auszeichnung braucht, baut sie als
// Element und haengt sie an, statt eine Zeichenkette zu setzen.
export function toast(text, typ = 'ok') {
  const el = document.createElement('div')
  el.className = `toast toast--${typ}`
  const icon = document.createElement('span')
  icon.className = 'toast-icon'
  icon.textContent = typ === 'ok' ? '✓' : typ === 'fehler' ? '✕' : 'ℹ'
  el.append(icon, document.createTextNode(text ?? ''))
  holeContainer().appendChild(el)
  requestAnimationFrame(() => el.classList.add('sichtbar'))
  setTimeout(() => {
    el.classList.remove('sichtbar')
    setTimeout(() => el.remove(), 300)
  }, 3000)
}

// Auch für Nicht-Module verfügbar machen
window.toast = toast
