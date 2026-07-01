import { supabase } from './supabase.js'
import { requireAuth, logout } from './session.js'
import { ICONS } from './icons.js'
import { ladeLebenslaufAlsPdf } from './pdf.js'
import { initSidebar } from './sidebar.js'

let profile

async function init() {
  profile = await requireAuth('schueler')
  if (!profile) return

  document.getElementById('user-name').textContent = profile.name || 'Schüler'
  document.getElementById('logout-btn').addEventListener('click', logout)

  initSidebar(zeigeView)

  // Profil
  document.getElementById('profile-name').value = profile.name || ''
  document.getElementById('profile-alter').value = profile.alter_jahre || 15
  document.getElementById('profile-ort').value = profile.ort || ''
  document.getElementById('profile-form').addEventListener('submit', speichereProfil)

  // Lebenslauf
  document.getElementById('cv-schule').value = profile.schule || ''
  document.getElementById('cv-klasse').value = profile.klasse || ''
  document.getElementById('cv-faehigkeiten').value = profile.faehigkeiten || ''
  document.getElementById('cv-erfahrung').value = profile.erfahrung || ''
  document.getElementById('cv-ueber-mich').value = profile.ueber_mich || ''
  document.getElementById('cv-motivation').value = profile.motivationsschreiben || ''
  setzePhotoPreview(profile.foto_url)
  setzeZeugnisStatus()

  document.getElementById('lebenslauf-form').addEventListener('submit', speichereLebenslauf)
  document.getElementById('lebenslauf-form').addEventListener('input', renderCvPreview)
  document.getElementById('cv-foto-btn').addEventListener('click', () => document.getElementById('cv-foto').click())
  document.getElementById('cv-foto').addEventListener('change', ladeFotoHoch)
  document.getElementById('cv-zeugnis-btn').addEventListener('click', () => document.getElementById('cv-zeugnis').click())
  document.getElementById('cv-zeugnis').addEventListener('change', ladeZeugnisHoch)
  document.getElementById('cv-download-btn').addEventListener('click', () => {
    ladeLebenslaufAlsPdf({ ...profile, motivationsschreiben: document.getElementById('cv-motivation').value })
  })

  // Verifizierung
  document.getElementById('ausweis-btn').addEventListener('click', () => document.getElementById('ausweis-datei').click())
  document.getElementById('ausweis-datei').addEventListener('change', (e) => ladeVerifizierungsDokument(e, 'ausweis', 'schuelerausweis_url'))
  document.getElementById('bestaetigung-btn').addEventListener('click', () => document.getElementById('bestaetigung-datei').click())
  document.getElementById('bestaetigung-datei').addEventListener('change', (e) => ladeVerifizierungsDokument(e, 'bestaetigung', 'schulbestaetigung_url'))

  renderVerifyStatus()
  renderCvPreview()

  await ladeJobs()
}

function zeigeView(view) {
  document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'))
  document.getElementById('view-' + view).classList.add('active')
  if (view === 'lebenslauf') renderCvPreview()
}

function renderVerifyStatus() {
  let badgeHtml
  if (profile.verifiziert) {
    badgeHtml = `<div class="verify-badge verify-badge--ok">✓ Als Schüler verifiziert</div>`
  } else if (profile.schuelerausweis_url || profile.schulbestaetigung_url) {
    badgeHtml = `<div class="verify-badge verify-badge--pending">⏳ Verifizierung ausstehend – wir prüfen deine Unterlagen</div>`
  } else {
    badgeHtml = `<div class="verify-badge verify-badge--missing">⚠ Noch nicht verifiziert – erforderlich um dich zu bewerben</div>`
  }
  document.getElementById('verify-banner').innerHTML = badgeHtml
  document.getElementById('verify-banner-2').innerHTML = badgeHtml

  document.getElementById('ausweis-status').textContent = profile.schuelerausweis_url ? 'Hochgeladen ✓' : ''
  document.getElementById('bestaetigung-status').textContent = profile.schulbestaetigung_url ? 'Hochgeladen ✓' : ''
}

async function ladeVerifizierungsDokument(e, dateiname, spalte) {
  const file = e.target.files[0]
  if (!file) return

  const btnId = dateiname === 'ausweis' ? 'ausweis-btn' : 'bestaetigung-btn'
  const btnText = dateiname === 'ausweis' ? 'Schülerausweis hochladen' : 'Schulbestätigung hochladen'
  const btn = document.getElementById(btnId)

  btn.disabled = true
  btn.textContent = 'Wird hochgeladen...'

  const ext = file.name.split('.').pop()
  const path = `${profile.id}/${dateiname}.${ext}`

  const { error: uploadError } = await supabase.storage.from('verifizierung').upload(path, file, { upsert: true })

  btn.disabled = false
  btn.textContent = btnText

  if (uploadError) {
    alert('Fehler beim Hochladen: ' + uploadError.message)
    return
  }

  const { error: updateError } = await supabase.from('profiles').update({ [spalte]: path }).eq('id', profile.id)

  if (updateError) {
    alert('Fehler beim Speichern: ' + updateError.message)
    return
  }

  profile[spalte] = path
  renderVerifyStatus()
  alert('Danke! Wir prüfen deine Unterlagen und schalten dich bald frei.')
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
  alert('Lebenslauf gespeichert!')
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
    document.querySelector('.sidebar-item[data-view="verifizierung"]').click()
    return
  }

  if (!lebenslaufVollstaendig()) {
    alert('Bitte fülle zuerst deinen Lebenslauf aus, bevor du dich bewirbst.')
    document.querySelector('.sidebar-item[data-view="lebenslauf"]').click()
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
