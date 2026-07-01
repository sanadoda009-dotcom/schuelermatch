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
