// Sanftes Einblenden von Abschnitten beim Herunterscrollen.
const beobachter = new IntersectionObserver((eintraege) => {
  eintraege.forEach(eintrag => {
    if (eintrag.isIntersecting) {
      eintrag.target.classList.add('in-view')
      beobachter.unobserve(eintrag.target)
    }
  })
}, { threshold: 0.15 })

document.querySelectorAll('.reveal').forEach(el => beobachter.observe(el))
