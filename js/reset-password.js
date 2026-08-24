import { supabase } from './supabase.js'

const form = document.getElementById('reset-form')

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
    } else {
      zeigeFehler('Das hat gerade nicht geklappt. Versuch es in einem Moment nochmal.')
    }
    return
  }

  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  window.location.href = role === 'firma' ? 'dashboard-firma.html' : 'dashboard-schueler.html'
})
