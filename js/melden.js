// Melde-Funktion: Schüler können fragwürdige Jobs oder Chat-Nachrichten melden.
// Die Meldung landet im Admin-Bereich (Tabelle `meldungen`, RLS-geschützt).
//
// Benutzung:
//   import { oeffneMeldeDialog } from './melden.js'
//   oeffneMeldeDialog({ typ: 'job', jobId, titel: 'Eisverkäufer', meineId: profile.id })
//   oeffneMeldeDialog({ typ: 'nachricht', nachrichtId, titel: 'Nachricht im Chat', meineId })

import { supabase } from './supabase.js'
import { toast } from './toast.js'

const GRUENDE = [
  { wert: 'unangemessen',  label: 'Unangemessener Inhalt',        hinweis: 'Beleidigend, bedrohlich oder sexuell' },
  { wert: 'betrug',        label: 'Betrug oder Abzocke',          hinweis: 'Wirkt unseriös, will Geld oder Daten von dir' },
  { wert: 'kontaktdaten',  label: 'Will Kontakt außerhalb',       hinweis: 'Fragt nach Handynummer, WhatsApp oder privatem Treffen' },
  { wert: 'unrealistisch', label: 'Unrealistisches Angebot',      hinweis: 'Verspricht sehr viel Geld für sehr wenig Arbeit' },
  { wert: 'sonstiges',     label: 'Etwas anderes',                hinweis: 'Beschreib es uns kurz unten' }
]

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

