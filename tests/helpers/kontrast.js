// Gemeinsame Kontrast-Messung für die Tests.
//
// Läuft als Zeichenkette im Browser (page.evaluate), damit sie sowohl von
// den öffentlichen Seiten (helpers/basis) als auch von den eingeloggten
// Bereichen (helpers/supabase-fake) benutzt werden kann.
//
// Sie beantwortet eine Frage, die keine andere Prüfung stellte: Kann man
// den Text eigentlich LESEN? Die übrigen Tests fragen, ob Elemente da,
// groß genug und bedienbar sind - Farbe fiel bis zum 26.8. durch das
// Raster. Gefunden wurden damit unter anderem: grüne Schrift auf grünem
// Knopf (1,77:1), die Passwort-Anzeige bei der Registrierung (1,86:1) und
// rund 48 Stellen, an denen das Marken-Grün als Fließtextfarbe stand.
//
// Der aufwendigste Teil ist nicht die Kontrastformel, sondern die Frage,
// welche Farbe eigentlich HINTER dem Text liegt. Zwei Fehlalarme beim
// Bauen zeigten warum:
//   1. Ein durchsichtiger Knopf saß auf einer dunklen Karte - gemessen
//      wurde aber gegen die helle Seitenfarbe (1,06:1 gemeldet, in
//      Wirklichkeit einwandfrei).
//   2. Die Onboarding-Karte hat einen Verlauf aus fast durchsichtigen
//      Stopps (Alpha 0,06). Als deckend gerechnet ergab das 1,59:1,
//      obwohl dort schlicht dunkle Schrift auf fast weißem Grund steht.
// Deshalb sammelt die Messung alle Schichten zwischen Text und Seite ein
// und rechnet sie von unten nach oben übereinander.

// WCAG AA: 4,5:1 für normalen Text, 3:1 für großen (ab 24px, oder ab
// 18,66px wenn fett).
const MESSUNG = `(() => {
  function zahlen(c) { return (c.match(/[\\d.]+/g) || []).map(Number) }
  function alpha(c) { const z = zahlen(c); return z.length > 3 ? z[3] : 1 }
  const durchsichtig = c => !c || c === 'transparent' || alpha(c) === 0

  function lum(c) {
    const [r,g,b] = zahlen(c).slice(0,3).map(v => {
      v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4)
    })
    return 0.2126*r + 0.7152*g + 0.0722*b
  }
  function verh(a, b) {
    const l1 = lum(a), l2 = lum(b)
    return +(((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05))).toFixed(2)
  }
  function ueber(vorne, hinten) {
    const f = zahlen(vorne), h = zahlen(hinten), a = alpha(vorne)
    if (a >= 1) return 'rgb(' + f.slice(0,3).join(',') + ')'
    return 'rgb(' + f.slice(0,3).map((v,i) => Math.round(v*a + h[i]*(1-a))).join(',') + ')'
  }

  // Alle Hintergrundschichten vom Element aufwaerts, innerste zuerst.
  // Ein Verlauf steuert mehrere Farben bei (beide Enden) - der Text
  // laeuft ueber die ganze Flaeche, nicht nur ueber deren helle Haelfte.
  // Abgebrochen wird erst bei der ersten wirklich deckenden Schicht.
  function schichten(el) {
    const liste = []
    let k = el
    while (k && k !== document.documentElement) {
      const s = getComputedStyle(k)
      const stops = s.backgroundImage.match(/rgba?\\([^)]+\\)/g)
      if (stops) {
        liste.push(stops)
        if (stops.every(c => alpha(c) >= 1)) return liste
      } else if (!durchsichtig(s.backgroundColor)) {
        liste.push([s.backgroundColor])
        if (alpha(s.backgroundColor) >= 1) return liste
      }
      k = k.parentElement
    }
    return liste
  }

  function grundfarben(el) {
    const wurzel = getComputedStyle(document.documentElement).backgroundColor
    const koerper = getComputedStyle(document.body).backgroundColor
    let unten = !durchsichtig(koerper) ? koerper
              : (!durchsichtig(wurzel) ? wurzel : 'rgb(255,255,255)')
    let kandidaten = [ueber(unten, 'rgb(255,255,255)')]
    const liste = schichten(el)
    for (let i = liste.length - 1; i >= 0; i--) {
      const neu = []
      for (const u of kandidaten) for (const o of liste[i]) neu.push(ueber(o, u))
      kandidaten = neu
    }
    return kandidaten
  }

  const schlecht = []
  document.querySelectorAll('*').forEach(el => {
    if (el.children.length) return               // nur Blaetter: sonst doppelt
    const text = (el.innerText || '').trim()
    if (text.length < 2) return
    const st = getComputedStyle(el)
    if (st.visibility === 'hidden' || st.opacity === '0') return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return

    const px = parseFloat(st.fontSize)
    const fett = parseInt(st.fontWeight, 10) >= 700
    const noetig = (px >= 24 || (fett && px >= 18.66)) ? 3 : 4.5

    const wert = Math.min(...grundfarben(el).map(g => verh(ueber(st.color, g), g)))
    if (wert < noetig) {
      schlecht.push(wert + ':1 (noetig ' + noetig + ') <' + el.tagName.toLowerCase() +
        (el.className ? '.' + String(el.className).split(' ')[0] : '') +
        '> "' + text.slice(0, 32) + '"')
    }
  })
  return schlecht
})()`

module.exports = { MESSUNG }
