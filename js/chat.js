import { supabase } from './supabase.js'
import { toast } from './toast.js'
import { oeffneMeldeDialog, meldeButtonHtml } from './melden.js'

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

// --- Sicherheit im Chat -------------------------------------------------
// Der Chat ist die einzige Stelle, an der ein Schueler direkt mit einem
// Erwachsenen schreibt. Darum: dauerhaft sichtbare Grundregeln (aufklappbar)
// und ein freundlicher Hinweis, wenn eine empfangene Nachricht nach
// Kontaktdaten, Privattreffen oder Vorkasse aussieht.

function sicherheitsLeisteHtml() {
  return `
    <details class="chat-sicherheit">
      <summary>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3l8 3.5V12c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6.5L12 3z" stroke-linejoin="round"/>
        </svg>
        So chattest du sicher
      </summary>
      <ul>
        <li><b>Triff dich nie allein</b> mit jemandem, den du nur hier kennst. Nimm eine erwachsene Person mit.</li>
        <li><b>Sag deinen Eltern Bescheid</b>, wohin du gehst und wen du triffst.</li>
        <li><b>Keine privaten Daten</b> wie Adresse, Ausweis oder Bankdaten weitergeben.</li>
        <li><b>Du musst nie im Voraus zahlen.</b> Wer Geld von dir will, will dich abzocken.</li>
        <li>Schreib am besten <b>hier</b> weiter – dann koennen wir dir helfen, wenn etwas schieflaeuft.</li>
        <li>Etwas komisch? Nutze den <b>Melden</b>-Knopf an der Nachricht.</li>
      </ul>
    </details>`
}

// Sehr zurueckhaltende Muster - lieber einmal zu wenig warnen als staendig
// falschen Alarm ausloesen.
function warnungFuer(text) {
  const t = (text || '').toLowerCase()

  // Telefonnummer: Leerzeichen/Bindestriche zwischen Ziffern entfernen,
  // Punkte bewusst NICHT (sonst schlagen Datumsangaben wie 12.03.2026 an).
  const ziffern = t.replace(/[\s\-\/()]/g, '')
  if (/\d{7,}/.test(ziffern)) return 'kontakt'

  if (/\b(whatsapp|telegram|snapchat|instagram|insta|tiktok|discord|signal)\b/.test(t)) return 'kontakt'
  // Wortgrenzen in JS kennen nur ASCII und greifen vor ü/ä/ö nicht,
  // darum hier bewusst ohne. Die Begriffe sind eindeutig genug.
  if (/(vorkasse|anzahlung|kaution|gebühr|überweis|paypal|gutschein|amazon-?karte)/.test(t)) return 'geld'
  if (/(zu mir nach haus|bei mir zuhause|bei mir zu haus|meine wohnung|komm allein|ganz allein)/.test(t)) return 'treffen'
  return null
}

const WARN_TEXT = {
  kontakt: 'Sieht nach Kontaktdaten aus. Bleib lieber hier im Chat – hier bist du geschützt.',
  geld:    'Achtung: Du musst für einen Job <b>nie</b> im Voraus zahlen. Das ist ein Warnzeichen.',
  treffen: 'Triff dich nie allein mit jemandem, den du nur online kennst. Nimm jemanden mit und sag deinen Eltern Bescheid.'
}

function warnungHtml(art) {
  if (!art) return ''
  return `<div class="chat-warnung" role="note">⚠️ ${WARN_TEXT[art]}</div>`
}

// Rendert einen Chat-Verlauf in `container` für eine Bewerbung.
// meineId = eigene Profil-ID. Gibt eine Funktion zum Aufräumen zurück.
export async function ladeChat(container, bewerbungId, meineId) {
  container.innerHTML = `
    ${sicherheitsLeisteHtml()}
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
      ? data.map(m => {
          const fremd = m.absender_id !== meineId
          return `
          <div class="chat-msg ${fremd ? 'chat-msg--anderer' : 'chat-msg--ich'}">
            <p>${escapeHtml(m.text)}</p>
            <span class="chat-zeit">${formatZeit(m.erstellt_am)}</span>
            ${fremd ? meldeButtonHtml(`data-melde-nachricht="${m.id}"`) : ''}
          </div>
          ${fremd ? warnungHtml(warnungFuer(m.text)) : ''}`
        }).join('')
      : '<p class="cv-preview-empty" style="text-align:center;">Noch keine Nachrichten – schreib die erste!</p>'
    thread.scrollTop = thread.scrollHeight

    // Melden-Buttons verdrahten (nur an Nachrichten der Gegenseite)
    thread.querySelectorAll('[data-melde-nachricht]').forEach(b => {
      b.addEventListener('click', () => oeffneMeldeDialog({
        typ: 'nachricht',
        nachrichtId: b.dataset.meldeNachricht,
        titel: 'Nachricht im Chat melden',
        meineId
      }))
    })

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
    if (error) { toast('Nachricht konnte nicht gesendet werden.', 'fehler'); return }
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
