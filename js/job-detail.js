import { supabase } from './supabase.js'
import { ICONS } from './icons.js'

function escapeHtml(str) {
  const div = document.createElement('div'); div.textContent = str ?? ''; return div.innerHTML
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
