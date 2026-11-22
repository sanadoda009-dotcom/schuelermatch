// Fehler-Überwachung mit Sentry – zeigt dir Laufzeitfehler, die ECHTE Nutzer
// im Browser treffen (weiße Seite, abgestürzte Bewerbung, JS-Fehler).
//
// So aktivierst du es (2 Minuten):
//   1. Kostenloses Konto auf https://sentry.io anlegen
//   2. Neues Projekt -> Plattform "Browser / JavaScript" wählen
//   3. Den DSN kopieren (sieht so aus:
//        https://abc123...@o123456.ingest.de.sentry.io/7891011 )
//   4. Unten bei SENTRY_DSN zwischen die Anführungszeichen einfügen -> speichern -> pushen
//
// Solange SENTRY_DSN leer ist, passiert NICHTS (kein Laden, keine Netzwerk-Aufrufe).
//
// DATENSCHUTZ: Ist ein DSN gesetzt, werden Fehlerdaten an Sentry übertragen.
// Bewusst datensparsam konfiguriert (sendDefaultPii:false, kein Session-Replay,
// kein Performance-Tracing). Vor echtem Launch mit Minderjährigen: Sentry als
// Auftragsverarbeiter in die Datenschutzerklärung aufnehmen (EU-Region wählen!).

// Seit 23.11.2026 aktiv: Projekt schuelermatch-web, Daten im EU-Rechenzentrum
// (ingest.de). Ein DSN ist kein Geheimnis - er steht ohnehin im Browser.
const SENTRY_DSN = 'https://e531c8ca62a30692e98f72335097ef35@o4512477848403968.ingest.de.sentry.io/4512477937860688'

;(function () {
  if (!SENTRY_DSN) return
  // Nur auf der echten Seite. Lokal und in den Tests (localhost) bleibt
  // Sentry aus - sonst landeten Testfehler im echten Konto, und jeder
  // Testlauf haenge an einem fremden Server.
  if (!/^(www\.)?schuelermatch\.de$/.test(location.hostname)) return

  // Öffentlichen Schlüssel aus dem DSN ziehen -> versions-unabhängiger Loader.
  let publicKey
  try { publicKey = new URL(SENTRY_DSN).username } catch { return }
  if (!publicKey) return

  // Wird vom Sentry-Loader aufgerufen, sobald das SDK geladen ist.
  window.sentryOnLoad = function () {
    if (!window.Sentry) return
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: location.hostname === 'schuelermatch.de' ? 'production' : 'development',
      release: 'schuelermatch@2026-11',
      sendDefaultPii: false,     // keine personenbezogenen Daten von sich aus
      tracesSampleRate: 0,       // kein Performance-Tracing (weniger Daten)
      // Bekannte, harmlose Fehler nicht melden (Browser-Extensions, Netzwerk-Aussetzer)
      ignoreErrors: [
        'Non-Error promise rejection captured',
        'ResizeObserver loop limit exceeded',
        'Failed to fetch',
        'NetworkError when attempting to fetch resource',
      ],
      beforeSend(event) {
        // Sicherheitshalber: niemals das Zugangspasswort o.Ä. mitschicken
        try {
          const json = JSON.stringify(event)
          if (json.includes('schuelermatch2026')) return null
        } catch {}
        return event
      },
    })
  }

  const s = document.createElement('script')
  // EU-Lader (js-de): Das Projekt liegt im EU-Rechenzentrum.
  s.src = `https://js-de.sentry-cdn.com/${publicKey}.min.js`
  s.crossOrigin = 'anonymous'
  s.onerror = () => console.warn('[monitoring] Sentry-Loader konnte nicht geladen werden.')
  document.head.appendChild(s)
})()
