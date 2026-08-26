// Meldet einen Job-Alarm über den Token aus der E-Mail ab.
//
// Der Aufruf geht an die Datenbank-Funktion `job_alarm_abmelden`. Die
// läuft mit erhöhten Rechten (SECURITY DEFINER), weil hier niemand
// eingeloggt ist — sie kann aber ausschließlich abschalten und gibt
// nichts zurück. Ein Angreifer könnte also allenfalls Token raten und
// jemanden abmelden; auslesen lässt sich damit nichts.
import { supabase } from './supabase.js'

const titel = document.getElementById('zustand-titel')
const text = document.getElementById('zustand-text')
const kasten = document.getElementById('zustand')

function zeige(ueberschrift, satz, art) {
  titel.textContent = ueberschrift
  text.textContent = satz
  // legal-highlight ist grün getönt; bei einem Fehler wäre das die
  // falsche Botschaft.
  kasten.className = art === 'fehler' ? 'fehler-state' : 'legal-highlight'
}

const token = new URLSearchParams(location.search).get('token')

// Grobe Form prüfen, bevor überhaupt etwas geschickt wird.
const istToken = t => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t || '')

if (!istToken(token)) {
  zeige('Link unvollständig',
    'Dieser Link enthält keine gültige Kennung. Öffne ihn am besten direkt aus der E-Mail — '
    + 'manche Mailprogramme schneiden lange Adressen ab.', 'fehler')
} else {
  supabase.rpc('job_alarm_abmelden', { p_token: token })
    .then(({ error }) => {
      if (error) {
        console.error(error)
        zeige('Das hat gerade nicht geklappt',
          'Versuch es in ein paar Minuten noch einmal. Du kannst den Alarm auch in deinem '
          + 'Dashboard abschalten.', 'fehler')
        return
      }
      // Die Funktion meldet auch dann Erfolg, wenn der Token nicht
      // existiert - absichtlich: Sonst liesse sich durch Ausprobieren
      // herausfinden, welche Token echt sind.
      zeige('Erledigt', 'Du bekommst keine E-Mails mehr über neue Jobs.')
    })
}
