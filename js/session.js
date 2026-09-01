import { supabase } from './supabase.js'
import { zeigeSeitenfehler, zeigeHinweisSeite } from './zustand.js'

// Prüft ob jemand eingeloggt ist und die richtige Rolle hat.
// Leitet sonst automatisch weiter.
//
// WICHTIG (gemessen am 23.8.): Bis dahin wurde ein fehlgeschlagener
// Profil-Abruf wie "falsche Rolle" behandelt. Bei einer Server-Störung
// war `profile` null, also stimmte die Rolle nie – und die Weiterleitung
// zeigte auf dieselbe Seite. Ergebnis: eine Endlosschleife, die sich
// immer wieder neu lud, bis der Server zurückkam. Eine Firma landete
// dabei zusätzlich im Schüler-Dashboard.
// Deshalb wird jetzt zwischen "konnte nicht laden" und "andere Rolle"
// unterschieden. Nur der zweite Fall leitet weiter.
// `optionen.hinweis` ist fuer Funktionsseiten gedacht (nicht fuer die
// Dashboards): Wer dort mit der falschen Rolle landet, wird nicht stumm
// weitergeschoben, sondern bekommt gesagt, warum die Seite nichts fuer ihn
// ist. Anlass (1.9.2026): Sanad klickte im Ratgeber auf "Wie bewerbe ich
// mich?", war als Firma angemeldet – und stand ohne Erklaerung im
// Formular zum Anzeigen-Aufgeben.
export async function requireAuth(expectedRole, optionen = {}) {
  let session = null
  try {
    ({ data: { session } } = await supabase.auth.getSession())
  } catch {
    // Kein Netz: nicht ausloggen, nur ehrlich sein.
    zeigeSeitenfehler({ titel: 'Keine Verbindung' })
    return null
  }

  if (!session) {
    window.location.href = 'login.html'
    return null
  }

  let profile = null
  let gestoert = false
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    profile = data
    // Ein fehlender Datensatz (PGRST116) ist etwas anderes als eine
    // Störung – nur echte Fehler zählen hier.
    if (error && error.code !== 'PGRST116') gestoert = true
  } catch {
    gestoert = true
  }

  if (gestoert) {
    zeigeSeitenfehler({ titel: 'Gerade nicht erreichbar' })
    return null
  }

  if (expectedRole && profile?.role !== expectedRole) {
    const ziel = profile?.role === 'firma' ? 'dashboard-firma.html' : 'dashboard-schueler.html'

    const hinweis = optionen.hinweis?.[profile?.role]
    if (hinweis) {
      zeigeHinweisSeite(hinweis)
      return null
    }
    // Niemals auf die Seite weiterleiten, auf der wir schon stehen –
    // das war der zweite Teil der Schleife.
    if (location.pathname.endsWith(ziel)) {
      zeigeSeitenfehler({
        titel: 'Konto unvollständig',
        text: 'Zu deinem Konto fehlen Angaben, deshalb können wir dein Dashboard nicht anzeigen. Melde dich neu an – wenn das nicht hilft, schreib uns.',
      })
      return null
    }
    window.location.href = ziel
    return null
  }

  return profile
}

export async function logout() {
  await supabase.auth.signOut()
  window.location.href = 'login.html'
}
