import { supabase } from './supabase.js'
import { requireAuth, logout } from './session.js'
import { ICONS } from './icons.js'
import { ladeLebenslaufAlsPdf } from './pdf.js'

let profile
let editingJobId = null

async function init() {
  profile = await requireAuth('firma')
  if (!profile) return

  document.getElementById('user-name').textContent = profile.name || 'Firma'
  document.getElementById('logout-btn').addEventListener('click', logout)
  document.getElementById('job-form').addEventListener('submit', speichereJob)
  document.getElementById('cancel-edit-btn').addEventListener('click', beendeBearbeitung)

  document.getElementById('profile-name').value = profile.name || ''
  document.getElementById('profile-ort').value = profile.ort || ''
  document.getElementById('toggle-profile-btn').addEventListener('click', () => {
    const box = document.getElementById('profile-box')
    box.style.display = box.style.display === 'none' ? 'block' : 'none'
  })
  document.getElementById('profile-form').addEventListener('submit', speichereProfil)

  await ladeEigeneJobs()
}

async function speichereProfil(e) {
  e.preventDefault()
  const btn = e.target.querySelector('button[type=submit]')
  btn.disabled = true
  btn.textContent = 'Speichert...'

  const updates = {
    name: document.getElementById('profile-name').value,
    ort: document.getElementById('profile-ort').value
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id)

  btn.disabled = false
  btn.textContent = 'Speichern'

  if (error) {
    alert('Fehler: ' + error.message)
    return
  }

  profile = { ...profile, ...updates }
  document.getElementById('user-name').textContent = profile.name
  document.getElementById('profile-box').style.display = 'none'
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
    renderStats(0, 0)
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="14" width="36" height="26" rx="4"/><path d="M17 14v-3a4 4 0 014-4h6a4 4 0 014 4v3" stroke-linecap="round"/><path d="M6 24h36" /></svg>
        <p>Noch keine Jobs gepostet. Leg oben deinen ersten an!</p>
      </div>`
    return
  }

  const { data: bewerbungen } = await supabase
    .from('bewerbungen')
    .select('job_id, bewerber:schueler_id(name, email, ort, alter_jahre, schule, klasse, erfahrung, ueber_mich, faehigkeiten, foto_url, zeugnis_url, motivationsschreiben)')
    .in('job_id', jobs.map(j => j.id))

  renderStats(jobs.length, bewerbungen?.length || 0)

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
        <span class="job-badge">${ICONS.age} ab ${job.mindestalter} J.</span>
      </div>
      <h3>${escapeHtml(job.titel)}</h3>
      <p class="company-name">${ICONS.pin} ${escapeHtml(job.ort || '')}</p>
      <div class="job-meta">
        ${job.stundenlohn ? `<span>${ICONS.money} ${job.stundenlohn} €/Std</span>` : ''}
        ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
      </div>
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button class="btn btn-outline" style="flex:1; padding:9px;" data-edit="${job.id}">Bearbeiten</button>
        <button class="btn btn-outline" style="flex:1; padding:9px; color:var(--coral);" data-delete="${job.id}">Löschen</button>
      </div>
      <div class="bewerber-list">
        <p class="bewerber-title">${bewerber.length} Bewerbung(en)</p>
        ${bewerber.map((b, idx) => `
          <div class="bewerber-item">
            <div style="display:flex; gap:10px; align-items:center;">
              <div class="cv-photo-preview" style="width:40px; height:40px; font-size:1rem; ${b.foto_url ? `background-image:url(${b.foto_url})` : ''}">${b.foto_url ? '' : escapeHtml((b.name || '?')[0].toUpperCase())}</div>
              <div>
                <strong>${escapeHtml(b.name || 'Unbekannt')}</strong>, ${b.alter_jahre || '?'} Jahre – ${escapeHtml(b.ort || '')}<br>
                <a href="mailto:${escapeHtml(b.email || '')}" class="mono">${escapeHtml(b.email || '')}</a>
              </div>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px;">
              <button class="btn btn-dark" style="flex:1; padding:8px; font-size:0.82rem;" data-pdf-job="${job.id}" data-pdf-idx="${idx}">Lebenslauf (PDF)</button>
              ${b.zeugnis_url ? `<button class="btn btn-outline" style="flex:1; padding:8px; font-size:0.82rem;" data-zeugnis-job="${job.id}" data-zeugnis-idx="${idx}">Zeugnis</button>` : ''}
            </div>
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
  list.querySelectorAll('[data-pdf-job]').forEach(btn => {
    btn.addEventListener('click', () => {
      const b = bewerberByJob[btn.dataset.pdfJob][btn.dataset.pdfIdx]
      btn.disabled = true
      btn.textContent = 'Wird erstellt...'
      ladeLebenslaufAlsPdf(b).finally(() => {
        btn.disabled = false
        btn.textContent = 'Lebenslauf (PDF)'
      })
    })
  })
  list.querySelectorAll('[data-zeugnis-job]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const b = bewerberByJob[btn.dataset.zeugnisJob][btn.dataset.zeugnisIdx]
      btn.disabled = true
      btn.textContent = 'Lädt...'
      const { data, error } = await supabase.storage.from('zeugnisse').createSignedUrl(b.zeugnis_url, 60)
      btn.disabled = false
      btn.textContent = 'Zeugnis'
      if (error) {
        alert('Fehler: ' + error.message)
        return
      }
      window.open(data.signedUrl, '_blank')
    })
  })
}

function renderStats(jobCount, bewerbungCount) {
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-box"><b>${jobCount}</b><span>Aktive Jobs</span></div>
    <div class="stat-box"><b>${bewerbungCount}</b><span>Bewerbungen gesamt</span></div>
  `
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

init()
