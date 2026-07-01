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
      const role = registerForm.dataset.role || 'schueler'
      const btn = registerForm.querySelector('button[type=submit]')

      let name, alter, ort

      if (role === 'firma') {
        name = document.getElementById('firma-name').value
        ort = document.getElementById('firma-ort').value
      } else {
        name = document.getElementById('name').value
        alter = document.getElementById('alter').value
        ort = document.getElementById('ort').value

        if (!document.getElementById('eltern-einwilligung').checked) {
          showError(registerForm, 'Bitte bestätige die Einwilligung deiner Eltern.')
          return
        }
      }

      btn.textContent = 'Wird erstellt...'
      btn.disabled = true

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role, alter_jahre: alter ? parseInt(alter) : null, ort }
        }
      })

      if (signUpError) {
        showError(registerForm, signUpError.message)
        btn.textContent = 'Account erstellen'
        btn.disabled = false
        return
      }

      // Direkt einloggen nach Registrierung
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })

      if (loginError) {
        showError(registerForm, 'Account erstellt! Bitte logge dich jetzt ein.')
        btn.textContent = 'Account erstellen'
        btn.disabled = false
        return
      }

      window.location.href = role === 'firma' ? 'dashboard-firma.html' : 'dashboard-schueler.html'
    })
  }
})

function showError(form, msg) {
  removeMsg(form)
  const el = document.createElement('p')
  el.className = 'auth-msg auth-msg--error'
  el.setAttribute('role', 'alert')
  el.textContent = msg
  form.prepend(el)
}

function showSuccess(form, msg) {
  removeMsg(form)
  const el = document.createElement('p')
  el.className = 'auth-msg auth-msg--success'
  el.setAttribute('role', 'status')
  el.textContent = msg
  form.prepend(el)
}

function removeMsg(form) {
  form.querySelector('.auth-msg')?.remove()
}
