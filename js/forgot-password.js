import { supabase } from './supabase.js'
import { verstaendlich } from './zustand.js'

const form = document.getElementById('forgot-form')

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('email').value
  const btn = form.querySelector('button[type=submit]')

  btn.disabled = true
  btn.textContent = 'Wird gesendet...'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html'
  })

  btn.disabled = false

  const msg = document.createElement('p')
  msg.setAttribute('role', error ? 'alert' : 'status')
  msg.className = `auth-msg ${error ? 'auth-msg--error' : 'auth-msg--success'}`
  // Kein roher Fehlertext mehr. Zwei Gruende:
  //   1. Er kam auf Englisch beim Nutzer an - haeufigster Fall ist das
  //      Tempolimit ("For security purposes, you can only request this
  //      after 41 seconds").
  //   2. Die Erfolgsmeldung sagt bewusst „FALLS diese E-Mail registriert
  //      ist", damit sich nicht ablesen laesst, wer ein Konto hat. Der
  //      Fehlerzweig kippte diesen Schutz wieder um.
  msg.textContent = error
    ? verstaendlich(error, 'Der Link')
    : 'Falls diese E-Mail registriert ist, wurde ein Link zum Zurücksetzen gesendet.'
  form.prepend(msg)

  if (!error) {
    btn.textContent = 'Link gesendet'
  } else {
    btn.textContent = 'Link senden'
  }
})
