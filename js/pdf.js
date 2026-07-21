// Lebenslauf-PDF nach fester Typografie-Spezifikation.
// Zweispaltiges A4-Dokument (jsPDF, direktes Zeichnen in mm) –
// KEIN html2canvas (war unzuverlässig), damit das PDF nie leer ausfällt.
//
// Spezifikation (exakt, nicht "ungefähr"):
//   Seite: A4 210×297mm · Rand oben/unten 18mm · links/rechts 15mm
//   Spalten: links 35% (Seitenleiste, getönt), rechts 65%, Abstand 8mm
//   Name 26pt bold LH1.1 · Untertitel 11pt #6b7280
//   Abschnittstitel 10pt bold VERSALIEN +0.08em, darunter Akzentlinie
//   Eintragstitel 11.5pt bold · Datum/Ort 9.5pt grau · Fließtext 10pt LH1.5
//   Abstände: Abschnitt→Abschnitt 7mm · Eintrag→Eintrag 4mm ·
//             Titel→erster Eintrag 3mm · Eintragstitel→Text 1.5mm
//   Farben: 1 Akzent + Grautöne · Text #1a1a1a · keine Verläufe/Schatten
//   Skill-Balken 4px (=1.4mm) ohne Prozentwert · keine Emojis

const SEITE_W = 210
const SEITE_H = 297
const RAND_OBEN = 18
const RAND_UNTEN = 18
const RAND_LINKS = 15
const RAND_RECHTS = 15
const SPALTEN_ABSTAND = 8

const INHALT_W = SEITE_W - RAND_LINKS - RAND_RECHTS          // 180
const LINKS_W = Math.round(INHALT_W * 0.35)                   // 63
const RECHTS_X = RAND_LINKS + LINKS_W + SPALTEN_ABSTAND       // 86
const RECHTS_W = SEITE_W - RAND_RECHTS - RECHTS_X             // 109
const BAND_W = RAND_LINKS + LINKS_W + SPALTEN_ABSTAND / 2     // Tonfläche bis in den Spaltenabstand

const SEITEN_ENDE = SEITE_H - RAND_UNTEN                      // 279

// Abstände (mm) laut Spec
const ABST_ABSCHNITT = 7
const ABST_EINTRAG = 4
const ABST_TITEL_INHALT = 3
const ABST_EINTRAG_TEXT = 1.5

// Typografie (pt) laut Spec
const PT = 0.352778 // 1pt in mm
const F_NAME = 26
const F_UNTERTITEL = 11
const F_ABSCHNITT = 10
const F_EINTRAG = 11.5
const F_META = 9.5
const F_TEXT = 10
const LH_TEXT = F_TEXT * 1.5 * PT   // 5.29mm Zeilenvorschub Fließtext

// Farben
const C_TEXT = [26, 26, 26]        // #1a1a1a
const C_GRAU = [107, 114, 128]     // #6b7280
const C_HELLGRAU = [229, 231, 235] // #e5e7eb (Balken-Hintergrund)
const C_BAND_NEUTRAL = [244, 244, 245] // #f4f4f5

const FARBEN = {
  gruen: { akzent: [0, 168, 125] },
  blau: { akzent: [43, 47, 143] },
  coral: { akzent: [200, 72, 58] },
  grau: { akzent: [70, 76, 86] }
}

// sehr helle Tönung der Akzentfarbe (für Seitenleiste im Layout "modern")
function toenung(rgb, anteil = 0.9) {
  return rgb.map(k => Math.round(k + (255 - k) * anteil))
}

// Versatz von Zeilen-Oberkante zur Schrift-Grundlinie (10pt-Text)
const BASIS = F_TEXT * PT // 3.53mm

function ohneEmojis(s) {
  return (s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE0F}\u{200D}]/gu, '').trim()
}

/* ============================================================
   Öffentliche API
   ============================================================ */

// Erzeugt das jsPDF-Dokument (für Download UND automatischen Bewerbungs-Anhang)
export async function erzeugeLebenslaufPdf(daten) {
  return (await baueDokument(daten)).doc
}

