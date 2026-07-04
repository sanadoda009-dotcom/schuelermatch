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
      .select('id, status, job:job_id(titel)').eq('schueler_id', profileId).in('status', ['angenommen', 'abgelehnt'])
    ;(bew || []).forEach(b => {
      const key = `${b.id}:${b.status}`
      const frisch = !gesehen.has(key)
      items.push({
        icon: b.status === 'angenommen' ? '🎉' : '📩',
        text: b.status === 'angenommen'
          ? `<b>Angenommen!</b> ${escapeHtml(b.job?.titel || 'Job')}`
          : `Bewerbung für ${escapeHtml(b.job?.titel || 'Job')}: <b>nicht geklappt</b>`,
        ziel: 'jobs', frisch
      })
    })
  } else {
    const gesehen = ladeGesehen('firma', profileId)
    const { data: bew } = await supabase.from('bewerbungen')
      .select('id, job:job_id(titel)')
    ;(bew || []).forEach(b => {
      const frisch = !gesehen.has(b.id)
      if (frisch) items.push({ icon: '🧑‍🎓', text: `<b>Neue Bewerbung</b> · ${escapeHtml(b.job?.titel || 'Job')}`, ziel: 'jobs', frisch })
    })
  }

  return items
}

export function initGlocke({ rolle, profileId, onNavigate }) {
  const btn = document.getElementById('glocke-btn')
  const badge = document.getElementById('glocke-badge')
  const dd = document.getElementById('glocke-dropdown')
  if (!btn) return () => {}

  async function render() {
    const items = await sammle(rolle, profileId)
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

  function markiereGesehen() {
    // Entscheidungen/Bewerbungen als gesehen merken, damit sie nicht erneut als "frisch" zählen
    sammle(rolle, profileId).then(async () => {
      if (rolle === 'schueler') {
        const g = ladeGesehen('schueler', profileId)
        const { data: bew } = await supabase.from('bewerbungen').select('id, status').eq('schueler_id', profileId).in('status', ['angenommen', 'abgelehnt'])
        ;(bew || []).forEach(b => g.add(`${b.id}:${b.status}`))
        speichereGesehen('schueler', profileId, g)
      } else {
        const g = ladeGesehen('firma', profileId)
        const { data: bew } = await supabase.from('bewerbungen').select('id')
        ;(bew || []).forEach(b => g.add(b.id))
        speichereGesehen('firma', profileId, g)
      }
      render()
    })
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
