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

      // farbe = Balken (Grafik, darf kraeftig sein).
      // schrift = Beschriftung daneben. Am 26.8. gemessen: mit der
      // Balkenfarbe kam "Okay" auf 1,86:1 und "Gut" auf 2,16:1 - noetig
      // sind 4,5:1. Dieselben Farben, nur so weit abgedunkelt, dass man
      // sie auf Weiss lesen kann.
      const stufen = [
        { breite: '10%', farbe: '#ff6b4a', schrift: '#a5442c', text: 'Zu kurz (min. 8 Zeichen)' },
        { breite: '35%', farbe: '#ff6b4a', schrift: '#a5442c', text: 'Schwach' },
        { breite: '60%', farbe: '#f0b429', schrift: '#8a6100', text: 'Okay' },
        { breite: '80%', farbe: '#00c896', schrift: '#00795c', text: 'Gut' },
        { breite: '100%', farbe: '#00a87d', schrift: '#046a52', text: 'Stark' }
      ]
      const s = stufen[pw.length < 10 ? 0 : punkte]
      meter.firstElementChild.style.width = pw ? s.breite : '0'
      meter.firstElementChild.style.background = s.farbe
      label.textContent = pw ? s.text : ''
      label.style.color = s.schrift
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
        // Unbestätigte E-Mail klar vom falschen Passwort unterscheiden
        if ((error.message || '').toLowerCase().includes('not confirmed')) {
          showError(loginForm, 'Bitte bestätige zuerst deine E-Mail-Adresse – wir haben dir einen Link geschickt (auch im Spam-Ordner nachsehen).')
          // Auch hier muss man die Mail neu anfordern koennen - sonst ist
          // der Login eine Sackgasse, solange die Mail fehlt.
          zeigeErneutSendenBeimLogin(loginForm, email)
        } else {
          showError(loginForm, 'Falsche E-Mail oder Passwort.')
        }
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

      // Freundliche Inline-Validierung
      feldFehlerWeg(registerForm)
      let fehler = false
      const emailFeld = document.getElementById('reg-email')
      const pwFeld = document.getElementById('reg-password')
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { feldFehler(emailFeld, 'Bitte gib eine gültige E-Mail ein.'); fehler = true }
      // 10, nicht 8: Supabase lehnt kuerzere Passwoerter ab. Stand hier frueher 8,
      // kam man durch die Formularpruefung und bekam dann nur die generische
      // Meldung "Bitte pruefe deine Eingaben" - ohne je den Grund zu erfahren.
      if (password.length < 10) { feldFehler(pwFeld, 'Mindestens 10 Zeichen.'); fehler = true }

      if (role === 'firma') {
        name = document.getElementById('firma-name').value
        ort = document.getElementById('firma-ort').value
        if (!name.trim()) { feldFehler(document.getElementById('firma-name'), 'Bitte gib den Firmennamen ein.'); fehler = true }
      } else {
        name = document.getElementById('name').value
        alter = document.getElementById('alter').value
        ort = document.getElementById('ort').value
        if (!name.trim()) { feldFehler(document.getElementById('name'), 'Bitte gib deinen Vornamen ein.'); fehler = true }
        if (!alter) { feldFehler(document.getElementById('alter'), 'Bitte wähle dein Alter.'); fehler = true }

        const braucht16 = !alter || parseInt(alter) < 16
        if (braucht16 && !document.getElementById('eltern-einwilligung').checked) {
          feldFehler(document.getElementById('eltern-einwilligung'), 'Bitte bestätige die Einwilligung deiner Eltern.'); fehler = true
        }
      }

      if (fehler) {
        registerForm.querySelector('.invalid')?.focus()
        return
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
        // Generische Meldung statt roher Supabase-Fehlertext -> keine
        // Rueckschluesse, ob eine E-Mail bereits registriert ist (User-Enumeration).
        showError(registerForm, 'Registrierung momentan nicht möglich. Bitte prüfe deine Eingaben und versuche es später erneut. Falls du schon ein Konto hast, melde dich einfach an.')
        console.warn('SignUp-Fehler:', signUpError.status)
        btn.textContent = 'Account erstellen'
        btn.disabled = false
        return
      }

      // Mit E-Mail-Bestätigung gibt es nach dem SignUp noch KEINE Session.
      // Dann zeigen wir die "Fast geschafft"-Ansicht statt eines Auto-Logins.
      if (!signUpData.session) {
        registerForm.innerHTML = `
          <div class="auth-bestaetigen">
            <div class="auth-bestaetigen-icon">📬</div>
            <h2>Fast geschafft!</h2>
            <p>Wir haben dir eine E-Mail an <b>${escapeHtmlAuth(email)}</b> geschickt.</p>
            <p>Klick auf den Link darin, um dein Konto zu bestätigen – danach kannst du dich einloggen.</p>
            <p class="auth-bestaetigen-hinweis">Keine Mail? Schau zuerst im Spam-Ordner nach.</p>
            <button type="button" class="btn btn-outline btn-full" id="mail-erneut" style="margin-top:10px;">E-Mail erneut senden</button>
            <p class="auth-bestaetigen-hinweis" id="erneut-status" role="status"></p>
            <a href="login.html" class="btn btn-green btn-full" style="margin-top:6px;">Zum Login</a>
          </div>`
        // Ohne diesen Knopf steckte jemand fest, dessen Mail nicht ankam:
        // Es gab keinen Weg, sie noch einmal anzufordern.
        verdrahteErneutSenden(registerForm, email)
        return
      }

      // Bestätigung aus (z.B. lokal): Session da -> direkt weiter
      window.location.href = role === 'firma' ? 'dashboard-firma.html' : 'dashboard-schueler.html'
    })
  }
})

