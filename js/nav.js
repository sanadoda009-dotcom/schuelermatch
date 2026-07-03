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
