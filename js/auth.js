import { supabase } from './supabase.js'

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form')
  const registerForm = document.getElementById('register-form')

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = document.getElementById('email').value
      const password = document.getElementById('password').value
      const btn = loginForm.querySelector('button[type=submit]')

      btn.textContent = 'Einloggen...'
      btn.disabled = true

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        showError(loginForm, 'Falsche E-Mail oder Passwort.')
        btn.textContent = 'Einloggen'
        btn.disabled = false
        return
      }

      // Weiterleitung je nach Rolle
      const role = data.user.user_metadata?.role
      window.location.href = role === 'firma' ? 'dashboard-firma.html' : 'dashboard-schueler.html'
    })
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = document.getElementById('reg-email').value
      const password = document.getElementById('reg-password').value
      const name = document.getElementById('name').value
      const role = registerForm.dataset.role || 'schueler'
      const btn = registerForm.querySelector('button[type=submit]')

      btn.textContent = 'Wird erstellt...'
      btn.disabled = true

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role }
        }
      })

      if (error) {
        showError(registerForm, error.message)
        btn.textContent = 'Account erstellen'
        btn.disabled = false
        return
      }

      showSuccess(registerForm, 'Fast fertig! Bitte bestätige deine E-Mail-Adresse.')
    })
  }
})

function showError(form, msg) {
  removeMsg(form)
  const el = document.createElement('p')
  el.className = 'auth-msg auth-msg--error'
  el.textContent = msg
  form.prepend(el)
}

function showSuccess(form, msg) {
  removeMsg(form)
  const el = document.createElement('p')
  el.className = 'auth-msg auth-msg--success'
  el.textContent = msg
  form.prepend(el)
}

function removeMsg(form) {
  form.querySelector('.auth-msg')?.remove()
}