// Wie oben, liefert zusätzlich Anker-Positionen {id, seite, y} pro Abschnitt –
// die Live-Vorschau (lebenslauf.html) scrollt damit zum passenden Abschnitt.
export async function erzeugeLebenslaufPdfMitAnkern(daten) {
  return baueDokument(daten)
}

async function baueDokument(daten) {
  if (!window.jspdf) throw new Error('PDF-Bibliothek nicht geladen')
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const layout = daten.cv_design?.layout || 'klassisch'
  const farbe = FARBEN[daten.cv_design?.farbe] || FARBEN.gruen
  const stil = {
    akzent: layout === 'minimal' ? [74, 80, 90] : farbe.akzent,
    band: layout === 'modern' ? toenung(farbe.akzent) : C_BAND_NEUTRAL
  }

  const bloecke = Array.isArray(daten.bloecke) ? daten.bloecke : []

  // Blöcke auf Spalten verteilen
  const linksBloecke = []   // sprachen, skillbar, skills(tags)
  const rechtsBloecke = []  // text, bild
  let ueberMich = null
  for (const b of bloecke) {
    if (b.typ === 'text') {
      if (!ueberMich && /über mich/i.test(b.titel || '')) { ueberMich = b; continue }
      if (b.inhalt?.trim()) rechtsBloecke.push(b)
    } else if (b.typ === 'bild') {
      if (b.bild_url) rechtsBloecke.push(b)
    } else if (b.typ === 'sprachen') {
      if ((b.sprachen || []).some(s => s.name?.trim())) linksBloecke.push(b)
    } else if (b.typ === 'skillbar') {
      if ((b.skills || []).some(s => s.name?.trim())) linksBloecke.push(b)
    } else if (b.typ === 'skills') {
      if ((b.tags || '').trim()) linksBloecke.push(b)
    }
  }

  const zustand = { doc, stil, seiten: 1, anker: [] }

  bandZeichnen(zustand, 1)
  zustand.anker.push({ id: 'persoenlich', seite: 1, y: RAND_OBEN })

  /* ---------- LINKE SPALTE ---------- */
  let yL = RAND_OBEN
  let seiteL = 1

  // Foto (rund, 32mm) – Kreisform entsteht durch Zuschnitt auf Band-Hintergrundfarbe
  if (daten.foto_url) {
    const foto = await bildRund(daten.foto_url, 400, stil.band)
    if (foto) {
      const d = 32
      doc.addImage(foto, 'JPEG', RAND_LINKS + (LINKS_W - d) / 2, yL, d, d)
      yL += d + ABST_ABSCHNITT
    }
  }

  // yL ist immer die OBERKANTE der nächsten Zeile; Grundlinie = yL + BASIS.

  // Kontakt
  const kontakt = [daten.ort, daten.email].filter(Boolean)
  if (kontakt.length) {
    ;({ y: yL, seite: seiteL } = abschnittsTitelLinks(zustand, yL, seiteL, 'Kontakt'))
    doc.setFont('helvetica', 'normal'); doc.setFontSize(F_TEXT); doc.setTextColor(...C_TEXT)
    for (const zeile of kontakt) {
      for (const t of doc.splitTextToSize(ohneEmojis(zeile), LINKS_W)) {
        ;({ y: yL, seite: seiteL } = platzLinks(zustand, yL, seiteL, LH_TEXT))
        doc.text(t, RAND_LINKS, yL + BASIS)
        yL += LH_TEXT
      }
    }
    yL += ABST_ABSCHNITT
  }

  for (const b of linksBloecke) {
    zustand.anker.push({ id: b.id || '', seite: seiteL, y: yL })
    if (b.typ === 'sprachen') {
      ;({ y: yL, seite: seiteL } = abschnittsTitelLinks(zustand, yL, seiteL, b.titel || 'Sprachen'))
      for (const s of (b.sprachen || []).filter(s => s.name?.trim())) {
        ;({ y: yL, seite: seiteL } = platzLinks(zustand, yL, seiteL, LH_TEXT))
        doc.setFont('helvetica', 'normal'); doc.setFontSize(F_TEXT); doc.setTextColor(...C_TEXT)
        doc.text(ohneEmojis(s.name), RAND_LINKS, yL + BASIS)
        doc.setFontSize(F_META); doc.setTextColor(...C_GRAU)
        doc.text(s.niveau || '', RAND_LINKS + LINKS_W, yL + BASIS, { align: 'right' })
        yL += LH_TEXT
      }
      yL += ABST_ABSCHNITT
    } else if (b.typ === 'skillbar') {
      ;({ y: yL, seite: seiteL } = abschnittsTitelLinks(zustand, yL, seiteL, b.titel || 'Fähigkeiten'))
      const skills = (b.skills || []).filter(s => s.name?.trim())
      // Eintrag: Name (Grundlinie +3.5) · Balken 1.6mm darunter · 4mm zum nächsten Eintrag
      const EINTRAG_H = BASIS + 1.6 + 1.4
      for (let i = 0; i < skills.length; i++) {
        ;({ y: yL, seite: seiteL } = platzLinks(zustand, yL, seiteL, EINTRAG_H + ABST_EINTRAG))
        const s = skills[i]
        doc.setFont('helvetica', 'normal'); doc.setFontSize(F_TEXT); doc.setTextColor(...C_TEXT)
        doc.text(ohneEmojis(s.name), RAND_LINKS, yL + BASIS)
        const barY = yL + BASIS + 1.6 // 1.6mm unter der Grundlinie
        doc.setFillColor(...C_HELLGRAU)
        doc.roundedRect(RAND_LINKS, barY, LINKS_W, 1.4, 0.7, 0.7, 'F')
        doc.setFillColor(...stil.akzent)
        doc.roundedRect(RAND_LINKS, barY, Math.max(2, LINKS_W * ((s.wert || 0) / 100)), 1.4, 0.7, 0.7, 'F')
        yL += EINTRAG_H + (i < skills.length - 1 ? ABST_EINTRAG : 0)
      }
      yL += ABST_ABSCHNITT
    } else if (b.typ === 'skills') {
      ;({ y: yL, seite: seiteL } = abschnittsTitelLinks(zustand, yL, seiteL, b.titel || 'Interessen'))
      doc.setFont('helvetica', 'normal'); doc.setFontSize(F_TEXT); doc.setTextColor(...C_TEXT)
      const text = (b.tags || '').split(',').map(t => ohneEmojis(t)).filter(Boolean).join(' · ')
      for (const t of doc.splitTextToSize(text, LINKS_W)) {
        ;({ y: yL, seite: seiteL } = platzLinks(zustand, yL, seiteL, LH_TEXT))
        doc.text(t, RAND_LINKS, yL + BASIS)
        yL += LH_TEXT
      }
      yL += ABST_ABSCHNITT
    }
  }

  /* ---------- RECHTE SPALTE ---------- */
  doc.setPage(1)
  zustand.aktSeite = 1
  let yR = RAND_OBEN

  // Name (26pt bold, LH 1.1)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(F_NAME)
  doc.setTextColor(...C_TEXT)
  const nameZeilen = doc.splitTextToSize(ohneEmojis(daten.name) || 'Unbekannt', RECHTS_W)
  yR += F_NAME * PT // Grundlinie der ersten Zeile
  for (const z of nameZeilen) {
    doc.text(z, RECHTS_X, yR)
    yR += F_NAME * 1.1 * PT
  }
  yR -= F_NAME * 1.1 * PT

  // Untertitel: "Schüler/in · 9. Klasse · Gymnasium X · 15 Jahre"
  const unter = ['Schüler/in', daten.klasse, daten.schule, daten.alter_jahre ? `${daten.alter_jahre} Jahre` : null]
    .filter(Boolean).join(' · ')
  yR += F_UNTERTITEL * PT + 2.2
  doc.setFont('helvetica', 'normal'); doc.setFontSize(F_UNTERTITEL); doc.setTextColor(...C_GRAU)
  for (const z of doc.splitTextToSize(ohneEmojis(unter), RECHTS_W)) {
    doc.text(z, RECHTS_X, yR)
    yR += F_UNTERTITEL * 1.35 * PT
  }

  // Kurzprofil ("Über mich") direkt unter dem Namen, ohne Abschnittstitel
  if (ueberMich?.inhalt?.trim()) {
    zustand.anker.push({ id: ueberMich.id || 'uebermich', seite: zustand.aktSeite, y: yR })
    yR += 2.5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(F_TEXT); doc.setTextColor(...C_TEXT)
    for (const z of doc.splitTextToSize(ohneEmojis(ueberMich.inhalt), RECHTS_W)) {
      yR = platzRechts(zustand, yR, LH_TEXT)
      doc.text(z, RECHTS_X, yR)
      yR += LH_TEXT
    }
  }
  yR += ABST_ABSCHNITT

  // Motivationsschreiben (Firmen-Export) als erster Abschnitt rechts
  if (daten.motivationsschreiben?.trim()) {
    yR = textAbschnittRechts(zustand, yR, 'Motivationsschreiben', daten.motivationsschreiben)
  }

  for (const b of rechtsBloecke) {
    zustand.anker.push({ id: b.id || '', seite: zustand.aktSeite, y: yR })
    if (b.typ === 'text') {
      yR = textAbschnittRechts(zustand, yR, b.titel || 'Weiteres', b.inhalt)
    } else if (b.typ === 'bild') {
      const bild = await bildAlsJpeg(b.bild_url, 800)
      if (bild) {
        const wMm = Math.min(70, RECHTS_W)
        const hMm = wMm * (bild.h / bild.w)
        yR = platzRechts(zustand, yR, hMm + (b.titel ? 8 : 2))
        if (b.titel) yR = abschnittsTitelRechts(zustand, yR, b.titel)
        doc.addImage(bild.dataUrl, 'JPEG', RECHTS_X, yR - 3, wMm, hMm)
        yR += hMm + ABST_ABSCHNITT - 3
      }
    }
  }

  // Fußzeile nur auf der letzten Seite, dezent
  doc.setPage(zustand.seiten)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C_GRAU)
  doc.text('Erstellt über SchülerMatch · schuelermatch.de', RECHTS_X, SEITE_H - 8)

  return { doc, anker: zustand.anker }
}

