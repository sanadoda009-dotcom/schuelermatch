// Sanftes Einblenden von Abschnitten beim Herunterscrollen.
//
// Die Sichtbarkeit haengt NICHT an dieser Datei: `.reveal` ist per CSS
// sichtbar, erst `html.js-reveal` blendet sie fuer die Animation aus.
// Die Klasse setzt der Kopf von index.html und nimmt sie nach 2,5
// Sekunden wieder weg, falls diese Datei nie ankommt. Das Lebenszeichen
// hier unten ist die andere Haelfte davon.
window.__revealBereit = true

const beobachter = new IntersectionObserver((eintraege) => {
  eintraege.forEach(eintrag => {
    if (eintrag.isIntersecting) {
      eintrag.target.classList.add('in-view')
      beobachter.unobserve(eintrag.target)
    }
  })
}, { threshold: 0.15 })

document.querySelectorAll('.reveal').forEach(el => beobachter.observe(el))
