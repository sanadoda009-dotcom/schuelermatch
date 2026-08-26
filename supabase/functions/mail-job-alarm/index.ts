// Edge Function "mail-job-alarm"
// Läuft einmal täglich (per Zeitplan) und schickt jedem Schüler mit
// aktivem Job-Alarm EINE Sammel-Mail über die passenden Anzeigen, die
// seit der letzten Mail dazugekommen sind.
//
// Zeitplan einrichten: Supabase -> Edge Functions -> mail-job-alarm -> Schedule
//   (z.B. Cron "0 16 * * *" = täglich 16:00 UTC, also nach Schulschluss)
//
// Secrets wie bei mail-ereignis (RESEND_API_KEY, MAIL_ABSENDER, SITE_URL).
//
// SICHERHEIT
// 1. Alle Werte, die aus der Datenbank kommen, werden HTML-escaped.
//    Job-Titel und Firmennamen schreiben ARBEITGEBER — hier gehen sie
//    an SCHÜLER. Ohne Escaping wäre das eine Einladung, Links oder
//    Schadinhalte in fremde Postfächer zu schreiben. (Die Schwester-
//    Funktion mail-digest schickt nur an die Firma selbst zurück, was
//    sie selbst geschrieben hat; dort war die Lücke harmlos, ist aber
//    am 26.8. trotzdem geschlossen worden.)
// 2. Die Funktion ist über eine öffentliche Adresse erreichbar. Sie
//    nimmt aber KEINE Eingaben entgegen und arbeitet nur mit dem, was
//    in der Datenbank steht. Wiederholte Aufrufe sind harmlos: Nach dem
//    Versand wird `zuletzt_gesendet` fortgeschrieben, der zweite Aufruf
//    findet also nichts mehr. Damit lässt sich niemand zuspammen.
// 3. Verschickt werden nur Jobs, die auch öffentlich sichtbar sind
//    (aktiv + Firma freigegeben) und für die der Schüler alt genug ist.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Die Trefferlogik liegt in einem eigenen Modul, damit sie geprueft
// werden kann - sie entscheidet, wer welche Anzeige zugeschickt
// bekommt, Altersgrenze inklusive. Siehe tests/job-alarm-treffer.spec.js.
import { passtZumAlarm } from './treffer.js'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const ABSENDER = Deno.env.get('MAIL_ABSENDER') ?? 'SchülerMatch <onboarding@resend.dev>'
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://schuelermatch.de'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Höchstens so viele Jobs pro Mail auflisten. Mehr liest ohnehin niemand.
const MAX_JOBS = 8

