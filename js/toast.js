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

export function toast(text, typ = 'ok') {
  const el = document.createElement('div')
  el.className = `toast toast--${typ}`
  el.innerHTML = `<span class="toast-icon">${typ === 'ok' ? '✓' : typ === 'fehler' ? '✕' : 'ℹ'}</span>${text}`
  holeContainer().appendChild(el)
  requestAnimationFrame(() => el.classList.add('sichtbar'))
  setTimeout(() => {
    el.classList.remove('sichtbar')
    setTimeout(() => el.remove(), 300)
  }, 3000)
}

// Auch für Nicht-Module verfügbar machen
window.toast = toast
