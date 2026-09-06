// Neues Passwort festlegen (Seite hinter dem Link aus der E-Mail).
//
// DER BEFUND (4.9.2026): Auf diese Seite kommt man nur ueber einen Link
// aus einer E-Mail. Der gilt kurz und genau einmal. Wer sie OHNE gueltigen
// Link aufrief - abgelaufener Link, alte Mail, Lesezeichen, Zurueck-Taste -
// bekam trotzdem das Formular, tippte ein Passwort ein und las danach:
//
//   "Das hat gerade nicht geklappt. Versuch es in einem Moment nochmal."
//
// Ein Versprechen, das nie eintritt. Warten hilft hier nie; es fehlt der
// Link. Gemessen: genau dieser Satz, in einer Endlosschleife. Wer sein
// Passwort vergessen hat, kommt so nie wieder in sein Konto.
//
// Jetzt wird beim Laden geprueft, ob ueberhaupt ein Link da ist - und
// wenn nicht, steht das da, mit dem Weg zum neuen Link.

import { supabase } from './supabase.js'

const form = document.getElementById('reset-form')

// Statt Formular: sagen, was los ist, und den Weg zeigen.
function zeigeLinkKaputt(grund) {
  const box = form.closest('.auth-box') || form.parentElement
  box.innerHTML = `
    <h1>Dieser Link funktioniert nicht mehr</h1>
    <p class="sub">${grund}</p>
    <a class="btn btn-green btn-full" href="forgot-password.html">Neuen Link anfordern</a>
    <p class="auth-switch">Passwort doch noch im Kopf? <a href="login.html">Zum Login</a></p>`
}

// Ist ueberhaupt ein Link im Spiel?
//
// Supabase legt den Wiederherstellungs-Zugang je nach Ablauf in den
// Adress-Anhang (#access_token=…&type=recovery) oder als ?code=… ab - und
// bei einem ABGELAUFENEN Link stattdessen #error=…&error_code=otp_expired.
// Der Fehlerfall wurde bisher gar nicht gelesen.
//
// Wer angemeldet ist, darf sein Passwort hier trotzdem aendern; deshalb
// zaehlt eine bestehende Sitzung genauso.
async function pruefeLink() {
  const anhang = new URLSearchParams(location.hash.replace(/^#/, ''))
  const suche = new URLSearchParams(location.search)
  const aus = (schluessel) => anhang.get(schluessel) || suche.get(schluessel)

  if (aus('error') || aus('error_description')) {
    const code = aus('error_code') || ''
    zeigeLinkKaputt(code.includes('expired')
      ? 'Der Link ist abgelaufen. Sie gelten nur kurze Zeit.'
      : 'Der Link wurde schon benutzt oder ist nicht mehr gültig.')
    return
  }

  if (aus('access_token') || aus('code') || aus('token_hash') || aus('type') === 'recovery') return

  const { data } = await supabase.auth.getSession().catch(() => ({ data: null }))
  if (!data?.session) {
    zeigeLinkKaputt('Ein Link zum Zurücksetzen gilt nur kurze Zeit und nur '
      + 'einmal. Fordere dir einen neuen an — das dauert einen Moment.')
  }
}

pruefeLink()

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const password = document.getElementById('password').value
  const btn = form.querySelector('button[type=submit]')

  function zeigeFehler(text) {
    form.querySelector('.auth-msg--error')?.remove()
    const msg = document.createElement('p')
    msg.setAttribute('role', 'alert')
    msg.className = 'auth-msg auth-msg--error'
    msg.textContent = text
    form.prepend(msg)
    btn.disabled = false
    btn.textContent = 'Passwort speichern'
  }

  // Vorher prüfen statt den Server ablehnen zu lassen: sonst kam die
  // englische Supabase-Meldung zurück, die hier niemand versteht.
  if (password.length < 10) {
    zeigeFehler('Dein neues Passwort braucht mindestens 10 Zeichen.')
    document.getElementById('password').focus()
    return
  }

  btn.disabled = true
  btn.textContent = 'Wird gespeichert...'

  let error = null
  try {
    ({ error } = await supabase.auth.updateUser({ password }))
  } catch {
    zeigeFehler('Keine Verbindung. Prüf kurz dein Internet und versuch es nochmal.')
    return
  }

  if (error) {
    // Rohen englischen Text nie durchreichen - stattdessen die zwei
    // Fälle übersetzen, die hier realistisch vorkommen.
    const roh = (error.message || '').toLowerCase()
    if (roh.includes('at least') || roh.includes('short') || roh.includes('weak')) {
      zeigeFehler('Das Passwort ist zu kurz oder zu einfach. Nimm mindestens 10 Zeichen.')
    } else if (roh.includes('expired') || roh.includes('invalid') || roh.includes('token')) {
      zeigeFehler('Der Link ist abgelaufen. Fordere auf "Passwort vergessen" einen neuen an.')
    } else if (roh.includes('session') || roh.includes('not authenticated')
               || roh.includes('logged in')) {
      // "Auth session missing!" - hier fehlt der Link, nicht die Geduld.
      // Das lief vorher in den Zweig darunter und riet zum Abwarten.
      zeigeLinkKaputt('Ein Link zum Zurücksetzen gilt nur kurze Zeit und nur '
        + 'einmal. Fordere dir einen neuen an — das dauert einen Moment.')
    } else {
      zeigeFehler('Das hat gerade nicht geklappt. Versuch es in einem Moment nochmal.')
    }
    return
  }

  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  window.location.href = role === 'firma' ? 'dashboard-firma.html' : 'dashboard-schueler.html'
})