// Fordert die Bestaetigungsmail neu an. Supabase begrenzt das zeitlich;
// deshalb wird der Knopf nach einem Versuch kurz gesperrt und ein
// Fehlschlag ehrlich benannt statt still geschluckt.
async function sendeBestaetigungNeu(email, statusEl, btn) {
  if (!email) return
  btn.disabled = true
  const alterText = btn.textContent
  btn.textContent = 'Wird gesendet…'
  statusEl.textContent = ''

  let fehler = null
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    fehler = error
  } catch (e) {
    fehler = e
  }

  btn.textContent = alterText

  if (fehler) {
    const roh = (fehler.message || '').toLowerCase()
    statusEl.textContent = roh.includes('rate') || roh.includes('seconds') || roh.includes('limit')
      ? 'Gerade eben schon versucht. Warte kurz und probier es dann noch einmal.'
      : 'Das hat nicht geklappt. Prüf deine Internetverbindung und versuch es gleich nochmal.'
    // Nach einem Fehlversuch wieder freigeben, damit man es erneut kann.
    setTimeout(() => { btn.disabled = false }, 3000)
    return
  }

  statusEl.textContent = 'Neue E-Mail ist unterwegs. Schau auch im Spam-Ordner nach.'
  // Kurze Sperre gegen mehrfaches Antippen.
  setTimeout(() => { btn.disabled = false }, 30000)
}

function verdrahteErneutSenden(container, email) {
  const btn = container.querySelector('#mail-erneut')
  const statusEl = container.querySelector('#erneut-status')
  if (!btn || !statusEl) return
  btn.addEventListener('click', () => sendeBestaetigungNeu(email, statusEl, btn))
}

// Beim Login gibt es die Ansicht nicht - dort wird der Knopf unter die
// Fehlermeldung gehaengt.
function zeigeErneutSendenBeimLogin(form, email) {
  if (form.querySelector('#mail-erneut')) return
  const box = document.createElement('div')
  box.innerHTML = `
    <button type="button" class="btn btn-outline btn-full" id="mail-erneut" style="margin-top:10px;">Bestätigungs-E-Mail erneut senden</button>
    <p class="auth-bestaetigen-hinweis" id="erneut-status" role="status"></p>`
  const meldung = form.querySelector('.auth-msg--error')
  if (meldung) meldung.after(box)
  else form.prepend(box)
  verdrahteErneutSenden(form, email)
}

function escapeHtmlAuth(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

// Freundliche Inline-Feldfehler (rot umrandet + Text darunter)
function feldFehler(input, msg) {
  if (!input) return
  input.classList.add('invalid')
  const gruppe = input.closest('.form-group') || input.parentElement
  gruppe.querySelector('.field-error')?.remove()
  const hinweis = document.createElement('p')
  hinweis.className = 'field-error'
  hinweis.setAttribute('role', 'alert')
  hinweis.textContent = msg
  gruppe.appendChild(hinweis)
  input.addEventListener('input', () => {
    input.classList.remove('invalid')
    gruppe.querySelector('.field-error')?.remove()
  }, { once: true })
}

function feldFehlerWeg(form) {
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'))
  form.querySelectorAll('.field-error').forEach(el => el.remove())
}

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
