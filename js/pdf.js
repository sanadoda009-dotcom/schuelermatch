// Erzeugt einen Lebenslauf als PDF-Download.
// Schreibt Text direkt ins PDF (jsPDF) statt die HTML-Ansicht zu screenshotten –
// das ist deterministisch und kann nicht "leer" ausfallen wie html2canvas.

const RAND = 20
const BREITE = 170 // A4 (210mm) minus 2x Rand
const SEITEN_ENDE = 275

export async function ladeLebenslaufAlsPdf(daten) {
  const { name, alter_jahre, ort, email, foto_url, schule, klasse, bloecke, motivationsschreiben } = daten

  if (!window.jspdf) {
    alert('PDF-Bibliothek nicht geladen – bitte Seite neu laden (Strg+Shift+R).')
    return
  }

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 20

  // Kopfbereich: Foto (falls ladbar) + Name + Basisdaten
  let textX = RAND
  const foto = foto_url ? await bildAlsJpeg(foto_url, 400) : null
  if (foto) {
    doc.addImage(foto.dataUrl, 'JPEG', RAND, y, 28, 28)
    textX = RAND + 34
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(22, 26, 31)
  doc.text(name || 'Unbekannt', textX, y + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(90, 98, 112)
  const zeile2 = [schule, klasse, alter_jahre ? alter_jahre + ' Jahre' : null].filter(Boolean).join(' · ')
  if (zeile2) doc.text(zeile2, textX, y + 16)
  const zeile3 = [ort, email].filter(Boolean).join(' · ')
  if (zeile3) doc.text(zeile3, textX, y + 22)

  y = Math.max(y + 28, y + 24) + 6
  doc.setDrawColor(0, 200, 150)
  doc.setLineWidth(1)
  doc.line(RAND, y, RAND + BREITE, y)
  y += 10

  // Abschnitte
  if (motivationsschreiben) {
    y = textAbschnitt(doc, y, 'Motivationsschreiben', motivationsschreiben)
  }

  for (const b of (bloecke || [])) {
    if (b.typ === 'text' && b.inhalt?.trim()) {
      y = textAbschnitt(doc, y, b.titel || 'Abschnitt', b.inhalt)
    } else if (b.typ === 'skills') {
      const tags = (b.tags || '').split(',').map(t => t.trim()).filter(Boolean)
      if (tags.length) y = textAbschnitt(doc, y, b.titel || 'Fähigkeiten', tags.join('  ·  '))
    } else if (b.typ === 'sprachen') {
      const sprachen = (b.sprachen || []).filter(s => s.name?.trim())
      if (sprachen.length) {
        y = abschnittsTitel(doc, y, b.titel || 'Sprachen')
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(22, 26, 31)
        for (const s of sprachen) {
          if (y > SEITEN_ENDE) { doc.addPage(); y = 20 }
          doc.text(`${s.name}`, RAND, y)
          doc.setTextColor(0, 168, 125)
          doc.text(s.niveau || '', RAND + BREITE, y, { align: 'right' })
          doc.setTextColor(22, 26, 31)
          y += 6
        }
        y += 6
      }
    } else if (b.typ === 'skillbar') {
      const skills = (b.skills || []).filter(s => s.name?.trim())
      if (skills.length) {
        y = abschnittsTitel(doc, y, b.titel || 'Fähigkeiten')
        for (const s of skills) {
          if (y > SEITEN_ENDE) { doc.addPage(); y = 20 }
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(22, 26, 31)
          doc.text(s.name, RAND, y)
          const barY = y + 2
          doc.setFillColor(231, 227, 218)
          doc.roundedRect(RAND, barY, BREITE, 2.4, 1.2, 1.2, 'F')
          doc.setFillColor(0, 200, 150)
          doc.roundedRect(RAND, barY, BREITE * ((s.wert || 0) / 100), 2.4, 1.2, 1.2, 'F')
          y += 10
        }
        y += 4
      }
    } else if (b.typ === 'bild' && b.bild_url) {
      const bild = await bildAlsJpeg(b.bild_url, 800)
      if (bild) {
        const wMm = Math.min(90, BREITE)
        const hMm = wMm * (bild.h / bild.w)
        if (y + hMm > SEITEN_ENDE) { doc.addPage(); y = 20 }
        if (b.titel) y = abschnittsTitel(doc, y, b.titel)
        doc.addImage(bild.dataUrl, 'JPEG', RAND, y, wMm, hMm)
        y += hMm + 10
      }
    }
  }

  // Fusszeile
  doc.setFontSize(8)
  doc.setTextColor(154, 160, 168)
  doc.text('Erstellt über SchülerMatch · schuelermatch.de', RAND, 288)

  const dateiname = `Lebenslauf_${(name || 'Schueler').replace(/\s+/g, '_')}.pdf`
  doc.save(dateiname)
}

function abschnittsTitel(doc, y, titel) {
  if (y > SEITEN_ENDE - 15) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(0, 168, 125)
  doc.text(titel.toUpperCase(), RAND, y)
  return y + 6
}

function textAbschnitt(doc, y, titel, text) {
  y = abschnittsTitel(doc, y, titel)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(22, 26, 31)

  const zeilen = doc.splitTextToSize(text, BREITE)
  for (const zeile of zeilen) {
    if (y > SEITEN_ENDE) { doc.addPage(); y = 20 }
    doc.text(zeile, RAND, y)
    y += 5.2
  }
  return y + 8
}

// Laedt ein Bild und wandelt es (egal welches Format) in JPEG-DataURL um.
// Gibt null zurueck wenn das Bild nicht ladbar ist – der Rest des PDFs entsteht trotzdem.
async function bildAlsJpeg(url, maxBreitePx) {
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
  } catch {
    return null
  }
}
