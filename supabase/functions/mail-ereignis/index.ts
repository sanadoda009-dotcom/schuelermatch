// Edge Function "mail-ereignis"
// Wird von Datenbank-Webhooks aufgerufen, wenn sich die Tabelle "bewerbungen" ändert:
//   INSERT  -> neue Bewerbung: Mail an die Firma, ABER nur wenn Firma "sofort" gewählt hat
//              (bei "taeglich" übernimmt die Digest-Funktion, bei "aus" gar nichts)
//   UPDATE  -> Statuswechsel: Mail an den Schüler (Zusage/Absage)
//
// Nötige Secrets (Supabase -> Edge Functions -> Secrets):
//   RESEND_API_KEY   (von resend.com)
//   MAIL_ABSENDER    z.B. "SchülerMatch <no-reply@schuelermatch.de>"
//   SITE_URL         z.B. "https://schuelermatch.de"
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const ABSENDER = Deno.env.get('MAIL_ABSENDER') ?? 'SchülerMatch <onboarding@resend.dev>'
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://schuelermatch.de'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function rahmen(inhalt: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#161a1f">
    <div style="height:4px;background:linear-gradient(120deg,#00c896,#2b2f8f);border-radius:4px"></div>
    <div style="padding:24px 4px">${inhalt}</div>
    <p style="font-size:12px;color:#9aa0a8;border-top:1px solid #e7e3da;padding-top:14px">
      Du bekommst diese E-Mail von SchülerMatch. Einstellungen änderst du in deinem Dashboard.
    </p>
  </div>`
}

async function sendeMail(an: string, betreff: string, inhalt: string): Promise<boolean> {
  if (!an) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: ABSENDER, to: an, subject: betreff, html: rahmen(inhalt) }),
  })
  if (!res.ok) console.error('Resend-Fehler:', res.status, await res.text())
  return res.ok
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    if (payload.table !== 'bewerbungen') return new Response('ignored', { status: 200 })

    const id = payload.record?.id
    if (!id) return new Response('no id', { status: 200 })

    // Bewerbung mit Job, Firma und Schüler nachladen (Service-Role liest alles)
    const { data: b, error } = await supabase
      .from('bewerbungen')
      .select('id, status, job:job_id(titel, firma:firma_id(name, email, benachrichtigung)), schueler:schueler_id(name, email)')
      .eq('id', id)
      .single()
    if (error || !b) return new Response('lookup failed', { status: 200 })

    const jobTitel = b.job?.titel ?? 'einen Job'
    const firma = b.job?.firma
    const schueler = b.schueler

    if (payload.type === 'INSERT') {
      // Neue Bewerbung -> Firma nur benachrichtigen, wenn sie "sofort" will
      if (firma?.benachrichtigung === 'sofort') {
        await sendeMail(
          firma.email,
          `Neue Bewerbung für „${jobTitel}"`,
          `<h2 style="font-family:sans-serif">Neue Bewerbung 🎉</h2>
           <p><b>${schueler?.name ?? 'Ein Schüler'}</b> hat sich auf deine Anzeige
           <b>„${jobTitel}"</b> beworben.</p>
           <p><a href="${SITE_URL}/dashboard-firma.html"
             style="display:inline-block;background:#2b2f8f;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none">
             Bewerbung ansehen</a></p>`,
        )
      }
    } else if (payload.type === 'UPDATE') {
      const alt = payload.old_record?.status
      const neu = b.status
      if (alt !== neu && (neu === 'angenommen' || neu === 'abgelehnt')) {
        const vorname = (schueler?.name ?? '').split(' ')[0] || 'Hallo'
        if (neu === 'angenommen') {
          await sendeMail(
            schueler?.email,
            `Gute Nachrichten zu „${jobTitel}"! 🎉`,
            `<h2 style="font-family:sans-serif">Du hast eine Zusage! 🎉</h2>
             <p>Hallo ${vorname}, <b>${firma?.name ?? 'die Firma'}</b> hat deine Bewerbung
             für <b>„${jobTitel}"</b> angenommen.</p>
             <p>Öffne den Chat im Dashboard, um die nächsten Schritte zu klären.</p>
             <p><a href="${SITE_URL}/dashboard-schueler.html"
               style="display:inline-block;background:linear-gradient(120deg,#00c896,#2b2f8f);color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none">
               Zum Chat</a></p>`,
          )
        } else {
          await sendeMail(
            schueler?.email,
            `Deine Bewerbung für „${jobTitel}"`,
            `<h2 style="font-family:sans-serif">Diesmal hat es nicht geklappt</h2>
             <p>Hallo ${vorname}, danke für deine Bewerbung für <b>„${jobTitel}"</b>.
             Diesmal hat sich die Firma für jemand anderen entschieden – das sagt nichts über dich aus.</p>
             <p>Bleib dran, dein nächster Job wartet schon!</p>
             <p><a href="${SITE_URL}/jobs.html"
               style="display:inline-block;background:#2b2f8f;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none">
               Weitere Jobs entdecken</a></p>`,
          )
        }
      }
    }

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response('error', { status: 200 }) // 200 -> Webhook wiederholt nicht endlos
  }
})
