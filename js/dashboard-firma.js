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
    .select('job_id')
    .in('job_id', jobs.map(j => j.id))

  const counts = {}
  ;(bewerbungen || []).forEach(b => { counts[b.job_id] = (counts[b.job_id] || 0) + 1 })

  list.innerHTML = jobs.map(job => `
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
        <span>${counts[job.id] || 0} Bewerbung(en)</span>
      </div>
    </div>
  `).join('')
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

init()