// `zitat` ist das, worum es ging – der Anzeigentitel oder der Wortlaut der
// Nachricht. Es wird beim Melden MITGESPEICHERT, nicht nachtraeglich
// nachgeschlagen. Zwei Gruende:
//   1. Der Betreiber-Bereich behauptete im Kommentar, der gemeldete Inhalt
//      stecke als `zitat` in der Meldung – geschrieben hat ihn aber keine
//      einzige Stelle. Bei jeder Meldung stand deshalb "Inhalt nicht mehr
//      verfuegbar", auch wenn es die Anzeige noch gab.
//   2. Wer gemeldet wird, kann den Inhalt loeschen. Ohne Kopie steht der
//      Betreiber dann vor einer Meldung ohne Gegenstand.
export function oeffneMeldeDialog({ typ, jobId = null, nachrichtId = null, titel = '', zitat = '', meineId }) {
  document.getElementById('melde-overlay')?.remove()

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay open'
  overlay.id = 'melde-overlay'
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:520px;">
      <div class="modal-header">
        <h3>Melden</h3>
        <button type="button" class="modal-close" id="melde-close" aria-label="Schließen">✕</button>
      </div>
      ${titel ? `<p style="color:var(--ink-soft); font-size:0.88rem; margin:-6px 0 16px;">${escapeHtml(titel)}</p>` : ''}
      <p class="melde-intro">Danke, dass du aufpasst. Wir schauen uns jede Meldung an.
      Die gemeldete Person erfährt <b>nicht</b>, dass die Meldung von dir kommt –
      nur unser Team sieht das.</p>

      <form id="melde-form">
        <div class="form-group">
          <label>Was stimmt nicht?</label>
          ${GRUENDE.map((g, i) => `
            <label class="melde-grund">
              <input type="radio" name="melde-grund" value="${g.wert}"${i === 0 ? ' checked' : ''}>
              <span><b>${g.label}</b>${g.hinweis ? `<span class="melde-hinweis">${g.hinweis}</span>` : ''}</span>
            </label>`).join('')}
        </div>

        <div class="form-group">
          <label for="melde-text">Willst du noch etwas dazu sagen? <span style="font-weight:400; color:var(--ink-soft);">(freiwillig)</span></label>
          <textarea id="melde-text" maxlength="1000" placeholder="Was genau ist passiert?" style="min-height:90px;"></textarea>
        </div>

        <div class="melde-notfall">
          <b>Wichtig:</b> Wenn dir jemand droht oder du dich unsicher fühlst, sprich mit deinen
          Eltern oder einer erwachsenen Person, der du vertraust. In Gefahr: Polizei 110.
        </div>

        <button type="submit" class="btn btn-green btn-full" style="margin-top:16px;">Meldung absenden</button>
      </form>
    </div>`

  document.body.appendChild(overlay)

  const schliessen = () => overlay.remove()
  overlay.querySelector('#melde-close').addEventListener('click', schliessen)
  overlay.addEventListener('click', e => { if (e.target === overlay) schliessen() })

  overlay.querySelector('#melde-form').addEventListener('submit', async e => {
    e.preventDefault()
    const btn = e.target.querySelector('button[type=submit]')
    btn.disabled = true
    btn.textContent = 'Wird gesendet…'

    const grund = overlay.querySelector('input[name="melde-grund"]:checked')?.value || 'sonstiges'
    const beschreibung = overlay.querySelector('#melde-text').value.trim() || null

    const { error } = await supabase.from('meldungen').insert({
      melder_id: meineId,
      typ,
      job_id: typ === 'job' ? jobId : null,
      nachricht_id: typ === 'nachricht' ? nachrichtId : null,
      grund,
      beschreibung,
      // Kopie des gemeldeten Inhalts, gekuerzt. Sie ueberlebt, auch wenn
      // die Anzeige oder das Konto danach geloescht wird.
      zitat: zitat ? zitat.trim().slice(0, 500) : null
    })

    if (error) {
      // 23505 = eindeutiger Index -> diese Sache wurde von dir schon gemeldet
      if (error.code === '23505') {
        toast('Das hast du bereits gemeldet – wir kümmern uns darum.', 'info')
        schliessen()
        return
      }
      toast('Meldung konnte nicht gesendet werden. Versuch es später nochmal.', 'fehler')
      btn.disabled = false
      btn.textContent = 'Meldung absenden'
      return
    }

    schliessen()
    toast('Danke! Wir schauen uns das an. ✓')
  })

  overlay.querySelector('#melde-text').focus()
}

// Fertiger Melde-Button zum Einhängen (gleiches Aussehen überall).
export function meldeButtonHtml(attrs = '') {
  return `<button type="button" class="melde-btn" ${attrs}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>Melden</button>`
}

// ---------------------------------------------------------------------
// Melden von den ÖFFENTLICHEN Seiten aus (27.8.).
//
// Bis dahin gab es den Melden-Knopf nur im Chat und im Dashboard — also
// nirgends dort, wo eine Betrugsanzeige am ehesten gesehen wird. Wer auf
// der Jobbörse oder auf einer geteilten Anzeigenseite über etwas
// stolpert, konnte gar nichts tun.
//
// Diese Seiten kennen die Anmeldung nicht (sie laden `session.js` nicht,
// weil sie öffentlich sind). Deshalb wird sie hier nachgeschlagen —
// ohne Umleitung, denn `requireAuth` würde einen Besucher, der nur
// stöbert, auf die Anmeldeseite werfen.

export async function meldeMitAnmeldung({ typ, jobId = null, nachrichtId = null, titel = '', zitat = '' }) {
  let session = null
  try {
    ({ data: { session } } = await supabase.auth.getSession())
  } catch {
    // Kein Netz: ehrlich sein statt so tun, als sei man abgemeldet.
    toast('Keine Verbindung. Versuch es gleich nochmal.', 'fehler')
    return
  }

  if (!session) { zeigeAnmeldeHinweis(); return }

  oeffneMeldeDialog({ typ, jobId, nachrichtId, titel, meineId: session.user.id })
}

// Der Knopf bleibt für alle sichtbar — auch für Nicht-Angemeldete.
// Wer etwas Bedenkliches sieht, soll den Weg dorthin immer finden; ihn
// zu verstecken hiesse, die Meldung von der Anmeldung abhängig zu
// machen, ohne das je zu erklären.
//
// Bewusst KEINE automatische Umleitung: Sie würde jemanden aus der
// Anzeige werfen, die er gerade melden will.
function zeigeAnmeldeHinweis() {
  document.getElementById('melde-overlay')?.remove()

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay open'
  overlay.id = 'melde-overlay'
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:440px;">
      <div class="modal-header">
        <h3>Melden</h3>
        <button type="button" class="modal-close" id="melde-close" aria-label="Schließen">✕</button>
      </div>
      <p class="melde-intro">Zum Melden brauchst du ein Konto — sonst könnten
      wir nicht nachfragen, wenn wir etwas wissen müssen. Die gemeldete Person
      erfährt <b>nicht</b>, von wem die Meldung kommt.</p>
      <div class="melde-notfall">
        <b>Wichtig:</b> Wenn dir jemand droht oder du dich unsicher fühlst, sprich mit deinen
        Eltern oder einer erwachsenen Person, der du vertraust. In Gefahr: Polizei 110.
      </div>
      <a href="login.html" class="btn btn-green btn-full" style="margin-top:16px; text-decoration:none;">Anmelden</a>
      <a href="register.html?rolle=schueler" class="btn btn-outline btn-full" style="margin-top:8px; text-decoration:none;">Konto anlegen</a>
    </div>`

  document.body.appendChild(overlay)
  const schliessen = () => overlay.remove()
  overlay.querySelector('#melde-close').addEventListener('click', schliessen)
  overlay.addEventListener('click', e => { if (e.target === overlay) schliessen() })
}
