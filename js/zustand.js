// Fehler- und Leerzustände – gemeinsame Bausteine.
//
// Anlass (gemessen am 23.8.): Überall stand `if (error || !daten.length)`
// und zeigte dann "Aktuell keine Jobs". Damit bekommt jemand bei einer
// Server-Störung die Botschaft "es gibt hier nichts" – die schlimmste
// aller Antworten, weil sie glaubwürdig klingt und niemand wiederkommt.
// Fiel das Netz ganz aus, warf der Aufruf sogar eine Ausnahme und die
// grauen Platzhalter blieben für immer stehen.
//
// Deshalb: Störung und Leere sind zwei verschiedene Dinge und sehen
// verschieden aus. Eine Störung sagt, dass sie eine Störung ist, und
// bietet einen Weg nach vorn.

const WARN_ICON = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="24" cy="24" r="18"/><path d="M24 15v11" stroke-linecap="round"/><circle cx="24" cy="32.5" r="1.4" fill="currentColor" stroke="none"/></svg>'

// Ein fehlgeschlagener Abruf wird zu einem ehrlichen Zustand im Container.
// `erneut` ist die Funktion, die den Abruf noch einmal startet.
export function zeigeLadefehler(container, erneut, text) {
  if (!container) return
  container.innerHTML = `
    <div class="empty-state fehler-state">
      ${WARN_ICON}
      <p>${text || 'Die Daten konnten gerade nicht geladen werden.'}</p>
      <p class="fehler-hinweis">Das liegt meist an der Internetverbindung – die Anzeigen sind nicht weg.</p>
      <button type="button" class="btn btn-outline fehler-erneut">Nochmal versuchen</button>
    </div>`
  container.querySelector('.fehler-erneut')?.addEventListener('click', () => {
    if (typeof erneut === 'function') erneut()
    else location.reload()
  })
}

// Ganzseitige Variante: wenn nicht nur eine Liste fehlt, sondern die Seite
// ohne die Daten gar keinen Sinn ergibt (z.B. das eigene Profil).
export function zeigeSeitenfehler({ titel, text, erneut } = {}) {
  const ziel = document.querySelector('main') || document.body
  ziel.classList.remove('pruefe-zugang')
  ziel.innerHTML = `
    <div class="seiten-fehler">
      <div class="empty-state fehler-state">
        ${WARN_ICON}
        <h1>${titel || 'Gerade nicht erreichbar'}</h1>
        <p>${text || 'Wir konnten die Daten nicht laden. Das ist vorübergehend – dein Konto und alles Gespeicherte sind sicher.'}</p>
        <p class="fehler-hinweis">Prüf am besten kurz deine Internetverbindung.</p>
        <div class="fehler-knoepfe">
          <button type="button" class="btn btn-green fehler-erneut">Nochmal versuchen</button>
          <a class="btn btn-outline" href="index.html">Zur Startseite</a>
        </div>
      </div>
    </div>`
  ziel.querySelector('.fehler-erneut')?.addEventListener('click', () => {
    if (typeof erneut === 'function') erneut()
    else location.reload()
  })
}

// Kein Fehler, sondern eine Auskunft: "Diese Seite ist nichts fuer dich,
// und hier geht es weiter." Bewusst NICHT zeigeSeitenfehler – das bietet
// "Nochmal versuchen" an und rät, die Internetverbindung zu prüfen. Beides
// ist hier falsch: Es liegt keine Störung vor, und ein zweiter Versuch
// ändert nichts.
// Ein Knopf kann ein Ziel haben (`href`) ODER etwas tun (`aktion`) - fuer
// "Abmelden" gibt es keine Adresse, die das erledigt.
export function zeigeHinweisSeite({ titel, text, zusatz = '', knoepfe = [] }) {
  const ziel = document.querySelector('main') || document.body
  ziel.classList.remove('pruefe-zugang')
  ziel.innerHTML = `
    <div class="seiten-fehler">
      <div class="empty-state">
        <h1>${titel}</h1>
        <p>${text}</p>
        ${zusatz ? `<p class="hinweis-konto">${zusatz}</p>` : ''}
        <div class="fehler-knoepfe">
          ${knoepfe.map((k, i) => k.href
            ? `<a class="btn ${i === 0 ? 'btn-green' : 'btn-outline'}" href="${k.href}">${k.text}</a>`
            : `<button type="button" class="btn ${i === 0 ? 'btn-green' : 'btn-outline'}" data-hinweis-aktion="${i}">${k.text}</button>`
          ).join('')}
        </div>
      </div>
    </div>`
  knoepfe.forEach((k, i) => {
    if (typeof k.aktion === 'function') {
      ziel.querySelector(`[data-hinweis-aktion="${i}"]`)?.addEventListener('click', k.aktion)
    }
  })
}

