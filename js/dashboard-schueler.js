import { supabase } from './supabase.js'
import { requireAuth, logout } from './session.js'
import { ICONS } from './icons.js'
import { ladeLebenslaufAlsPdf } from './pdf.js'

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
  document.getElementById('cv-faehigkeiten').value = profile.faehigkeiten || ''
  document.getElementById('cv-erfahrung').value = profile.erfahrung || ''
  document.getElementById('cv-ueber-mich').value = profile.ueber_mich || ''
  document.getElementById('cv-motivation').value = profile.motivationsschreiben || ''
  setzePhotoPreview(profile.foto_url)
  setzeZeugnisStatus()

  document.getElementById('toggle-lebenslauf-btn').addEventListener('click', () => {
    const box = document.getElementById('lebenslauf-box')
    box.style.display = box.style.display === 'none' ? 'grid' : 'none'
    renderCvPreview()
  })
  document.getElementById('lebenslauf-form').addEventListener('submit', speichereLebenslauf)
  document.getElementById('lebenslauf-form').addEventListener('input', renderCvPreview)

  document.getElementById('cv-foto-btn').addEventListener('click', () => document.getElementById('cv-foto').click())
  document.getElementById('cv-foto').addEventListener('change', ladeFotoHoch)

  document.getElementById('cv-zeugnis-btn').addEventListener('click', () => document.getElementById('cv-zeugnis').click())
  document.getElementById('cv-zeugnis').addEventListener('change', ladeZeugnisHoch)

  document.getElementById('cv-download-btn').addEventListener('click', () => {
    ladeLebenslaufAlsPdf({ ...profile, motivationsschreiben: document.getElementById('cv-motivation').value })
  })

  document.getElementById('ausweis-btn').addEventListener('click', () => document.getElementById('ausweis-datei').click())
  document.getElementById('ausweis-datei').addEventListener('change', ladeAusweisHoch)

  renderVerifyBanner()
  renderCvPreview()

  await ladeJobs()
}

function renderVerifyBanner() {
  const banner = document.getElementById('verify-banner')
  const verifyBox = document.getElementById('verify-box')

  if (profile.verifiziert) {
    banner.innerHTML = `<div class="verify-badge verify-badge--ok">✓ Als Schüler verifiziert</div>`
    verifyBox.style.display = 'none'
  } else if (profile.schuelerausweis_url) {
    banner.innerHTML = `<div class="verify-badge verify-badge--pending">⏳ Verifizierung ausstehend – wir prüfen deinen Ausweis</div>`
    verifyBox.style.display = 'none'
  } else {
    banner.innerHTML = `<div class="verify-badge verify-badge--missing">⚠ Noch nicht verifiziert – erforderlich um dich zu bewerben</div>`
    verifyBox.style.display = 'block'
  }
}

async function ladeAusweisHoch(e) {
  const file = e.target.files[0]
  if (!file) return

  const btn = document.getElementById('ausweis-btn')
  btn.disabled = true
  btn.textContent = 'Wird hochgeladen...'

  const ext = file.name.split('.').pop()
  const path = `${profile.id}/ausweis.${ext}`

  const { error: uploadError } = await supabase.storage.from('verifizierung').upload(path, file, { upsert: true })

  btn.disabled = false
  btn.textContent = 'Schülerausweis hochladen'

  if (uploadError) {
    alert('Fehler beim Hochladen: ' + uploadError.message)
    return
  }

  const { error: updateError } = await supabase.from('profiles').update({ schuelerausweis_url: path }).eq('id', profile.id)

  if (updateError) {
    alert('Fehler beim Speichern: ' + updateError.message)
    return
  }

  profile.schuelerausweis_url = path
  renderVerifyBanner()
  alert('Danke! Wir prüfen deinen Ausweis und schalten dich bald frei.')
}

function setzeZeugnisStatus() {
  document.getElementById('cv-zeugnis-status').textContent = profile.zeugnis_url ? 'Zeugnis hochgeladen ✓' : 'Kein Zeugnis hochgeladen'
}

async function ladeZeugnisHoch(e) {
  const file = e.target.files[0]
  if (!file) return

  const btn = document.getElementById('cv-zeugnis-btn')
  btn.disabled = true
  btn.textContent = 'Wird hochgeladen...'

  const ext = file.name.split('.').pop()
  const path = `${profile.id}/zeugnis.${ext}`

  const { error: uploadError } = await supabase.storage.from('zeugnisse').upload(path, file, { upsert: true })

  btn.disabled = false
  btn.textContent = 'Zeugnis hochladen'

  if (uploadError) {
    alert('Fehler beim Hochladen: ' + uploadError.message)
    return
  }

  const { error: updateError } = await supabase.from('profiles').update({ zeugnis_url: path }).eq('id', profile.id)

  if (updateError) {
    alert('Fehler beim Speichern: ' + updateError.message)
    return
  }

  profile.zeugnis_url = path
  setzeZeugnisStatus()
}

