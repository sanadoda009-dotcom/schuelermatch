import { supabase } from './supabase.js'

function escapeHtml(str) {
  const div = document.createElement('div'); div.textContent = str ?? ''; return div.innerHTML
}
function gesehenKey(rolle, id) { return `gesehen-${rolle}-${id}` }
function ladeGesehen(rolle, id) {
  try { return new Set(JSON.parse(localStorage.getItem(gesehenKey(rolle, id)) || '[]')) } catch { return new Set() }
}
function speichereGesehen(rolle, id, set) {
  try { localStorage.setItem(gesehenKey(rolle, id), JSON.stringify([...set])) } catch {}
}

// Wie viele Eintraege das Menue hoechstens zeigt. Ohne Grenze waechst die
// Liste mit jeder Bewerbung – bei einer Firma mit vielen Anzeigen wird das
// Menue laenger als der Bildschirm.
const GRENZE = 8

// Sammelt Benachrichtigungen je nach Rolle.
async function sammle(rolle, profileId) {
  const items = []

  // Ungelesene Nachrichten (beide Rollen) – RLS liefert nur eigene Konversationen
  const { data: msgs } = await supabase.from('nachrichten')
    .select('bewerbung_id, gelesen, absender_id, bewerbung:bewerbung_id(job:job_id(titel))')
    .eq('gelesen', false).neq('absender_id', profileId)
  const proKonv = {}
  ;(msgs || []).forEach(m => {
    const t = m.bewerbung?.job?.titel || 'Job'
    proKonv[t] = (proKonv[t] || 0) + 1
  })
  Object.entries(proKonv).forEach(([titel, n]) => {
    items.push({ icon: '💬', text: `<b>${n} neue Nachricht${n > 1 ? 'en' : ''}</b> · ${escapeHtml(titel)}`, ziel: 'nachrichten', frisch: true })
  })

  if (rolle === 'schueler') {
    const gesehen = ladeGesehen('schueler', profileId)
    const { data: bew } = await supabase.from('bewerbungen')
      .select('id, status, erstellt_am, job:job_id(titel)').eq('schueler_id', profileId)
      .in('status', ['angenommen', 'abgelehnt'])
      .order('erstellt_am', { ascending: false })
      .limit(GRENZE)
    ;(bew || []).forEach(b => {
      const key = `${b.id}:${b.status}`
      const frisch = !gesehen.has(key)
      items.push({
        icon: b.status === 'angenommen' ? '🎉' : '📩',
        text: b.status === 'angenommen'
          ? `<b>Angenommen!</b> ${escapeHtml(b.job?.titel || 'Job')}`
          : `Bewerbung für ${escapeHtml(b.job?.titel || 'Job')}: <b>nicht geklappt</b>`,
        ziel: 'jobs', frisch, schluessel: key,
      })
    })
  } else {
    // Frueher stand hier `if (frisch) items.push(...)`. Das Oeffnen der
    // Glocke markiert aber alles als gesehen und zeichnet danach neu –
    // die Liste war also in dem Moment leer, in dem die Firma sie
    // ansehen wollte. Das Abzeichen sagte "2", das Menue "Keine neuen
    // Benachrichtigungen". Jetzt wie beim Schueler: immer anzeigen,
    // `frisch` steuert nur noch die Zahl am Abzeichen.
    const gesehen = ladeGesehen('firma', profileId)
    const { data: bew } = await supabase.from('bewerbungen')
      .select('id, erstellt_am, job:job_id(titel)')
      .order('erstellt_am', { ascending: false })
      .limit(GRENZE)
    ;(bew || []).forEach(b => {
      const frisch = !gesehen.has(b.id)
      items.push({
        icon: '🧑‍🎓',
        text: `<b>${frisch ? 'Neue Bewerbung' : 'Bewerbung'}</b> · ${escapeHtml(b.job?.titel || 'Job')}`,
        ziel: 'jobs', frisch, schluessel: b.id,
      })
    })
  }

  return { items, ungelesen: (msgs || []).length }
}

export function initGlocke({ rolle, profileId, onNavigate, onUngelesen }) {
  const btn = document.getElementById('glocke-btn')
  const badge = document.getElementById('glocke-badge')
  const dd = document.getElementById('glocke-dropdown')
  if (!btn || !badge || !dd) return { aktualisiere: () => {}, stop: () => {} }

  // Die Schluessel der zuletzt angezeigten Eintraege – nur die werden
  // beim Oeffnen als gesehen vermerkt.
  let letzteSchluessel = []

  async function render() {
    const { items, ungelesen } = await sammle(rolle, profileId)
    // Die Zahl weitergeben, statt sie das Dashboard separat abfragen zu
    // lassen - das war eine komplett doppelte Abfrage auf dieselbe Tabelle
    // mit derselben Bedingung.
    onUngelesen?.(ungelesen)
    letzteSchluessel = items.filter(i => i.schluessel).map(i => i.schluessel)
    const frischN = items.filter(i => i.frisch).length
    badge.textContent = frischN
    badge.classList.toggle('aktiv', frischN > 0)

    dd.innerHTML = `<div class="glocke-titel">Benachrichtigungen</div>` + (
      items.length
        ? items.map((i, idx) => `<button class="benachr-item" data-ziel="${i.ziel}" data-idx="${idx}"><span class="b-icon">${i.icon}</span><span class="b-text">${i.text}</span></button>`).join('')
        : '<div class="benachr-leer">Keine neuen Benachrichtigungen 🎉</div>'
    )
    dd.querySelectorAll('.benachr-item').forEach(el => {
      el.addEventListener('click', () => {
        dd.classList.remove('offen')
        onNavigate?.(el.dataset.ziel)
      })
    })
  }

  // Gemerkt wird genau das, was auch im Menue stand. Frueher fragte diese
  // Funktion die Bewerbungen noch einmal ab und markierte ALLE als gesehen –
  // auch die, die wegen der Grenze gar nicht angezeigt wurden. Die waeren
  // damit stillschweigend verschwunden. Und die Abfrage davor war ein
  // `sammle(...)`, dessen Ergebnis weggeworfen wurde.
  function markiereGesehen() {
    if (!letzteSchluessel.length) return
    const g = ladeGesehen(rolle, profileId)
    letzteSchluessel.forEach(k => g.add(k))
    speichereGesehen(rolle, profileId, g)
    // Bewusst kein render(): Das wuerde die Liste unter den Augen des
    // Lesers neu zeichnen. Nur das Abzeichen zuruecksetzen; die Liste
    // stimmt beim naechsten Durchlauf von selbst.
    badge.textContent = '0'
    badge.classList.remove('aktiv')
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const wirdGeoeffnet = !dd.classList.contains('offen')
    dd.classList.toggle('offen')
    if (wirdGeoeffnet) markiereGesehen()
  })
  document.addEventListener('click', (e) => {
    if (!dd.contains(e.target) && e.target !== btn) dd.classList.remove('offen')
  })

  render()
  const intervall = setInterval(render, 20000)
  return { aktualisiere: render, stop: () => clearInterval(intervall) }
}