// Klammert einen Supabase-Aufruf so ein, dass ein Netzausfall (der eine
// Ausnahme wirft) genauso ankommt wie ein Serverfehler (der `error`
// zurückgibt). Ohne das bleiben die grauen Platzhalter ewig stehen.
export async function hole(abfrage) {
  try {
    const { data, error } = await abfrage
    // PGRST116 heißt bei `.single()` nur "kein Treffer" – etwa eine
    // Job-Anzeige, die es nicht mehr gibt. Das ist ein normaler Zustand
    // und keine Störung; sonst bekäme jeder tote Link eine
    // "Verbindungsproblem"-Meldung statt "gibt es nicht mehr".
    if (error && error.code !== 'PGRST116') return { data: null, gestoert: true }
    return { data: data ?? null, gestoert: false }
  } catch {
    return { data: null, gestoert: true }
  }
}

// Macht aus einem technischen Fehler einen Satz, den auch ein 13-Jährigen
// versteht. Rohe Supabase-Meldungen sind englisch und nennen Tabellen- und
// Spaltennamen ("new row violates row-level security policy for table ...").
// Für den Admin-Bereich bleibt der technische Text bewusst stehen - dort
// hilft er beim Nachsehen, was los war.
export function verstaendlich(error, was = 'Das') {
  const roh = (error?.message || '').toLowerCase()
  if (!roh) return was + ' hat gerade nicht geklappt. Versuch es gleich nochmal.'
  if (roh.includes('failed to fetch') || roh.includes('network'))
    return 'Keine Verbindung. Prüf kurz dein Internet und versuch es nochmal.'
  if (roh.includes('row-level security') || roh.includes('permission') || roh.includes('denied'))
    return 'Dafür fehlt dir die Berechtigung. Melde dich neu an – wenn das nicht hilft, schreib uns.'
  if (roh.includes('duplicate') || roh.includes('unique'))
    return 'Das gibt es schon – doppelt geht hier nicht.'
  if (roh.includes('too large') || roh.includes('size'))
    return 'Die Datei ist zu groß. Nimm eine kleinere.'
  if (roh.includes('jwt') || roh.includes('expired') || roh.includes('session'))
    return 'Du warst zu lange weg. Bitte melde dich neu an.'

  // Tempolimit der Anmeldedienste. Kam bisher auf Englisch beim Nutzer an
  // ("For security purposes, you can only request this after 41 seconds"),
  // obwohl gerade dort jemand sitzt, der ohnehin nervös ist.
  // Die Sekundenzahl wird uebernommen, wenn sie dasteht - "gleich nochmal"
  // ohne Zahl laesst Leute im Sekundentakt weiterklicken.
  if (roh.includes('rate limit') || roh.includes('for security purposes') || roh.includes('too many')) {
    const sek = roh.match(/(\d+)\s*second/)
    return sek
      ? `Zu viele Versuche. Bitte warte ${sek[1]} Sekunden und probier es dann nochmal.`
      : 'Zu viele Versuche in kurzer Zeit. Bitte warte einen Moment und probier es dann nochmal.'
  }

  // Die Ablage nimmt nur Bilder und PDF. js/dokument-pfad.js faengt das
  // vorher ab - diese Meldung bleibt fuer den Fall, dass doch etwas
  // durchkommt.
  if (roh.includes('mime type') || roh.includes('not supported'))
    return 'Diese Dateiart geht hier nicht. Nimm ein Bild (JPG, PNG) oder ein PDF.'

  return was + ' hat gerade nicht geklappt. Versuch es gleich nochmal.'
}
