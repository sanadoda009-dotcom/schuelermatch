import { supabase } from './supabase.js'

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form')
  const registerForm = document.getElementById('register-form')

  // Passwort anzeigen/verbergen
  document.querySelectorAll('input[type="password"]').forEach(input => {
    const wrap = document.createElement('div')
    wrap.className = 'pw-wrap'
    input.parentNode.insertBefore(wrap, input)
    wrap.appendChild(input)

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'pw-toggle'
    toggle.textContent = 'Anzeigen'
    toggle.setAttribute('aria-label', 'Passwort anzeigen')
    toggle.addEventListener('click', () => {
      const sichtbar = input.type === 'text'
      input.type = sichtbar ? 'password' : 'text'
      toggle.textContent = sichtbar ? 'Anzeigen' : 'Verbergen'
    })
    wrap.appendChild(toggle)
  })

  // Passwort-Staerke-Anzeige (nur Registrierung)
  const regPw = document.getElementById('reg-password')
  if (regPw) {
    const meter = document.createElement('div')
    meter.className = 'pw-meter'
    meter.innerHTML = '<div></div>'
    const label = document.createElement('span')
    label.className = 'pw-meter-label'
    regPw.closest('.form-group').append(meter, label)

    regPw.addEventListener('input', () => {
      const pw = regPw.value
      let punkte = 0
      if (pw.length >= 8) punkte++
      if (pw.length >= 12) punkte++
      if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) punkte++
      if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) punkte++

      const stufen = [
        { breite: '10%', farbe: '#ff6b4a', text: 'Zu kurz (min. 8 Zeichen)' },
        { breite: '35%', farbe: '#ff6b4a', text: 'Schwach' },
        { breite: '60%', farbe: '#f0b429', text: 'Okay' },
        { breite: '80%', farbe: '#00c896', text: 'Gut' },
        { breite: '100%', farbe: '#00a87d', text: 'Stark' }
      ]
      const s = stufen[pw.length < 8 ? 0 : punkte]
      meter.firstElementChild.style.width = pw ? s.breite : '0'
      meter.firstElementChild.style.background = s.farbe
      label.textContent = pw ? s.text : ''
      label.style.color = s.farbe
    })
  }

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

        const braucht16 = !alter || parseInt(alter) < 16
        if (braucht16 && !document.getElementById('eltern-einwilligung').checked) {
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
