// „Konto löschen" im Bereich Einstellungen.
//
// Bis zum 27.8.2026 konnte niemand sein Konto selbst löschen. Es gab nur
// `supabase/konto-loeschen.sql` — eine Anleitung für den Betreiber, von
// Hand. Ein Konto, das man nur per E-Mail-Bitte wieder loswird, ist kein
// Konto, das einem gehört.
//
// Die eigentliche Arbeit macht die Edge Function `konto-loeschen`: Sie
// braucht Admin-Rechte, um das Anmeldekonto zu entfernen, und sie leitet
// die Nutzer-Id ausschliesslich aus dem Anmelde-Token ab — nie aus einer
// Anfrage. Hier im Browser steht nur die Bedienung.
//
// ZWEI KLICKS REICHEN HIER NICHT.
// Überall sonst auf der Seite genügt eine Zwei-Klick-Bestätigung. Das ist
// für Dinge richtig, die man wiederholen kann. Hier nicht: Danach sind
// Lebenslauf, Bewerbungen und Chats weg, und niemand kann sie
// zurückholen. Deshalb muss ein Wort getippt werden.
import { supabase } from './supabase.js'
import { toast } from './toast.js'

const WORT = 'LÖSCHEN'

function el(id) { return document.getElementById(id) }

export function initKontoLoeschen() {
  const start = el('konto-loeschen-start')
  const box = el('konto-loeschen-bestaetigen')
  const feld = el('konto-loeschen-wort')
  const jetzt = el('konto-loeschen-jetzt')
  const abbruch = el('konto-loeschen-abbruch')
  if (!start || !box || !feld || !jetzt) return

  start.addEventListener('click', () => {
    box.hidden = false
    start.hidden = true
    feld.value = ''
    feld.focus()
  })

  abbruch?.addEventListener('click', () => {
    box.hidden = true
    start.hidden = false
    feld.value = ''
    start.focus()
  })

  jetzt.addEventListener('click', async () => {
    // Gross-/Kleinschreibung egal, aber das Wort muss stimmen. Wer sich
    // hierher verirrt hat, soll nicht durch einen Tippfehler sein Konto
    // verlieren — und wer es ernst meint, nicht an Zwischenräumen
    // scheitern.
    if (feld.value.trim().toUpperCase() !== WORT) {
      toast(`Tipp bitte genau „${WORT}" ins Feld.`, 'info')
      feld.focus()
      return
    }

    jetzt.disabled = true
    jetzt.textContent = 'Wird gelöscht…'

    try {
      // Kein Parameter: Die Funktion nimmt die Nutzer-Id aus dem Token.
      const { data, error } = await supabase.functions.invoke('konto-loeschen', { body: {} })
      if (error) throw error
      if (data?.fehler) throw new Error(data.fehler)

      // Abmelden, damit kein toter Anmeldestand zurückbleibt, und dann
      // von der Seite runter. `signOut` darf hier nicht scheitern
      // dürfen — das Konto ist ohnehin weg.
      try { await supabase.auth.signOut() } catch { /* egal */ }
      window.location.href = 'index.html?konto=geloescht'
    } catch (e) {
      console.error(e)
      toast('Das Löschen hat nicht geklappt. Versuch es später noch einmal – oder schreib uns.', 'fehler')
      jetzt.disabled = false
      jetzt.textContent = 'Konto endgültig löschen'
    }
  })
}