function setzePhotoPreview(url) {
  const box = document.getElementById('cv-photo-preview')
  if (url) {
    box.style.backgroundImage = `url(${url})`
    box.textContent = ''
  } else {
    box.style.backgroundImage = ''
    box.textContent = (profile.name || '?')[0].toUpperCase()
  }
}

async function ladeFotoHoch(e) {
  const file = e.target.files[0]
  if (!file) return

  if (file.size > 3 * 1024 * 1024) {
    alert('Das Bild ist zu groß (max. 3 MB).')
    return
  }

  const btn = document.getElementById('cv-foto-btn')
  btn.disabled = true
  btn.textContent = 'Wird hochgeladen...'

  const ext = file.name.split('.').pop()
  const path = `${profile.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (uploadError) {
    alert('Fehler beim Hochladen: ' + uploadError.message)
    btn.disabled = false
    btn.textContent = 'Foto hochladen'
    return
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const foto_url = data.publicUrl + '?t=' + Date.now()

  const { error: updateError } = await supabase.from('profiles').update({ foto_url }).eq('id', profile.id)

  btn.disabled = false
  btn.textContent = 'Foto hochladen'

  if (updateError) {
    alert('Fehler beim Speichern: ' + updateError.message)
    return
  }

  profile.foto_url = foto_url
  setzePhotoPreview(foto_url)
  renderCvPreview()
}

function renderCvPreview() {
  const name = profile.name || 'Dein Name'
  const schule = document.getElementById('cv-schule').value
  const klasse = document.getElementById('cv-klasse').value
  const faehigkeiten = document.getElementById('cv-faehigkeiten').value
  const erfahrung = document.getElementById('cv-erfahrung').value
  const ueberMich = document.getElementById('cv-ueber-mich').value
  const motivation = document.getElementById('cv-motivation').value
  const fotoUrl = profile.foto_url

  const tags = faehigkeiten.split(',').map(t => t.trim()).filter(Boolean)

  document.getElementById('cv-preview').innerHTML = `
    <div class="cv-preview-header">
      <div class="cv-preview-photo" style="${fotoUrl ? `background-image:url(${fotoUrl})` : ''}">${fotoUrl ? '' : escapeHtml(name[0]?.toUpperCase() || '?')}</div>
      <div>
        <div class="cv-preview-name">${escapeHtml(name)}</div>
        <div class="cv-preview-school">${escapeHtml(schule || 'Schule noch nicht angegeben')}${klasse ? ' · ' + escapeHtml(klasse) : ''}</div>
      </div>
    </div>
    ${tags.length ? `
      <div class="cv-preview-section">
        <h4>Fähigkeiten</h4>
        <div class="cv-tags">${tags.map(t => `<span class="cv-tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>` : ''}
    <div class="cv-preview-section">
      <h4>Erfahrung</h4>
      ${erfahrung ? `<p>${escapeHtml(erfahrung)}</p>` : '<p class="cv-preview-empty">Noch keine Angaben</p>'}
    </div>
    <div class="cv-preview-section">
      <h4>Über mich</h4>
      ${ueberMich ? `<p>${escapeHtml(ueberMich)}</p>` : '<p class="cv-preview-empty">Noch keine Angaben</p>'}
    </div>
    <div class="cv-preview-section">
      <h4>Motivationsschreiben</h4>
      ${motivation ? `<p>${escapeHtml(motivation)}</p>` : '<p class="cv-preview-empty">Noch keine Angaben</p>'}
    </div>
  `
}

async function speichereLebenslauf(e) {
  e.preventDefault()
  const btn = e.target.querySelector('button[type=submit]')
  btn.disabled = true
  btn.textContent = 'Speichert...'

  const updates = {
    schule: document.getElementById('cv-schule').value,
    klasse: document.getElementById('cv-klasse').value,
    faehigkeiten: document.getElementById('cv-faehigkeiten').value,
    erfahrung: document.getElementById('cv-erfahrung').value,
    ueber_mich: document.getElementById('cv-ueber-mich').value,
    motivationsschreiben: document.getElementById('cv-motivation').value
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
  if (!profile.verifiziert) {
    alert('Du musst dich erst als Schüler verifizieren, bevor du dich bewerben kannst.')
    document.getElementById('verify-box').style.display = 'block'
    document.getElementById('verify-box').scrollIntoView({ behavior: 'smooth' })
    return
  }

  if (!lebenslaufVollstaendig()) {
    alert('Bitte fülle zuerst deinen Lebenslauf aus, bevor du dich bewirbst.')
    document.getElementById('lebenslauf-box').style.display = 'grid'
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
