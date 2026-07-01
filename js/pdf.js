// Erzeugt einen professionell aussehenden Lebenslauf als PDF-Download.
// Nutzt html2pdf.js (per <script> in der HTML-Seite eingebunden).

export function ladeLebenslaufAlsPdf(daten) {
  const { name, alter_jahre, ort, email, foto_url, schule, klasse, faehigkeiten, erfahrung, ueber_mich, motivationsschreiben } = daten
  const tags = (faehigkeiten || '').split(',').map(t => t.trim()).filter(Boolean)

  const el = document.createElement('div')
  el.style.cssText = 'width:210mm; padding:18mm; font-family: Arial, Helvetica, sans-serif; color:#161a1f; box-sizing:border-box;'
  el.innerHTML = `
    <div style="display:flex; align-items:center; gap:22px; border-bottom:3px solid #00c896; padding-bottom:20px; margin-bottom:26px;">
      ${foto_url
        ? `<img src="${foto_url}" style="width:100px; height:100px; border-radius:50%; object-fit:cover;" crossorigin="anonymous">`
        : `<div style="width:100px; height:100px; border-radius:50%; background:#2b2f8f; color:#fff; display:flex; align-items:center; justify-content:center; font-size:38px; font-weight:bold;">${escapeHtml((name || '?')[0]?.toUpperCase() || '?')}</div>`
      }
      <div>
        <h1 style="margin:0; font-size:28px;">${escapeHtml(name || 'Unbekannt')}</h1>
        <p style="margin:6px 0 0; color:#5a6270; font-size:14px;">${escapeHtml(schule || '')}${klasse ? ' · ' + escapeHtml(klasse) : ''}${alter_jahre ? ' · ' + alter_jahre + ' Jahre' : ''}</p>
        <p style="margin:4px 0 0; color:#5a6270; font-size:13px;">${escapeHtml(ort || '')}${email ? ' · ' + escapeHtml(email) : ''}</p>
      </div>
    </div>

    ${abschnitt('Motivationsschreiben', motivationsschreiben)}
    ${abschnitt('Über mich', ueber_mich)}
    ${abschnitt('Erfahrung', erfahrung)}
    ${tags.length ? `
      <div style="margin-bottom:22px;">
        <h3 style="font-size:13px; text-transform:uppercase; letter-spacing:0.5px; color:#00a87d; margin-bottom:10px;">Fähigkeiten</h3>
        <div>${tags.map(t => `<span style="display:inline-block; background:#faf8f4; border:1px solid #e7e3da; border-radius:6px; padding:4px 10px; font-size:12px; margin:0 6px 6px 0;">${escapeHtml(t)}</span>`).join('')}</div>
      </div>` : ''}

    <p style="margin-top:40px; font-size:10px; color:#9aa0a8;">Erstellt über SchülerMatch · schuelermatch.de</p>
  `

  el.id = 'pdf-render-temp'
  el.style.position = 'fixed'
  el.style.top = '-99999px'
  document.body.appendChild(el)

  const dateiname = `Lebenslauf_${(name || 'Schueler').replace(/\s+/g, '_')}.pdf`

  return html2pdf().from(el).set({
    margin: 0,
    filename: dateiname,
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).save().then(() => {
    document.body.removeChild(el)
  })
}

function abschnitt(titel, text) {
  if (!text) return ''
  return `
    <div style="margin-bottom:22px;">
      <h3 style="font-size:13px; text-transform:uppercase; letter-spacing:0.5px; color:#00a87d; margin-bottom:8px;">${escapeHtml(titel)}</h3>
      <p style="font-size:13px; line-height:1.6; margin:0; white-space:pre-wrap;">${escapeHtml(text)}</p>
    </div>
  `
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
