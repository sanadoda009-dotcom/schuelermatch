// Edge Function "mail-digest"
// Läuft einmal täglich (per Zeitplan) und schickt jeder Firma mit
// Einstellung "taeglich" EINE Sammel-Mail über die Bewerbungen der letzten 24 Stunden.
// So wird niemand mit Einzel-Mails zugespamt.
//
// Zeitplan einrichten: Supabase -> Edge Functions -> mail-digest -> Schedule
//   (z.B. Cron "0 17 * * *" = täglich 17:00 UTC)
//
// Secrets wie bei mail-ereignis (RESEND_API_KEY, MAIL_ABSENDER, SITE_URL).

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
      Tägliche Zusammenfassung von SchülerMatch. Im Firmenprofil kannst du auf „sofort" oder „aus" umstellen.
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

Deno.serve(async () => {
  const seit = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  // Alle Bewerbungen der letzten 24h + zugehörige Firma
  const { data: bewerbungen, error } = await supabase
    .from('bewerbungen')
    .select('id, erstellt_am, job:job_id(titel, firma:firma_id(id, name, email, benachrichtigung))')
    .gte('erstellt_am', seit)
  if (error) {
    console.error(error)
    return new Response('lookup failed', { status: 500 })
  }

  // Nach Firma gruppieren – nur Firmen mit Einstellung "taeglich"
  const proFirma = new Map<string, { name: string; email: string; jobs: Map<string, number> }>()
  for (const b of bewerbungen ?? []) {
    const firma = b.job?.firma
    if (!firma || firma.benachrichtigung !== 'taeglich' || !firma.email) continue
    if (!proFirma.has(firma.id)) proFirma.set(firma.id, { name: firma.name, email: firma.email, jobs: new Map() })
    const eintrag = proFirma.get(firma.id)!
    const titel = b.job?.titel ?? 'Job'
    eintrag.jobs.set(titel, (eintrag.jobs.get(titel) ?? 0) + 1)
  }

  let gesendet = 0
  for (const firma of proFirma.values()) {
    const gesamt = [...firma.jobs.values()].reduce((a, n) => a + n, 0)
    const liste = [...firma.jobs.entries()]
      .map(([titel, n]) => `<li><b>${n}</b> für „${titel}"</li>`)
      .join('')
    const ok = await sendeMail(
      firma.email,
      `${gesamt} neue Bewerbung${gesamt === 1 ? '' : 'en'} bei SchülerMatch`,
      `<h2 style="font-family:sans-serif">Deine Bewerbungen heute</h2>
       <p>Hallo ${firma.name || ''}, du hast heute <b>${gesamt}</b> neue Bewerbung${gesamt === 1 ? '' : 'en'} erhalten:</p>
       <ul>${liste}</ul>
       <p><a href="${SITE_URL}/dashboard-firma.html"
         style="display:inline-block;background:#2b2f8f;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none">
         Bewerbungen ansehen</a></p>`,
    )
    if (ok) gesendet++
  }

  return new Response(JSON.stringify({ firmen: proFirma.size, gesendet }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
