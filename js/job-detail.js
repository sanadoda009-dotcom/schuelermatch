import { supabase } from './supabase.js'
import { ICONS } from './icons.js'

function escapeHtml(str) {
  const div = document.createElement('div'); div.textContent = str ?? ''; return div.innerHTML
}

function sterneHtml(n) {
  let h = ''
  for (let i = 1; i <= 5; i++) h += `<span class="${i <= n ? '' : 'leer'}">★</span>`
  return `<span class="sterne-anzeige">${h}</span>`
}

async function ladeBewertungenHtml(firmaId) {
  if (!firmaId) return ''
  const { data } = await supabase.from('bewertungen')
    .select('sterne, kommentar, schueler_name, erstellt_am')
    .eq('firma_id', firmaId)
    .order('erstellt_am', { ascending: false })

  if (!data || !data.length) {
    return `<section style="margin-top:24px;"><h2>Bewertungen</h2>
      <p class="cv-preview-empty">Noch keine Bewertungen. Bewertungen können nur Schüler abgeben, die von dieser Firma angenommen wurden.</p></section>`
  }

  const schnitt = data.reduce((s, b) => s + b.sterne, 0) / data.length
  const gerundet = Math.round(schnitt)
  const karten = data.map(b => {
    const datum = b.erstellt_am ? new Date(b.erstellt_am).toLocaleDateString('de-DE', { year: 'numeric', month: 'short' }) : ''
    return `<div class="bewertung-card">
      <div class="kopf">
        <span class="name">${escapeHtml(b.schueler_name || 'Schüler:in')}</span>
        <span class="verifiziert">✓ hat hier gearbeitet</span>
      </div>
      ${sterneHtml(b.sterne)}
      ${b.kommentar ? `<p>${escapeHtml(b.kommentar)}</p>` : ''}
      ${datum ? `<span class="datum">${datum}</span>` : ''}
    </div>`
  }).join('')

  return `<section style="margin-top:24px;">
    <h2>Bewertungen</h2>
    <div class="bewertung-summary">
      ${sterneHtml(gerundet)}
      <span class="schnitt">${schnitt.toFixed(1)}</span>
      <span class="anzahl">aus ${data.length} ${data.length === 1 ? 'Bewertung' : 'Bewertungen'}</span>
    </div>
    <div class="bewertung-liste">${karten}</div>
  </section>`
}

async function ladeJob() {
  const el = document.getElementById('job-detail')
  const id = new URLSearchParams(location.search).get('id')

  if (!id) {
    el.innerHTML = '<h1>Job nicht gefunden</h1><p><a href="jobs.html" style="color:var(--match-green-dark);text-decoration:underline;">Zurück zu allen Jobs</a></p>'
    return
  }

  const { data: job, error } = await supabase.from('jobs').select('*').eq('id', id).eq('aktiv', true).single()

  if (error || !job) {
    el.innerHTML = '<h1>Job nicht verfügbar</h1><p>Diese Anzeige gibt es nicht mehr oder sie wurde pausiert.</p><p><a href="jobs.html" style="color:var(--match-green-dark);text-decoration:underline;">Alle aktuellen Jobs ansehen →</a></p>'
    return
  }

  // Aufruf zählen + Titel/Meta für Teilen setzen
  supabase.rpc('job_aufruf_zaehlen', { p_job: id })
  const bewertungenHtml = await ladeBewertungenHtml(job.firma_id)

  // Strukturierte Daten (schema.org JobPosting) -> Google-Jobs-Auffindbarkeit
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.titel,
    description: job.beschreibung || job.titel,
    datePosted: job.erstellt_am ? job.erstellt_am.slice(0, 10) : undefined,
    employmentType: 'PART_TIME',
    hiringOrganization: { '@type': 'Organization', name: job.firma_name || 'Arbeitgeber auf SchülerMatch' },
    jobLocation: job.ort ? { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.ort, addressCountry: 'DE' } } : undefined,
    baseSalary: job.stundenlohn ? { '@type': 'MonetaryAmount', currency: 'EUR', value: { '@type': 'QuantitativeValue', value: job.stundenlohn, unitText: 'HOUR' } } : undefined,
    directApply: true
  }
  const ldScript = document.createElement('script')
  ldScript.type = 'application/ld+json'
  ldScript.textContent = JSON.stringify(jsonLd, (k, v) => v === undefined ? undefined : v)
  document.head.appendChild(ldScript)
  document.title = `${job.titel} – SchülerMatch`
  document.querySelector('meta[name="description"]')?.setAttribute('content',
    `${job.titel}${job.ort ? ' in ' + job.ort : ''} – ab ${job.mindestalter} Jahren${job.stundenlohn ? ', ' + job.stundenlohn + ' €/Std' : ''}. Kostenlos bewerben auf SchülerMatch.`)

  el.innerHTML = `
    <a href="jobs.html" class="mono" style="color:var(--ink-soft); font-size:0.82rem;">← Alle Jobs</a>
    <div style="display:flex; align-items:center; gap:16px; margin:16px 0 8px;">
      <div class="company-logo" style="width:60px; height:60px; font-size:1.5rem;">${escapeHtml((job.titel || '?')[0].toUpperCase())}</div>
      <h1 style="font-size:2rem;">${escapeHtml(job.titel)}</h1>
    </div>
    <p class="company-name" style="font-size:1rem;">${ICONS.pin} ${escapeHtml(job.ort || '')}
      ${job.kategorie ? `<span class="kategorie-chip">${escapeHtml(job.kategorie)}</span>` : ''}
      ${job.arbeitszeit ? `<span class="arbeitszeit-chip">🕐 ${escapeHtml(job.arbeitszeit)}</span>` : ''}
    </p>

    <div class="job-meta" style="margin:20px 0; font-size:0.95rem;">
      <span>${ICONS.age} ab ${job.mindestalter} Jahren</span>
      ${job.stundenlohn ? `<span class="lohn-highlight">${job.stundenlohn} €/Std</span>` : ''}
      ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
      <span>👁 ${job.aufrufe || 0} Aufrufe</span>
    </div>

    <section>
      <h2>Beschreibung</h2>
      ${job.beschreibung ? `<p style="white-space:pre-wrap;">${escapeHtml(job.beschreibung)}</p>` : '<p class="cv-preview-empty">Keine weitere Beschreibung vorhanden.</p>'}
    </section>

    ${bewertungenHtml}

    <div class="legal-highlight" style="margin-top:24px;">
      <h2>Bewerben</h2>
      <p>Um dich zu bewerben, brauchst du ein kostenloses (verifiziertes) Schüler-Konto. Danach kannst du mit einem Klick über die Plattform Kontakt aufnehmen.</p>
      <div class="hero-ctas" style="margin-top:14px;">
        <a href="register.html?rolle=schueler" class="btn btn-green">Kostenlos registrieren & bewerben</a>
        <a href="login.html" class="btn btn-outline">Ich habe schon ein Konto</a>
      </div>
    </div>

    <button type="button" id="share-btn" class="share-btn" style="margin-top:20px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Link kopieren
    </button>
  `

  document.getElementById('share-btn').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(location.href)
      e.currentTarget.textContent = '✓ Kopiert!'
    } catch {
      prompt('Link zum Kopieren:', location.href)
    }
  })
}

ladeJob()
