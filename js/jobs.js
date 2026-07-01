import { supabase } from './supabase.js'

async function ladeJobs() {
  const grid = document.getElementById('jobs-grid')

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('aktiv', true)
    .order('erstellt_am', { ascending: false })

  if (error || !jobs?.length) {
    grid.innerHTML = '<p style="color:var(--ink-soft);">Aktuell keine Jobs verfügbar.</p>'
    return
  }

  grid.innerHTML = jobs.map(job => `
    <div class="job-card">
      <div class="job-card-top">
        <div class="company-logo">${escapeHtml((job.titel || '?')[0].toUpperCase())}</div>
        <span class="job-badge">ab ${job.mindestalter} J.</span>
      </div>
      <h3>${escapeHtml(job.titel)}</h3>
      <p class="company-name">${escapeHtml(job.ort || '')}</p>
      ${job.beschreibung ? `<p class="job-description">${escapeHtml(job.beschreibung)}</p>` : ''}
      <div class="job-meta">
        <span>${job.stundenlohn ? job.stundenlohn + ' €/Std' : ''}</span>
        <span>${escapeHtml(job.verfuegbarkeit || '')}</span>
      </div>
    </div>
  `).join('')
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

ladeJobs()
