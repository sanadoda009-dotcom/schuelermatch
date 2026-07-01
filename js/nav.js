document.querySelectorAll('.nav-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const links = btn.closest('nav').querySelector('.nav-links')
    const isOpen = links.classList.toggle('open')
    btn.classList.toggle('open', isOpen)
    btn.setAttribute('aria-expanded', isOpen)
  })
})
