import { supabase } from './supabase.js'

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
  msg.textContent = error ? error.message : 'Falls diese E-Mail registriert ist, wurde ein Link zum Zurücksetzen gesendet.'
  form.prepend(msg)

  if (!error) {
    btn.textContent = 'Link gesendet'
  } else {
    btn.textContent = 'Link senden'
  }
})
