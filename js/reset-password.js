import { supabase } from './supabase.js'

const form = document.getElementById('reset-form')

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const password = document.getElementById('password').value
  const btn = form.querySelector('button[type=submit]')

  btn.disabled = true
  btn.textContent = 'Wird gespeichert...'

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    const msg = document.createElement('p')
    msg.setAttribute('role', 'alert')
    msg.className = 'auth-msg auth-msg--error'
    msg.textContent = error.message
    form.prepend(msg)
    btn.disabled = false
    btn.textContent = 'Passwort speichern'
    return
  }

  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  window.location.href = role === 'firma' ? 'dashboard-firma.html' : 'dashboard-schueler.html'
})
