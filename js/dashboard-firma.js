import { supabase } from './supabase.js'
import { requireAuth, logout } from './session.js'

let profile

async function init() {
  profile = await requireAuth('firma')
  if (!profile) return

  document.getElementById('user-name').textContent = profile.name || 'Firma'
  document.getElementById('logout-btn').addEventListener('click', logout)
  document.getElementById('job-form').addEventListener('submit', erstelleJob)

  await ladeEigeneJobs()
}

async function erstelleJob(e) {
  e.preventDefault()
  const btn = e.target.querySelector('button[type=submit]')
  btn.disabled = true
  btn.textContent = 'Wird gepostet...'

  const { error } = await supabase.from('jobs').insert({
    firma_id: profile.id,
    titel: document.getElementById('job-titel').value,
    beschreibung: document.getElementById('job-beschreibung').value,
    ort: document.getElementById('job-ort').value,
    stundenlohn: parseFloat(document.getElementById('job-lohn').value) || null,
    mindestalter: parseInt(document.getElementById('job-mindestalter').value) || 13,
    verfuegbarkeit: document.getElementById('job-verfuegbarkeit').value
  })

  btn.disabled = false
  btn.textContent = 'Job posten'

  if (error) {
    alert('Fehler: ' + error.message)
    return
  }

  e.target.reset()
  await ladeEigeneJobs()
}

async function ladeEigeneJobs() {
  const list = document.getElementById('meine-jobs')

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('firma_id', profile.id)
    .order('erstellt_am', { ascending: false })

  if (error || !jobs?.length) {
    list.innerHTML = '<p style="color:var(--ink-soft);">Noch keine Jobs gepostet.</p>'
    return
  }

  const { data: bewerbungen } = await supabase
    .from('bewerbungen')
    .select('job_id, bewerber:schueler_id(name, email, ort, alter_jahre)')
    .in('job_id', jobs.map(j => j.id))

  const bewerberByJob = {}
  ;(bewerbungen || []).forEach(b => {
    if (!bewerberByJob[b.job_id]) bewerberByJob[b.job_id] = []
    bewerberByJob[b.job_id].push(b.bewerber)
  })

  list.innerHTML = jobs.map(job => {
    const bewerber = bewerberByJob[job.id] || []
    return `
    <div class="job-card">
      <div class="job-card-top">
        <div class="company-logo">${escapeHtml((job.titel || '?')[0].toUpperCase())}</div>
        <span class="job-badge">ab ${job.mindestalter} J.</span>
      </div>
      <h3>${escapeHtml(job.titel)}</h3>
      <p class="company-name">${escapeHtml(job.ort || '')}</p>
      <div class="job-meta">
        <span>${job.stundenlohn ? job.stundenlohn + ' €/Std' : ''}</span>
        <span>${escapeHtml(job.verfuegbarkeit || '')}</span>
      </div>
      <div class="bewerber-list">
        <p class="bewerber-title">${bewerber.length} Bewerbung(en)</p>
        ${bewerber.map(b => `
          <div class="bewerber-item">
            <strong>${escapeHtml(b.name || 'Unbekannt')}</strong>, ${b.alter_jahre || '?'} Jahre – ${escapeHtml(b.ort || '')}<br>
            <a href="mailto:${escapeHtml(b.email || '')}" class="mono">${escapeHtml(b.email || '')}</a>
          </div>
        `).join('')}
      </div>
    </div>
  `}).join('')
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

init()
