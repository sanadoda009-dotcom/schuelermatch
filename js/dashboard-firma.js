import { supabase } from './supabase.js'
import { requireAuth, logout } from './session.js'

let profile
let editingJobId = null

async function init() {
  profile = await requireAuth('firma')
  if (!profile) return

  document.getElementById('user-name').textContent = profile.name || 'Firma'
  document.getElementById('logout-btn').addEventListener('click', logout)
  document.getElementById('job-form').addEventListener('submit', speichereJob)
  document.getElementById('cancel-edit-btn').addEventListener('click', beendeBearbeitung)

  await ladeEigeneJobs()
}

function sammleFormular() {
  return {
    titel: document.getElementById('job-titel').value,
    beschreibung: document.getElementById('job-beschreibung').value,
    ort: document.getElementById('job-ort').value,
    stundenlohn: parseFloat(document.getElementById('job-lohn').value) || null,
    mindestalter: parseInt(document.getElementById('job-mindestalter').value) || 13,
    verfuegbarkeit: document.getElementById('job-verfuegbarkeit').value
  }
}

async function speichereJob(e) {
  e.preventDefault()
  const btn = e.target.querySelector('button[type=submit]')
  btn.disabled = true
  btn.textContent = editingJobId ? 'Wird gespeichert...' : 'Wird gepostet...'

  const daten = sammleFormular()
  let error

  if (editingJobId) {
    ;({ error } = await supabase.from('jobs').update(daten).eq('id', editingJobId))
  } else {
    ;({ error } = await supabase.from('jobs').insert({ ...daten, firma_id: profile.id }))
  }

  btn.disabled = false

  if (error) {
    alert('Fehler: ' + error.message)
    btn.textContent = editingJobId ? 'Job aktualisieren' : 'Job posten'
    return
  }

  beendeBearbeitung()
  await ladeEigeneJobs()
}

function starteBearbeitung(job) {
  editingJobId = job.id
  document.getElementById('job-titel').value = job.titel || ''
  document.getElementById('job-beschreibung').value = job.beschreibung || ''
  document.getElementById('job-ort').value = job.ort || ''
  document.getElementById('job-lohn').value = job.stundenlohn || ''
  document.getElementById('job-mindestalter').value = job.mindestalter || 15
  document.getElementById('job-verfuegbarkeit').value = job.verfuegbarkeit || ''

  const submitBtn = document.querySelector('#job-form button[type=submit]')
  submitBtn.textContent = 'Job aktualisieren'
  document.getElementById('cancel-edit-btn').style.display = 'inline-block'
  document.querySelector('.post-job-box').scrollIntoView({ behavior: 'smooth' })
}

function beendeBearbeitung() {
  editingJobId = null
  document.getElementById('job-form').reset()
  document.querySelector('#job-form button[type=submit]').textContent = 'Job posten'
  document.getElementById('cancel-edit-btn').style.display = 'none'
}

async function loescheJob(jobId) {
  if (!confirm('Diesen Job wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return
  const { error } = await supabase.from('jobs').delete().eq('id', jobId)
  if (error) {
    alert('Fehler beim Löschen: ' + error.message)
    return
  }
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
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button class="btn btn-outline" style="flex:1; padding:9px;" data-edit="${job.id}">Bearbeiten</button>
        <button class="btn btn-outline" style="flex:1; padding:9px; color:var(--coral);" data-delete="${job.id}">Löschen</button>
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

  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const job = jobs.find(j => j.id === btn.dataset.edit)
      starteBearbeitung(job)
    })
  })
  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => loescheJob(btn.dataset.delete))
  })
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

init()
