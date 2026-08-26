import { supabase } from './supabase.js'
import { toast } from './toast.js'
import { oeffneMeldeDialog, meldeButtonHtml } from './melden.js'
import { hole, verstaendlich } from './zustand.js'
import { warnungFuer, warnungHtml } from './chat-warnung.js'

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

// warnungFuer/warnungHtml liegen seit dem 26.8. in js/chat-warnung.js -
// dort sind sie pruefbar. Siehe tests/chat-warnung.spec.js.

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
    // Merken, ob der Nutzer gerade unten steht. Wer nach oben gescrollt hat,
    // um aeltere Nachrichten zu lesen, soll vom 8-Sekunden-Takt nicht
    // staendig wieder nach unten gerissen werden.
    const warUnten = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 60

    const { data, gestoert } = await hole(supabase.from('nachrichten')
      .select('*').eq('bewerbung_id', bewerbungId).order('erstellt_am', { ascending: true }))

    // Eine Stoerung darf nicht als "noch keine Nachrichten" erscheinen -
    // sonst sieht es aus, als waere der Verlauf geloescht worden.
    if (gestoert) {
      if (!thread.querySelector('.chat-msg')) {
        thread.innerHTML = '<p class="cv-preview-empty" style="text-align:center;">Die Nachrichten konnten gerade nicht geladen werden. Wir versuchen es weiter.</p>'
      }
      return
    }

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
    if (warUnten) thread.scrollTop = thread.scrollHeight

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

    // Das Feld wird erst geleert, wenn die Nachricht wirklich drin ist.
    // Vorher wurde sofort geleert - schlug das Senden fehl, war der
    // getippte Text weg und musste neu geschrieben werden.
    input.disabled = true
    let fehler = null
    try {
      const { error } = await supabase.from('nachrichten')
        .insert({ bewerbung_id: bewerbungId, absender_id: meineId, text })
      fehler = error
    } catch (e) {
      // Ohne diesen Fang blieb das Eingabefeld bei einem Netzausfall
      // fuer immer gesperrt - man konnte gar nichts mehr schreiben.
      fehler = e
    } finally {
      input.disabled = false
      input.focus()
    }

    if (fehler) {
      toast(verstaendlich(fehler, 'Die Nachricht'), 'fehler')
      return
    }

    input.value = ''
    await render()
  })

  await render()

  // Automatisch alle 8 Sek. aktualisieren (einfaches Polling, kein Live-Chat nötig).
  // Liegt der Tab im Hintergrund, wird nicht abgefragt - das sparte sonst
  // niemandem etwas und lief bei einem Netzausfall endlos ins Leere.
  const intervall = setInterval(() => {
    if (!document.hidden) render()
  }, 8000)
  // Kommt der Tab zurueck, sofort einmal nachladen statt bis zu 8 Sekunden
  // auf veraltete Nachrichten zu schauen.
  const beiRueckkehr = () => { if (!document.hidden) render() }
  document.addEventListener('visibilitychange', beiRueckkehr)

  return () => {
    clearInterval(intervall)
    document.removeEventListener('visibilitychange', beiRueckkehr)
  }
}

// Zählt ungelesene Nachrichten für einen Nutzer (für die Glocke/Badge).
export async function zaehleUngelesen(meineId) {
  const { count } = await supabase.from('nachrichten')
    .select('id', { count: 'exact', head: true })
    .neq('absender_id', meineId)
    .eq('gelesen', false)
  return count || 0
}
