document.querySelectorAll('.nav-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const links = btn.closest('nav').querySelector('.nav-links')
    const isOpen = links.classList.toggle('open')
    btn.classList.toggle('open', isOpen)
    btn.setAttribute('aria-expanded', isOpen)
  })
})

// Header beim Scrollen solide machen (kein Durchscheinen des Inhalts)
const nav = document.querySelector('nav')
if (nav) {
  const pruefeScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8)
  pruefeScroll()
  window.addEventListener('scroll', pruefeScroll, { passive: true })
}

// Bestätigung nach dem Löschen des Kontos (27.8.).
//
// Der Schüler landet nach `konto-loeschen` hier auf der Startseite. Ohne
// ein Wort dazu wüsste er nicht, ob es geklappt hat — und würde sich
// womöglich wieder anzumelden versuchen, um nachzusehen.
//
// Bewusst nicht als Toast: Toast-Meldungen verschwinden. Diese hier soll
// stehen bleiben, bis man sie wegklickt.
;(function () {
  const params = new URLSearchParams(location.search)
  if (params.get('konto') !== 'geloescht') return

  const box = document.createElement('div')
  box.className = 'konto-weg'
  box.setAttribute('role', 'status')
  box.innerHTML = `
    <div>
      <b>Dein Konto ist gelöscht.</b>
      <p>Profil, Lebenslauf, Bewerbungen und alle Dateien sind entfernt.
         Schade, dass du gehst – du bist jederzeit willkommen zurück.</p>
    </div>
    <button type="button" class="konto-weg-zu" aria-label="Hinweis schließen">✕</button>`
  document.body.insertBefore(box, document.body.firstChild)
  box.querySelector('.konto-weg-zu').addEventListener('click', () => box.remove())

  // Den Parameter aus der Adresse nehmen, damit ein Neuladen die
  // Meldung nicht wiederholt.
  history.replaceState(null, '', location.pathname)
})()
