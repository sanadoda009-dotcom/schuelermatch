// Edge Function "konto-loeschen"
//
// Löscht das Konto des ANFRAGENDEN Schülers vollständig: Dateien,
// Profil (mit allem, was daran hängt) und das Anmeldekonto selbst.
//
// WARUM ES DAS BRAUCHT
// Bis zum 27.8.2026 konnte niemand sein Konto selbst löschen. Es gab nur
// `supabase/konto-loeschen.sql` — eine Anleitung für den Betreiber, von
// Hand, Schritt für Schritt. Ein Konto, das man nur per E-Mail-Bitte
// wieder loswird, ist kein Konto, das einem gehört.
//
// WARUM ALS EDGE FUNCTION UND NICHT IM BROWSER
// Drei der vier Schritte kann der Browser nicht:
//   * `auth.users` löschen braucht Admin-Rechte. Ohne diesen Schritt
//     könnte sich die Person weiter anmelden, und `handle_new_user`
//     legte beim nächsten Login ein neues, leeres Profil an — die
//     Löschung wäre halb zurückgenommen.
//   * Meldungen anonymisieren statt löschen (siehe unten).
//   * Die Dateien der anderen drei Ablagen aufräumen.
//
// SICHERHEIT — der wichtigste Teil dieser Datei
//
// 1. Die Nutzer-Id kommt AUSSCHLIESSLICH aus dem Anmelde-Token, NIE aus
//    der Anfrage. Es gibt bewusst keinen Parameter dafür. Sonst könnte
//    jeder das Konto eines anderen löschen — der denkbar schlimmste
//    Fehler an dieser Stelle.
//
// 2. `verify_jwt` der Plattform reicht dafür NICHT: Der öffentliche
//    anon-Schlüssel ist selbst ein gültiges JWT für dieses Projekt.
//    Deshalb wird hier ausdrücklich `auth.getUser(token)` aufgerufen —
//    das liefert nur bei einem echten Nutzer-Token ein Ergebnis.
//
// 3. Meldungen werden ANONYMISIERT, nicht gelöscht. Ein Schüler, der
//    Belästigung gemeldet hat und danach sein Konto löscht, soll den
//    Vorgang nicht mitnehmen. Der Fremdschlüssel steht seit dem 27.8.
//    auf SET NULL (supabase/meldungen-fk.sql) — hier wird zusätzlich
//    das Zitat entschärft, das Personenbezug enthalten kann.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Alle Ablagen, in denen ein Schüler Dateien liegen haben kann.
// Der erste Ordner ist immer die Nutzer-Id (siehe js/dokument-pfad.js).
const ABLAGEN = ['avatars', 'lebenslauf-bilder', 'verifizierung', 'zeugnisse']

function antwort(daten: unknown, status = 200): Response {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Löscht alles unterhalb von <uid>/ in einer Ablage.
// `list` liefert auch Unterordner (bei `zeugnisse` liegt je Bewerbung
// einer), deshalb wird eine Ebene tiefer nachgesehen.
async function raeumeAblage(admin: ReturnType<typeof createClient>, ablage: string, uid: string): Promise<number> {
  const pfade: string[] = []

  const { data: oben } = await admin.storage.from(ablage).list(uid, { limit: 1000 })
  for (const eintrag of oben ?? []) {
    // Eine Datei hat Metadaten, ein Ordner nicht.
    if (eintrag.id) {
      pfade.push(`${uid}/${eintrag.name}`)
    } else {
      const { data: drin } = await admin.storage.from(ablage).list(`${uid}/${eintrag.name}`, { limit: 1000 })
      for (const d of drin ?? []) pfade.push(`${uid}/${eintrag.name}/${d.name}`)
    }
  }

  if (!pfade.length) return 0
  const { error } = await admin.storage.from(ablage).remove(pfade)
  if (error) {
    console.error(`Ablage ${ablage}:`, error.message)
    return 0
  }
  return pfade.length
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return antwort({ fehler: 'nur POST' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return antwort({ fehler: 'nicht angemeldet' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // HIER kommt die Nutzer-Id her — und nur hier. Der anon-Schlüssel ist
  // zwar ein gültiges JWT, liefert hier aber keinen Nutzer.
  const { data: { user }, error: tokenFehler } = await admin.auth.getUser(token)
  if (tokenFehler || !user) return antwort({ fehler: 'nicht angemeldet' }, 401)

  const uid = user.id

  try {
    // 1. Meldungen anonymisieren, BEVOR das Profil fällt.
    await admin.from('meldungen').update({ melder_id: null }).eq('melder_id', uid)
    await admin.from('meldungen')
      .update({ gemeldet_user_id: null, zitat: '[Konto gelöscht]' })
      .eq('gemeldet_user_id', uid)

    // 2. Dateien. Vor dem Profil, denn danach weiss niemand mehr,
    //    welche Dateien zu wem gehörten.
    let dateien = 0
    for (const ablage of ABLAGEN) dateien += await raeumeAblage(admin, ablage, uid)

    // 3. Profil. Der Rest hängt mit ON DELETE CASCADE daran:
    //    bewerbungen, nachrichten, bewertungen, gemerkte_jobs,
    //    job_alarme und (bei Firmen) jobs samt deren Bewerbungen.
    const { error: profilFehler } = await admin.from('profiles').delete().eq('id', uid)
    if (profilFehler) throw profilFehler

    // 4. Anmeldekonto. Ohne diesen Schritt legte der nächste Login über
    //    `handle_new_user` ein neues Profil an.
    const { error: authFehler } = await admin.auth.admin.deleteUser(uid)
    if (authFehler) throw authFehler

    return antwort({ ok: true, dateien })
  } catch (e) {
    console.error('Löschen fehlgeschlagen:', e)
    // Bewusst ohne Details nach aussen: Die Meldung landet bei einem
    // Nutzer, der damit nichts anfangen kann.
    return antwort({ fehler: 'Das Löschen hat nicht geklappt.' }, 500)
  }
})
