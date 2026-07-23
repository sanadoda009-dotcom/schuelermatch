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

const SENTRY_DSN = '' // <- hier deinen Sentry-DSN einfügen, dann ist die Überwachung aktiv

;(function () {
  if (!SENTRY_DSN) return

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
      release: 'schuelermatch@2026-07',
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
  s.src = `https://js.sentry-cdn.com/${publicKey}.min.js`
  s.crossOrigin = 'anonymous'
  s.onerror = () => console.warn('[monitoring] Sentry-Loader konnte nicht geladen werden.')
  document.head.appendChild(s)
})()
