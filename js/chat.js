import { supabase } from './supabase.js'

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

function formatZeit(iso) {
  const d = new Date(iso)
  const heute = new Date()
  const gleicherTag = d.toDateString() === heute.toDateString()
  const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return gleicherTag ? uhr : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + uhr
}

// Rendert einen Chat-Verlauf in `container` für eine Bewerbung.
// meineId = eigene Profil-ID. Gibt eine Funktion zum Aufräumen zurück.
export async function ladeChat(container, bewerbungId, meineId) {
  container.innerHTML = `
    <div class="chat-thread" role="log" aria-live="polite"></div>
    <form class="chat-form">
      <input type="text" class="chat-input" placeholder="Nachricht schreiben..." maxlength="2000" autocomplete="off" aria-label="Nachricht">
      <button type="submit" class="btn btn-green" style="padding:10px 18px;">Senden</button>
    </form>
  `
  const thread = container.querySelector('.chat-thread')
  const form = container.querySelector('.chat-form')
  const input = container.querySelector('.chat-input')

  async function render() {
    const { data } = await supabase.from('nachrichten')
      .select('*').eq('bewerbung_id', bewerbungId).order('erstellt_am', { ascending: true })

    thread.innerHTML = (data && data.length)
      ? data.map(m => `
          <div class="chat-msg ${m.absender_id === meineId ? 'chat-msg--ich' : 'chat-msg--anderer'}">
            <p>${escapeHtml(m.text)}</p>
            <span class="chat-zeit">${formatZeit(m.erstellt_am)}</span>
          </div>`).join('')
      : '<p class="cv-preview-empty" style="text-align:center;">Noch keine Nachrichten – schreib die erste!</p>'
    thread.scrollTop = thread.scrollHeight

    // Fremde ungelesene Nachrichten als gelesen markieren
    const ungelesen = (data || []).filter(m => m.absender_id !== meineId && !m.gelesen).map(m => m.id)
    if (ungelesen.length) await supabase.from('nachrichten').update({ gelesen: true }).in('id', ungelesen)
  }

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    input.disabled = true
    const { error } = await supabase.from('nachrichten').insert({ bewerbung_id: bewerbungId, absender_id: meineId, text })
    input.disabled = false
    input.focus()
    if (error) { alert('Nachricht konnte nicht gesendet werden.'); return }
    await render()
  })

  await render()

  // Automatisch alle 8 Sek. aktualisieren (einfaches Polling, kein Live-Chat nötig)
  const intervall = setInterval(render, 8000)
  return () => clearInterval(intervall)
}

// Zählt ungelesene Nachrichten für einen Nutzer (für die Glocke/Badge).
export async function zaehleUngelesen(meineId) {
  const { count } = await supabase.from('nachrichten')
    .select('id', { count: 'exact', head: true })
    .neq('absender_id', meineId)
    .eq('gelesen', false)
  return count || 0
}