function esc(s: unknown): string {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function rahmen(inhalt: string, abmeldeLink: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#161a1f">
    <div style="height:4px;background:linear-gradient(120deg,#00795c,#2b2f8f);border-radius:4px"></div>
    <div style="padding:24px 4px">${inhalt}</div>
    <p style="font-size:12px;color:#5a6270;border-top:1px solid #e7e3da;padding-top:14px">
      Du bekommst diese E-Mail, weil du bei SchülerMatch einen Job-Alarm eingerichtet hast.
      <a href="${abmeldeLink}" style="color:#00795c">Job-Alarm abbestellen</a>
      &middot; Einstellungen änderst du in deinem Dashboard.
    </p>
  </div>`
}

async function sendeMail(an: string, betreff: string, inhalt: string, abmeldeLink: string): Promise<boolean> {
  if (!an) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: ABSENDER,
      to: an,
      subject: betreff,
      html: rahmen(inhalt, abmeldeLink),
      // Ein-Klick-Abmeldung direkt im Mailprogramm. Ohne das landen
      // Rundmails schneller im Spam-Ordner.
      headers: { 'List-Unsubscribe': `<${abmeldeLink}>` },
    }),
  })
  if (!res.ok) console.error('Resend-Fehler:', res.status, await res.text())
  return res.ok
}

type Job = {
  id: string; titel: string; ort: string | null; kategorie: string | null
  arbeitszeit: string | null; stundenlohn: number | null; mindestalter: number | null
  firma_name: string | null; lat: number | null; lon: number | null; erstellt_am: string
  firma_id: string
}

Deno.serve(async () => {
  // Aktive Alarme samt Profil des Schülers. Die Adresse kommt IMMER aus
  // der Datenbank, nie aus einer Anfrage.
  const { data: alarme, error: alarmFehler } = await supabase
    .from('job_alarme')
    .select('id, schueler_id, ort, lat, lon, umkreis_km, kategorie, arbeitszeit, min_lohn, ' +
      'abmelde_token, zuletzt_gesendet, profil:schueler_id(name, email, alter_jahre)')
    .eq('aktiv', true)
  if (alarmFehler) {
    console.error(alarmFehler)
    return new Response('lookup failed', { status: 500 })
  }
  if (!alarme?.length) {
    return new Response(JSON.stringify({ alarme: 0, gesendet: 0 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Ältester Stichtag über alle Alarme: So reicht EINE Job-Abfrage statt
  // einer pro Schüler.
  const aeltester = alarme
    .map(a => a.zuletzt_gesendet)
    .reduce((a, b) => (a < b ? a : b))

  const { data: jobs, error: jobFehler } = await supabase
    .from('jobs')
    .select('id, titel, ort, kategorie, arbeitszeit, stundenlohn, mindestalter, firma_name, lat, lon, erstellt_am, firma_id')
    .eq('aktiv', true)
    .gt('erstellt_am', aeltester)
    .order('erstellt_am', { ascending: false })
  if (jobFehler) {
    console.error(jobFehler)
    return new Response('lookup failed', { status: 500 })
  }

  // Nur Jobs freigegebener Firmen — dieselbe Bedingung wie die
  // öffentliche Policy „Jobs öffentlich lesen". Der Service-Role-
  // Schlüssel umgeht RLS, also muss die Regel hier von Hand stehen.
  const firmenIds = [...new Set((jobs ?? []).map(j => j.firma_id))]
  const freigegeben = new Set<string>()
  if (firmenIds.length) {
    const { data: firmen } = await supabase
      .from('profiles').select('id').in('id', firmenIds).eq('firma_status', 'freigegeben')
    for (const f of firmen ?? []) freigegeben.add(f.id)
  }
  const sichtbar = (jobs ?? []).filter(j => freigegeben.has(j.firma_id)) as Job[]

  let gesendet = 0
  for (const alarm of alarme) {
    const profil = alarm.profil as { name?: string; email?: string; alter_jahre?: number } | null
    if (!profil?.email) continue

    const treffer = sichtbar.filter(j => passtZumAlarm(j, alarm, profil))

    if (!treffer.length) continue

    const abmeldeLink = `${SITE_URL}/job-alarm-aus.html?token=${alarm.abmelde_token}`
    const anzahl = treffer.length
    const liste = treffer.slice(0, MAX_JOBS).map(j => {
      const teile = [j.ort, j.stundenlohn ? `${j.stundenlohn} €/Std` : null, j.kategorie]
        .filter(Boolean).map(esc).join(' &middot; ')
      return `<li style="margin-bottom:10px">
        <a href="${SITE_URL}/job.html?id=${encodeURIComponent(j.id)}"
           style="color:#00795c;font-weight:bold;text-decoration:none">${esc(j.titel)}</a>
        <br><span style="color:#5a6270;font-size:13px">${esc(j.firma_name ?? '')}${j.firma_name ? ' &middot; ' : ''}${teile}</span>
      </li>`
    }).join('')
    const rest = anzahl > MAX_JOBS
      ? `<p style="color:#5a6270;font-size:13px">… und ${anzahl - MAX_JOBS} weitere.</p>` : ''

    const ok = await sendeMail(
      profil.email,
      anzahl === 1 ? 'Ein neuer Job für dich' : `${anzahl} neue Jobs für dich`,
      `<h2 style="font-family:sans-serif;margin:0 0 12px">
         ${anzahl === 1 ? 'Ein neuer Job' : `${anzahl} neue Jobs`} in deiner Nähe</h2>
       <p>Hallo ${esc(String(profil.name ?? '').split(' ')[0] || 'du')}, seit deiner letzten
          Mail ${anzahl === 1 ? 'ist ein passender Job' : 'sind passende Jobs'} dazugekommen:</p>
       <ul style="padding-left:18px">${liste}</ul>
       ${rest}
       <p><a href="${SITE_URL}/jobs.html"
         style="display:inline-block;background:#00795c;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none">
         Alle Jobs ansehen</a></p>`,
      abmeldeLink,
    )

    if (ok) {
      gesendet++
      // Erst NACH erfolgreichem Versand fortschreiben. Schlägt Resend
      // fehl, werden dieselben Jobs morgen erneut versucht statt
      // stillschweigend zu verschwinden.
      await supabase.from('job_alarme')
        .update({ zuletzt_gesendet: new Date().toISOString() })
        .eq('id', alarm.id)
    }
  }

  return new Response(JSON.stringify({ alarme: alarme.length, gesendet }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
})
