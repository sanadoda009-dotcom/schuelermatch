// Generische Sidebar-Steuerung (Hamburger-Menü) für Dashboards.
export function initSidebar(onSelect) {
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebar-overlay')
  const toggle = document.getElementById('sidebar-toggle')

  function oeffnen() {
    sidebar.classList.add('open')
    overlay.classList.add('open')
  }
  function schliessen() {
    sidebar.classList.remove('open')
    overlay.classList.remove('open')
  }

  toggle.addEventListener('click', oeffnen)
  overlay.addEventListener('click', schliessen)

  document.querySelectorAll('.sidebar-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      onSelect(btn.dataset.view)
      schliessen()
    })
  })
}

// Öffnet die Ansicht, die in der Adresse steht: ?ansicht=bewerbungen
// (13.9.2026).
//
// Anlass sind die E-Mails. „Zum Chat" in der Zusage-Mail führte ins
// Schüler-Dashboard – das mit der Jobbörse öffnet, nicht mit dem Chat.
// „Bewerbung ansehen" an die Firma landete auf „Job posten". Dasselbe,
// was die Glocke bis zum 9.9. tat, nur in der Mail.
//
// Nur Ansichten, die es als Menüpunkt gibt; alles andere wird still
// übergangen. Danach verschwindet der Parameter aus der Adresse, damit
// ein Neuladen nicht wieder dorthin springt. Andere Parameter (?job=)
// bleiben stehen.
export function oeffneAnsichtAusAdresse() {
  const adresse = new URL(location.href)
  const ansicht = adresse.searchParams.get('ansicht')
  if (!ansicht) return false
  adresse.searchParams.delete('ansicht')
  history.replaceState(null, '', adresse.pathname + adresse.search + adresse.hash)
  if (!/^[a-z]+$/.test(ansicht)) return false
  const eintrag = document.querySelector(`.sidebar-item[data-view="${ansicht}"]`)
  if (!eintrag) return false
  eintrag.click()
  return true
}
