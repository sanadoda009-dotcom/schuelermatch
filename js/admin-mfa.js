// Zweiter Faktor fuer den Betreiber-Bereich (22.11.2026)
//
// WARUM
// Die Admin-Konten sind die maechtigsten der Seite: Sie geben Firmen frei,
// sehen Meldungen und - solange eine Pruefung laeuft - Ausweise von
// Minderjaehrigen. Den Supabase-Schutz gegen geleakte Passwoerter gibt es
// im kostenlosen Plan nicht. Ein gestohlenes Passwort allein soll deshalb
// nicht reichen.
//
// WO DER SCHUTZ WIRKLICH SITZT
// Nicht hier. `ist_admin()` in der Datenbank verlangt seit
// supabase/admin-zwei-faktor.sql eine Anmeldung mit zweitem Faktor
// (`aal2` im Anmelde-Token). Ohne ist ein Admin-Konto fuer die Datenbank
// ein ganz normales Konto. Diese Datei sorgt nur dafuer, dass der Admin
// den Code eingeben kann, statt vor leeren Listen zu sitzen.
//
// ABLAUF
//   Schon mit Code angemeldet (aal2)       -> weiter
//   Faktor eingerichtet, Code fehlt        -> 6-stelligen Code abfragen
//   Noch kein Faktor                       -> QR-Code zeigen, einrichten
//
// NOTFALL (Handy verloren): siehe OFFENE-PUNKTE.md, "Admin-Zwei-Faktor".

import { supabase } from './supabase.js'

const NAME = 'SchülerMatch Betreiber'

function el(html) {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild
}

// Liefert true, sobald die Sitzung den zweiten Faktor hat. Bis dahin
// verdeckt ein Kasten den Betreiber-Bereich.
export async function zweiterFaktor(main) {
  const { data: stufe, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) {
    zeigeFehler(main, 'Die Anmeldestufe ließ sich nicht prüfen: ' + error.message)
    return false
  }
  if (stufe.currentLevel === 'aal2') return true

  const kinder = [...main.children].filter(k => !k.classList.contains('sr-only'))
  kinder.forEach(k => { k.hidden = true })
  const kasten = el('<section class="mfa-box" id="mfa-box" aria-labelledby="mfa-titel"></section>')
  main.prepend(kasten)

  const fertig = await (stufe.nextLevel === 'aal2' ? codeAbfragen(kasten) : einrichten(kasten))
  if (!fertig) return false
  kasten.remove()
  kinder.forEach(k => { k.hidden = false })
  return true
}

function zeigeFehler(main, text) {
  main.innerHTML = ''
  const box = el('<div class="empty-state"><p></p></div>')
  box.querySelector('p').textContent = text
  main.append(box)
}

// Ein Formular fuer den 6-stelligen Code. Loest auf, wenn er stimmt.
function codeFormular(kasten, factorId) {
  return new Promise(resolve => {
    const form = el(`
      <form class="mfa-form" id="mfa-form" novalidate>
        <label for="mfa-code">6-stelliger Code aus der App</label>
        <input id="mfa-code" name="code" inputmode="numeric" autocomplete="one-time-code"
               maxlength="6" pattern="[0-9]{6}" required>
        <p class="mfa-fehler" id="mfa-fehler" role="alert" hidden></p>
        <button type="submit" class="btn btn-green btn-full">Bestätigen</button>
      </form>`)
    kasten.append(form)
    const feld = form.querySelector('#mfa-code')
    const fehler = form.querySelector('#mfa-fehler')
    const knopf = form.querySelector('button')
    feld.focus()

    form.addEventListener('submit', async e => {
      e.preventDefault()
      const code = feld.value.replace(/\s/g, '')
      if (!/^[0-9]{6}$/.test(code)) {
        fehler.textContent = 'Bitte die sechs Ziffern aus der App eingeben.'
        fehler.hidden = false
        return
      }
      knopf.disabled = true
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      knopf.disabled = false
      if (error) {
        fehler.textContent = 'Der Code stimmt nicht oder ist abgelaufen. Nimm den aktuellen aus der App. (' + error.message + ')'
        fehler.hidden = false
        feld.select()
        return
      }
      resolve(true)
    })
  })
}

async function codeAbfragen(kasten) {
  const { data, error } = await supabase.auth.mfa.listFactors()
  const faktor = data?.totp?.[0]
  if (error || !faktor) {
    kasten.innerHTML = '<p>Der zweite Faktor ließ sich nicht laden. Lade die Seite neu.</p>'
    return false
  }
  kasten.append(el(`
    <div>
      <h2 id="mfa-titel">Zweiter Schritt</h2>
      <p>Öffne deine Authenticator-App und gib den Code für <b>SchülerMatch</b> ein.</p>
    </div>`))
  return codeFormular(kasten, faktor.id)
}

async function einrichten(kasten) {
  // Halb eingerichtete Faktoren aus einem abgebrochenen Versuch stoeren:
  // Supabase lehnt einen zweiten mit demselben Namen ab.
  const { data: liste } = await supabase.auth.mfa.listFactors()
  for (const f of (liste?.all || []).filter(f => f.status !== 'verified')) {
    await supabase.auth.mfa.unenroll({ factorId: f.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: NAME, issuer: 'SchülerMatch' })
  if (error) {
    kasten.innerHTML = ''
    kasten.append(el('<p class="mfa-fehler"></p>'))
    kasten.querySelector('p').textContent = 'Einrichten ging nicht: ' + error.message
    return false
  }

  const teil = el(`
    <div>
      <h2 id="mfa-titel">Zwei-Faktor-Anmeldung einrichten</h2>
      <p>Der Betreiber-Bereich braucht ab jetzt neben dem Passwort einen Code vom Handy.
         So reicht ein gestohlenes Passwort allein nicht mehr.</p>
      <ol class="mfa-schritte">
        <li>Installiere eine Authenticator-App, zum Beispiel Google Authenticator oder Microsoft Authenticator.</li>
        <li>Tippe dort auf <b>+</b> und scanne diesen Code:</li>
      </ol>
      <img class="mfa-qr" id="mfa-qr" alt="QR-Code zum Einrichten der Authenticator-App" width="200" height="200">
      <details class="mfa-schluessel">
        <summary>Scannen geht nicht? Schlüssel von Hand eingeben</summary>
        <code id="mfa-geheimnis" class="mono"></code>
      </details>
      <ol class="mfa-schritte" start="3">
        <li>Gib den Code ein, den die App jetzt zeigt.</li>
      </ol>
    </div>`)
  teil.querySelector('#mfa-qr').src = data.totp.qr_code
  teil.querySelector('#mfa-geheimnis').textContent = data.totp.secret
  kasten.append(teil)
  return codeFormular(kasten, data.id)
}
