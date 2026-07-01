document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item')
    const answer = item.querySelector('.faq-answer')
    const istOffen = item.classList.contains('open')

    document.querySelectorAll('.faq-item.open').forEach(offen => {
      offen.classList.remove('open')
      offen.querySelector('.faq-answer').style.maxHeight = null
    })

    if (!istOffen) {
      item.classList.add('open')
      answer.style.maxHeight = answer.scrollHeight + 'px'
    }
  })
})