// Bisherige Schnittstelle: erzeugt das PDF und lädt es herunter
export async function ladeLebenslaufAlsPdf(daten) {
  try {
    const doc = await erzeugeLebenslaufPdf(daten)
    doc.save(`Lebenslauf_${(daten.name || 'Schueler').replace(/\s+/g, '_')}.pdf`)
  } catch (e) {
    // toast.js setzt window.toast; pdf.js bleibt bewusst importfrei
    if (window.toast) window.toast('PDF konnte nicht erstellt werden: ' + e.message, 'fehler')
    else console.error('PDF-Fehler:', e)
  }
}

// Für den automatischen Bewerbungs-Anhang (Teilschritt 3)
export async function lebenslaufAlsBlob(daten) {
  const doc = await erzeugeLebenslaufPdf(daten)
  return doc.output('blob')
}

/* ============================================================
   Interne Helfer
   ============================================================ */

function bandZeichnen(zustand, seite) {
  const { doc, stil } = zustand
  doc.setPage(seite)
  doc.setFillColor(...stil.band)
  doc.rect(0, 0, BAND_W, SEITE_H, 'F')
}

function neueSeite(zustand) {
  const { doc } = zustand
  if (zustand.aktSeite != null && zustand.aktSeite < zustand.seiten) {
    // rechte Spalte wechselt auf eine bereits existierende Seite
    zustand.aktSeite++
    doc.setPage(zustand.aktSeite)
  } else {
    doc.addPage()
    zustand.seiten++
    if (zustand.aktSeite != null) zustand.aktSeite = zustand.seiten
    bandZeichnen(zustand, zustand.seiten)
  }
  return RAND_OBEN
}

