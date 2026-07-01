import { supabase } from './supabase.js'
import { requireAuth, logout } from './session.js'
import { ICONS } from './icons.js'

let profile

async function init() {
  profile = await requireAuth('schueler')
  if (!profile) return

  document.getElementById('user-name').textContent = profile.name || 'Schüler'
  document.getElementById('logout-btn').addEventListener('click', logout)

  document.getElementById('profile-name').value = profile.name || ''
  document.getElementById('profile-alter').value = profile.alter_jahre || 15
  document.getElementById('profile-ort').value = profile.ort || ''

  document.getElementById('toggle-profile-btn').addEventListener('click', () => {
    const box = document.getElementById('profile-box')
    box.style.display = box.style.display === 'none' ? 'block' : 'none'
  })
  document.getElementById('profile-form').addEventListener('submit', speichereProfil)

  document.getElementById('cv-schule').value = profile.schule || ''
  document.getElementById('cv-klasse').value = profile.klasse || ''
  document.getElementById('cv-erfahrung').value = profile.erfahrung || ''
  document.getElementById('cv-ueber-mich').value = profile.ueber_mich || ''

  document.getElementById('toggle-lebenslauf-btn').addEventListener('click', () => {
    const box = document.getElementById('lebenslauf-box')
    box.style.display = box.style.display === 'none' ? 'block' : 'none'
  })
  document.getElementById('lebenslauf-form').addEventListener('submit', speichereLebenslauf)

  await ladeJobs()
}

async function speichereLebenslauf(e) {
  e.preventDefault()
  const btn = e.target.querySelector('button[type=submit]')
  btn.disabled = true
  btn.textContent = 'Speichert...'

  const updates = {
    schule: document.getElementById('cv-schule').value,
    klasse: document.getElementById('cv-klasse').value,
    erfahrung: document.getElementById('cv-erfahrung').value,
    ueber_mich: document.getElementById('cv-ueber-mich').value
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id)

  btn.disabled = false
  btn.textContent = 'Lebenslauf speichern'

  if (error) {
    alert('Fehler: ' + error.message)
    return
  }

  profile = { ...profile, ...updates }
  document.getElementById('lebenslauf-box').style.display = 'none'
}

function lebenslaufVollstaendig() {
  return Boolean(profile.schule && profile.klasse)
}

async function speichereProfil(e) {
  e.preventDefault()
  const btn = e.target.querySelector('button[type=submit]')
  btn.disabled = true
  btn.textContent = 'Speichert...'

  const updates = {
    name: document.getElementById('profile-name').value,
    alter_jahre: parseInt(document.getElementById('profile-alter').value),
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
  await ladeJobs()
}

async function ladeJobs() {
  const grid = document.getElementById('jobs-grid')

  let query = supabase.from('jobs').select('*').eq('aktiv', true)
  if (profile.alter_jahre) {
    query = query.lte('mindestalter', profile.alter_jahre)
  }

  const { data: jobs, error } = await query.order('erstellt_am', { ascending: false })

  if (error || !jobs?.length) {
    renderStats(0, 0)
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="14" width="36" height="26" rx="4"/><path d="M17 14v-3a4 4 0 014-4h6a4 4 0 014 4v3" stroke-linecap="round"/><path d="M6 24h36" /></svg>
        <p>Aktuell keine passenden Jobs verfügbar. Schau bald wieder vorbei!</p>
      </div>`
    return
  }

  const { data: bewerbungen } = await supabase
    .from('bewerbungen')
    .select('job_id')
    .eq('schueler_id', profile.id)
  const beworbenIds = new Set((bewerbungen || []).map(b => b.job_id))

  renderStats(jobs.length, beworbenIds.size)

  grid.innerHTML = jobs.map(job => `
    <div class="job-card">
      <div class="job-card-top">
        <div class="company-logo">${escapeHtml((job.titel || '?')[0].toUpperCase())}</div>
        <span class="job-badge">${ICONS.age} ab ${job.mindestalter} J.</span>
      </div>
      <h3>${escapeHtml(job.titel)}</h3>
      <p class="company-name">${ICONS.pin} ${escapeHtml(job.ort || '')}</p>
      ${job.beschreibung ? `<p class="job-description">${escapeHtml(job.beschreibung)}</p>` : ''}
      <div class="job-meta">
        ${job.stundenlohn ? `<span>${ICONS.money} ${job.stundenlohn} €/Std</span>` : ''}
        ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
      </div>
      <button class="btn ${beworbenIds.has(job.id) ? 'btn-outline' : 'btn-green'} btn-full" style="margin-top:14px;" data-job-id="${job.id}" ${beworbenIds.has(job.id) ? 'disabled' : ''}>
        ${beworbenIds.has(job.id) ? 'Bereits beworben' : 'Jetzt bewerben'}
      </button>
    </div>
  `).join('')

  grid.querySelectorAll('button[data-job-id]').forEach(btn => {
    btn.addEventListener('click', () => bewerben(btn.dataset.jobId, btn))
  })
}

async function bewerben(jobId, btn) {
  if (!lebenslaufVollstaendig()) {
    alert('Bitte fülle zuerst deinen Lebenslauf aus, bevor du dich bewirbst.')
    document.getElementById('lebenslauf-box').style.display = 'block'
    document.getElementById('lebenslauf-box').scrollIntoView({ behavior: 'smooth' })
    document.getElementById('cv-schule').focus()
    return
  }

  btn.disabled = true
  btn.textContent = 'Wird gesendet...'

  const { error } = await supabase.from('bewerbungen').insert({ job_id: jobId, schueler_id: profile.id })

  if (error) {
    btn.textContent = 'Fehler – nochmal versuchen'
    btn.disabled = false
    return
  }

  btn.textContent = 'Bereits beworben'
  btn.classList.remove('btn-green')
  btn.classList.add('btn-outline')
}

function renderStats(matchCount, beworbenCount) {
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-box"><b>${matchCount}</b><span>Passende Jobs</span></div>
    <div class="stat-box"><b>${beworbenCount}</b><span>Deine Bewerbungen</span></div>
  `
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

init()
