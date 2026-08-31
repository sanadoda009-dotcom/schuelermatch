// Lesbarkeit der Knöpfe (26.8.).
//
// Anlass: Beim Bauen der Ferienjob-Seite fiel auf dem Bildschirmfoto auf,
// dass "Ferienjobs ansehen" grün auf grünem Verlauf stand. Ursache war
// keine neue Zeile, sondern eine alte:
//
//   .legal-page a { color: var(--match-green-dark); ... }
//
// Diese Regel ist spezifischer als .btn-green (Klasse + Typ schlägt
// Klasse) und färbte damit jeden Knopf ein, der als <a> in einer
// Ratgeberseite steht. Gemessen: 1,77:1 statt der vorgesehenen 5,4:1 -
// auf fairer-lohn.html und jobideen.html seit Monaten unentdeckt.
//
// Warum keiner der bestehenden Tests das fand: Sie prüfen, ob Elemente
// vorhanden, groß genug und bedienbar sind - nicht, ob man ihre Schrift
// lesen kann. Diese Datei schließt die Lücke für Knöpfe.
const { test, expect } = require('./helpers/basis')

// WCAG AA: 4,5:1 für normalen Text. Knopfschrift ist mit 0,95rem/600
// nicht "groß" im Sinne der Richtlinie, also gilt der strenge Wert.
const NOETIG = 4.5

const MESSUNG = `(() => {
  function lum(c) {
    const [r,g,b] = c.match(/[\\d.]+/g).slice(0,3).map(Number).map(v => {
      v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4)
    })
    return 0.2126*r + 0.7152*g + 0.0722*b
  }
  function verh(a, b) {
    const l1 = lum(a), l2 = lum(b)
    return +(((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05))).toFixed(2)
  }

  const schlecht = []
  document.querySelectorAll('.btn').forEach(el => {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return
    const st = getComputedStyle(el)
    if (!el.innerText.trim()) return

    // Bei einem Verlauf zaehlt die schlechteste Endfarbe: der Text laeuft
    // ueber die ganze Flaeche, nicht nur ueber deren helle Haelfte.
    // Bei durchsichtigen Knoepfen (btn-outline) zaehlt das, was
    // DARUNTER liegt - und das ist nicht zwingend die Seitenfarbe: auf
    // der Startseite sitzt ein solcher Knopf auf einer dunklen Karte.
    const durchsichtig = c => !c || c === 'transparent' || /,\\s*0\\)$/.test(c)
    function untergrund(el) {
      let k = el
      while (k && k !== document.documentElement) {
        const s = getComputedStyle(k)
        const stops = s.backgroundImage.match(/rgba?\\([^)]+\\)/g)
        if (stops) return stops
        if (!durchsichtig(s.backgroundColor)) return [s.backgroundColor]
        k = k.parentElement
      }
      return [getComputedStyle(document.body).backgroundColor]
    }

    const eigene = st.backgroundImage.match(/rgba?\\([^)]+\\)/g)
    const gruende = eigene ? eigene
      : (durchsichtig(st.backgroundColor) ? untergrund(el.parentElement) : [st.backgroundColor])
    const wert = Math.min(...gruende.map(g => verh(st.color, g)))
    if (wert < ${NOETIG}) {
      schlecht.push(el.innerText.trim().slice(0, 40) + ': ' + wert + ':1 (' +
        st.color + ' auf ' + gruende.join(' / ') + ')')
    }
  })
  return schlecht
})()`

for (const [name, pfad] of [
  ['Startseite', '/index.html'],
  ['Jobbörse', '/jobs.html'],
  ['Ferienjob', '/ferienjob.html'],
  ['Fairer Lohn', '/fairer-lohn.html'],
  ['Taschengeld', '/taschengeld.html'],
  ['Gesundheitszeugnis', '/gesundheitszeugnis.html'],
  ['Arbeitsvertrag', '/arbeitsvertrag.html'],
  ['Bewerbungsfoto', '/bewerbungsfoto.html'],
  ['Ratgeber', '/ratgeber.html'],
  ['Jobideen', '/jobideen.html'],
  ['Jugendarbeitsschutz', '/jugendarbeitsschutz.html'],
  ['Für Eltern', '/eltern.html'],
  ['Für Arbeitgeber', '/fuer-firmen.html'],
  ['Job-Finder', '/job-finder.html'],
  ['Login', '/login.html'],
  ['Registrierung', '/register.html'],
  ['Job-Alarm abbestellen', '/job-alarm-aus.html'],
]) {
  test(`Knöpfe sind lesbar: ${name}`, async ({ page }) => {
    await page.goto(pfad)
    await page.waitForTimeout(600)
    expect(await page.evaluate(MESSUNG)).toEqual([])
  })
}