// Abschnittstitel (beide Spalten gleich): 10pt bold VERSALIEN, Akzentlinie darunter
function abschnittsTitel(zustand, x, breite, y, titel) {
  const { doc, stil } = zustand
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(F_ABSCHNITT)
  doc.setTextColor(...C_TEXT)
  y += F_ABSCHNITT * PT
  doc.text(ohneEmojis(titel).toUpperCase(), x, y, { charSpace: 0.28 }) // 0.08em von 10pt
  y += 1.6
  doc.setDrawColor(...stil.akzent)
  doc.setLineWidth(0.3) // "1px"-Linie in Druckstärke
  doc.line(x, y, x + breite, y)
  return y + ABST_TITEL_INHALT
}

function abschnittsTitelRechts(zustand, y, titel) {
  y = platzRechts(zustand, y, 14) // Titel nie allein am Seitenende
  return abschnittsTitel(zustand, RECHTS_X, RECHTS_W, y, titel)
}

function abschnittsTitelLinks(zustand, y, seite, titel) {
  ;({ y, seite } = platzLinks(zustand, y, seite, 14))
  const neuesY = abschnittsTitel(zustand, RAND_LINKS, LINKS_W, y, titel)
  return { y: neuesY, seite }
}

// Seitenumbruch-Prüfung rechte Spalte
function platzRechts(zustand, y, benoetigt) {
  if (y + benoetigt > SEITEN_ENDE) return neueSeite(zustand)
  return y
}

