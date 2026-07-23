document.querySelectorAll('.faq-question').forEach(btn => {
  btn.setAttribute('aria-expanded', 'false')

  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item')
    const answer = item.querySelector('.faq-answer')
    const istOffen = item.classList.contains('open')

    document.querySelectorAll('.faq-item.open').forEach(offen => {
      offen.classList.remove('open')
      offen.querySelector('.faq-answer').style.maxHeight = null
      offen.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false')
    })

    if (!istOffen) {
      item.classList.add('open')
      answer.style.maxHeight = answer.scrollHeight + 'px'
      btn.setAttribute('aria-expanded', 'true')
    }
  })
})
