// Einfache Zugangssperre, solange die Seite noch im Aufbau ist.
// HINWEIS: Das ist ein "Zutritt verboten"-Schild, KEINE echte Sicherheit –
// der Code wird an den Browser ausgeliefert. Zum Abschalten: diese Datei-
// Einbindung aus den HTML-Seiten entfernen (oder GATE_AKTIV = false setzen).

const GATE_AKTIV = true
const GATE_PASSWORT = 'schuelermatch2026'   // <- hier dein Passwort ändern
const GATE_KEY = 'sm-zugang-ok'

;(function () {
  if (!GATE_AKTIV) return
  try { if (sessionStorage.getItem(GATE_KEY) === '1') return } catch {}

  // Inhalt sofort verstecken, bevor etwas aufblitzt
  const style = document.createElement('style')
  style.textContent = 'body{visibility:hidden}#sm-gate{visibility:visible!important}'
  document.head.appendChild(style)

  function baueOverlay() {
    const gate = document.createElement('div')
    gate.id = 'sm-gate'
    gate.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#faf8f4;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,sans-serif;'
    gate.innerHTML = `
      <div style="background:#fff;border:1px solid #e7e3da;border-radius:24px;padding:40px;max-width:400px;width:100%;box-shadow:0 20px 50px rgba(22,26,31,0.1);text-align:center;">
        <div style="width:44px;height:44px;border-radius:12px;margin:0 auto 18px;background:linear-gradient(135deg,#00c896,#2b2f8f);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-family:'Space Grotesk',sans-serif;">SM</div>
        <h1 style="font-family:'Space Grotesk',sans-serif;font-size:1.4rem;margin:0 0 6px;color:#161a1f;">SchülerMatch</h1>
        <p style="color:#5a6270;font-size:0.9rem;margin:0 0 22px;">Diese Seite ist gerade im Aufbau. Bitte gib das Zugangspasswort ein.</p>
        <input id="sm-gate-pw" type="password" placeholder="Passwort" style="width:100%;padding:13px 15px;border:1.5px solid #e7e3da;border-radius:12px;font-size:1rem;outline:none;box-sizing:border-box;margin-bottom:12px;">
        <p id="sm-gate-err" style="color:#ff6b4a;font-size:0.82rem;min-height:18px;margin:0 0 10px;"></p>
        <button id="sm-gate-btn" style="width:100%;padding:13px;border:none;border-radius:12px;background:#00c896;color:#161a1f;font-weight:600;font-size:1rem;cursor:pointer;">Betreten</button>
      </div>`
    document.body.appendChild(gate)

    const input = gate.querySelector('#sm-gate-pw')
    const fehler = gate.querySelector('#sm-gate-err')
    const pruefen = () => {
      if (input.value === GATE_PASSWORT) {
        try { sessionStorage.setItem(GATE_KEY, '1') } catch {}
        gate.remove(); style.remove()
      } else {
        fehler.textContent = 'Falsches Passwort.'
        input.value = ''; input.focus()
      }
    }
    gate.querySelector('#sm-gate-btn').addEventListener('click', pruefen)
    input.addEventListener('keydown', e => { if (e.key === 'Enter') pruefen() })
    input.focus()
  }

  if (document.body) baueOverlay()
  else document.addEventListener('DOMContentLoaded', baueOverlay)
})()