// Seitenumbruch-Prüfung linke Spalte (eigene Seitenzählung)
function platzLinks(zustand, y, seite, benoetigt) {
  if (y + benoetigt > SEITEN_ENDE) {
    if (seite < zustand.seiten) {
      seite++
      zustand.doc.setPage(seite)
    } else {
      zustand.doc.addPage()
      zustand.seiten++
      seite = zustand.seiten
      bandZeichnen(zustand, seite)
    }
    return { y: RAND_OBEN, seite }
  }
  return { y, seite }
}

// Textabschnitt rechte Spalte: Titel + Fließtext (10pt, LH 1.5)
function textAbschnittRechts(zustand, y, titel, text) {
  const { doc } = zustand
  y = abschnittsTitelRechts(zustand, y, titel)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(F_TEXT)
  doc.setTextColor(...C_TEXT)
  const absaetze = ohneEmojis(text).split(/\n+/).filter(Boolean)
  for (let a = 0; a < absaetze.length; a++) {
    for (const zeile of doc.splitTextToSize(absaetze[a], RECHTS_W)) {
      y = platzRechts(zustand, y, LH_TEXT)
      y += LH_TEXT
      doc.text(zeile, RECHTS_X, y - LH_TEXT + F_TEXT * PT)
    }
    if (a < absaetze.length - 1) y += ABST_EINTRAG // Absatz = Eintragsabstand 4mm
  }
  return y + ABST_ABSCHNITT
}

/* ---------- Bild-Helfer ---------- */

// Cache: die Live-Vorschau erzeugt das PDF bei jeder Eingabe neu –
// Bilder sollen dabei nur EINMAL geladen und konvertiert werden.
const bildCache = new Map()

async function bildAlsJpeg(url, maxBreitePx) {
  const key = `jpeg|${url}|${maxBreitePx}`
  if (bildCache.has(key)) return bildCache.get(key)
  const ergebnis = await _bildAlsJpeg(url, maxBreitePx)
  bildCache.set(key, ergebnis)
  return ergebnis
}

async function _bildAlsJpeg(url, maxBreitePx) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, maxBreitePx / bmp.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), w: canvas.width, h: canvas.height }
  } catch { return null }
}

// Rundes Foto: Kreis-Zuschnitt, Rest in Band-Hintergrundfarbe gefüllt
// (JPEG kennt keine Transparenz – auf der einfarbigen Seitenleiste wirkt es rund)
async function bildRund(url, groessePx, bandRgb) {
  const key = `rund|${url}|${groessePx}|${bandRgb.join(',')}`
  if (bildCache.has(key)) return bildCache.get(key)
  const ergebnis = await _bildRund(url, groessePx, bandRgb)
  bildCache.set(key, ergebnis)
  return ergebnis
}

async function _bildRund(url, groessePx, bandRgb) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = groessePx
    canvas.height = groessePx
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = `rgb(${bandRgb[0]},${bandRgb[1]},${bandRgb[2]})`
    ctx.fillRect(0, 0, groessePx, groessePx)
    ctx.beginPath()
    ctx.arc(groessePx / 2, groessePx / 2, groessePx / 2, 0, Math.PI * 2)
    ctx.clip()
    // Bild mittig zuschneiden (cover)
    const s = Math.min(bmp.width, bmp.height)
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, groessePx, groessePx)
    return canvas.toDataURL('image/jpeg', 0.88)
  } catch { return null }
}
