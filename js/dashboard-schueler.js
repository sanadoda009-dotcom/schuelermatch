import { supabase } from './supabase.js'
import { requireAuth, logout } from './session.js'
import { ICONS } from './icons.js'
import { ladeLebenslaufAlsPdf } from './pdf.js'
import { initSidebar } from './sidebar.js'

let profile
let bloecke = []
let aktuelleBewerbung = null // { jobId, btn, zeugnisDatei }

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
  document.getElementById('cv-schule').addEventListener('input', renderCvPreview)
  document.getElementById('cv-klasse').addEventListener('change', renderCvPreview)
  setzePhotoPreview(profile.foto_url)

  bloecke = Array.isArray(profile.lebenslauf_bloecke) && profile.lebenslauf_bloecke.length
    ? profile.lebenslauf_bloecke
    : [
        { id: cryptoId(), typ: 'text', titel: 'Über mich', inhalt: '' },
        { id: cryptoId(), typ: 'text', titel: 'Erfahrung', inhalt: '' }
      ]

  document.querySelectorAll('.block-add-btn').forEach(btn => {
    btn.addEventListener('click', () => neuerBlock(btn.dataset.add))
  })

  document.getElementById('cv-save-btn').addEventListener('click', speichereLebenslauf)
  document.getElementById('cv-foto-btn').addEventListener('click', () => document.getElementById('cv-foto').click())
  document.getElementById('cv-foto').addEventListener('change', ladeFotoHoch)
  document.getElementById('cv-download-btn').addEventListener('click', () => {
    ladeLebenslaufAlsPdf({
      ...profile,
      schule: document.getElementById('cv-schule').value,
      klasse: document.getElementById('cv-klasse').value,
      bloecke
    })
  })

  // Verifizierung
  document.getElementById('ausweis-btn').addEventListener('click', () => document.getElementById('ausweis-datei').click())
  document.getElementById('ausweis-datei').addEventListener('change', (e) => ladeVerifizierungsDokument(e, 'ausweis', 'schuelerausweis_url'))
  document.getElementById('bestaetigung-btn').addEventListener('click', () => document.getElementById('bestaetigung-datei').click())
  document.getElementById('bestaetigung-datei').addEventListener('change', (e) => ladeVerifizierungsDokument(e, 'bestaetigung', 'schulbestaetigung_url'))

  // Bewerbungs-Modal
  document.getElementById('bewerbung-close').addEventListener('click', schliesseModal)
  document.getElementById('bewerbung-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'bewerbung-overlay') schliesseModal()
  })
  document.getElementById('bewerbung-form').addEventListener('submit', sendeBewerbung)
  document.getElementById('bewerbung-zeugnis-btn').addEventListener('click', () => document.getElementById('bewerbung-zeugnis').click())
  document.getElementById('bewerbung-zeugnis').addEventListener('change', (e) => {
    aktuelleBewerbung.zeugnisDatei = e.target.files[0]
    document.getElementById('bewerbung-zeugnis-status').textContent = e.target.files[0]?.name || 'Kein Zeugnis ausgewählt'
  })

  renderVerifyStatus()
  renderBlockEditor()
  renderCvPreview()

  await ladeJobs()
}

function zeigeView(view) {
  document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'))
  document.getElementById('view-' + view).classList.add('active')
  if (view === 'lebenslauf') renderCvPreview()
}

function cryptoId() {
  return 'b' + Math.random().toString(36).slice(2, 10)
}

/* ---------- BLOCK-EDITOR ---------- */

function neuerBlock(typ) {
  const basis = { id: cryptoId(), typ, titel: '' }
  if (typ === 'text') basis.inhalt = ''
  if (typ === 'skills') basis.tags = ''
  if (typ === 'bild') basis.bild_url = ''
  bloecke.push(basis)
  renderBlockEditor()
  renderCvPreview()
}

function verschiebeBlock(id, richtung) {
  const idx = bloecke.findIndex(b => b.id === id)
  const neuerIndex = idx + richtung
  if (neuerIndex < 0 || neuerIndex >= bloecke.length) return
  ;[bloecke[idx], bloecke[neuerIndex]] = [bloecke[neuerIndex], bloecke[idx]]
  renderBlockEditor()
  renderCvPreview()
}

function loescheBlock(id) {
  bloecke = bloecke.filter(b => b.id !== id)
  renderBlockEditor()
  renderCvPreview()
}

function typLabel(typ) {
  if (typ === 'text') return 'Text'
  if (typ === 'skills') return 'Fähigkeiten'
  if (typ === 'bild') return 'Bild'
  return typ
}

function renderBlockEditor() {
  const list = document.getElementById('block-list')

  list.innerHTML = bloecke.map(b => `
    <div class="block-item" data-block-id="${b.id}">
      <div class="block-item-head">
        <span class="block-type-label">${typLabel(b.typ)}</span>
        <input type="text" class="block-titel-input" placeholder="Titel (optional)" value="${escapeHtml(b.titel || '')}">
        <div class="block-item-controls">
          <button type="button" data-move-up title="Nach oben">↑</button>
          <button type="button" data-move-down title="Nach unten">↓</button>
          <button type="button" data-delete title="Löschen">✕</button>
        </div>
      </div>
      ${b.typ === 'text' ? `<textarea class="block-inhalt-input" placeholder="Dein Text...">${escapeHtml(b.inhalt || '')}</textarea>` : ''}
      ${b.typ === 'skills' ? `<input type="text" class="block-tags-input" placeholder="Komma-getrennt, z.B. Zuverlässig, Teamfähig" value="${escapeHtml(b.tags || '')}">` : ''}
      ${b.typ === 'bild' ? `
        <input type="file" class="block-bild-input" accept="image/*" style="display:none;">
        <button type="button" class="btn btn-outline block-bild-btn" style="padding:8px 14px; font-size:0.82rem;">Bild auswählen</button>
        ${b.bild_url ? `<img src="${b.bild_url}" class="block-image-preview">` : ''}
      ` : ''}
    </div>
  `).join('')

  list.querySelectorAll('.block-item').forEach(el => {
    const id = el.dataset.blockId
    const block = bloecke.find(b => b.id === id)

    el.querySelector('.block-titel-input').addEventListener('input', e => { block.titel = e.target.value; renderCvPreview() })
    el.querySelector('.block-inhalt-input')?.addEventListener('input', e => { block.inhalt = e.target.value; renderCvPreview() })
    el.querySelector('.block-tags-input')?.addEventListener('input', e => { block.tags = e.target.value; renderCvPreview() })
    el.querySelector('[data-move-up]').addEventListener('click', () => verschiebeBlock(id, -1))
    el.querySelector('[data-move-down]').addEventListener('click', () => verschiebeBlock(id, 1))
    el.querySelector('[data-delete]').addEventListener('click', () => loescheBlock(id))

    const bildBtn = el.querySelector('.block-bild-btn')
    const bildInput = el.querySelector('.block-bild-input')
    if (bildBtn) {
      bildBtn.addEventListener('click', () => bildInput.click())
      bildInput.addEventListener('change', (e) => ladeBlockBildHoch(id, e.target.files[0]))
    }
  })
}

async function ladeBlockBildHoch(blockId, file) {
  if (!file) return
  const block = bloecke.find(b => b.id === blockId)

  const ext = file.name.split('.').pop()
  const path = `${profile.id}/${blockId}.${ext}`

  const { error: uploadError } = await supabase.storage.from('lebenslauf-bilder').upload(path, file, { upsert: true })
  if (uploadError) {
    alert('Fehler beim Hochladen: ' + uploadError.message)
    return
  }

  const { data } = supabase.storage.from('lebenslauf-bilder').getPublicUrl(path)
  block.bild_url = data.publicUrl + '?t=' + Date.now()
  renderBlockEditor()
  renderCvPreview()
}

function renderCvPreview() {
  const name = profile.name || 'Dein Name'
  const schule = document.getElementById('cv-schule').value
  const klasse = document.getElementById('cv-klasse').value
  const fotoUrl = profile.foto_url

  const blockHtml = bloecke.map(b => {
    if (b.typ === 'text') {
      return `<div class="cv-preview-section">${b.titel ? `<h4>${escapeHtml(b.titel)}</h4>` : ''}${b.inhalt ? `<p>${escapeHtml(b.inhalt)}</p>` : '<p class="cv-preview-empty">Noch keine Angaben</p>'}</div>`
    }
    if (b.typ === 'skills') {
      const tags = (b.tags || '').split(',').map(t => t.trim()).filter(Boolean)
      return `<div class="cv-preview-section"><h4>${escapeHtml(b.titel || 'Fähigkeiten')}</h4>${tags.length ? `<div class="cv-tags">${tags.map(t => `<span class="cv-tag">${escapeHtml(t)}</span>`).join('')}</div>` : '<p class="cv-preview-empty">Noch keine Angaben</p>'}</div>`
    }
    if (b.typ === 'bild') {
      return `<div class="cv-preview-section">${b.titel ? `<h4>${escapeHtml(b.titel)}</h4>` : ''}${b.bild_url ? `<img src="${b.bild_url}" style="max-width:100%; border-radius:10px;">` : '<p class="cv-preview-empty">Noch kein Bild hochgeladen</p>'}</div>`
    }
    return ''
  }).join('')

  document.getElementById('cv-preview').innerHTML = `
    <div class="cv-preview-header">
      <div class="cv-preview-photo" style="${fotoUrl ? `background-image:url(${fotoUrl})` : ''}">${fotoUrl ? '' : escapeHtml(name[0]?.toUpperCase() || '?')}</div>
      <div>
        <div class="cv-preview-name">${escapeHtml(name)}</div>
        <div class="cv-preview-school">${escapeHtml(schule || 'Schule noch nicht angegeben')}${klasse ? ' · ' + escapeHtml(klasse) : ''}</div>
      </div>
    </div>
    ${blockHtml}
  `
}

async function speichereLebenslauf() {
  const btn = document.getElementById('cv-save-btn')
  btn.disabled = true
  btn.textContent = 'Speichert...'

  const updates = {
    schule: document.getElementById('cv-schule').value,
    klasse: document.getElementById('cv-klasse').value,
    lebenslauf_bloecke: bloecke
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
  const hatInhalt = bloecke.some(b =>
    (b.typ === 'text' && b.inhalt?.trim()) ||
    (b.typ === 'skills' && b.tags?.trim()) ||
    (b.typ === 'bild' && b.bild_url)
  )
  return Boolean(profile.schule && hatInhalt)
}

/* ---------- VERIFIZIERUNG ---------- */

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

/* ---------- PROFIL ---------- */

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

/* ---------- JOBS & BEWERBUNG ---------- */

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
      <button class="btn ${beworbenIds.has(job.id) ? 'btn-outline' : 'btn-green'} btn-full" style="margin-top:14px;" data-job-id="${job.id}" data-job-titel="${escapeHtml(job.titel)}" ${beworbenIds.has(job.id) ? 'disabled' : ''}>
        ${beworbenIds.has(job.id) ? 'Bereits beworben' : 'Jetzt bewerben'}
      </button>
    </div>
  `).join('')

  grid.querySelectorAll('button[data-job-id]').forEach(btn => {
    btn.addEventListener('click', () => oeffneBewerbungsModal(btn.dataset.jobId, btn.dataset.jobTitel, btn))
  })
}

function oeffneBewerbungsModal(jobId, jobTitel, btn) {
  if (!profile.verifiziert) {
    alert('Du musst dich erst als Schüler verifizieren, bevor du dich bewerben kannst.')
    document.querySelector('.sidebar-item[data-view="verifizierung"]').click()
    return
  }

  if (!lebenslaufVollstaendig()) {
    alert('Bitte fülle zuerst deinen Lebenslauf aus (Schule + mind. ein Abschnitt), bevor du dich bewirbst.')
    document.querySelector('.sidebar-item[data-view="lebenslauf"]').click()
    return
  }

  aktuelleBewerbung = { jobId, btn, zeugnisDatei: null }
  document.getElementById('bewerbung-job-titel').textContent = jobTitel
  document.getElementById('bewerbung-motivation').value = ''
  document.getElementById('bewerbung-zeugnis-status').textContent = 'Kein Zeugnis ausgewählt'
  document.getElementById('bewerbung-overlay').classList.add('open')
}

function schliesseModal() {
  document.getElementById('bewerbung-overlay').classList.remove('open')
  aktuelleBewerbung = null
}

async function sendeBewerbung(e) {
  e.preventDefault()
  const btn = e.target.querySelector('button[type=submit]')
  btn.disabled = true
  btn.textContent = 'Wird gesendet...'

  const { jobId, zeugnisDatei } = aktuelleBewerbung
  let zeugnis_url = null

  if (zeugnisDatei) {
    const ext = zeugnisDatei.name.split('.').pop()
    const path = `${profile.id}/${jobId}/zeugnis.${ext}`
    const { error: uploadError } = await supabase.storage.from('zeugnisse').upload(path, zeugnisDatei, { upsert: true })
    if (uploadError) {
      alert('Fehler beim Hochladen des Zeugnisses: ' + uploadError.message)
      btn.disabled = false
      btn.textContent = 'Bewerbung absenden'
      return
    }
    zeugnis_url = path
  }

  const { error } = await supabase.from('bewerbungen').insert({
    job_id: jobId,
    schueler_id: profile.id,
    motivationsschreiben: document.getElementById('bewerbung-motivation').value,
    zeugnis_url
  })

  btn.disabled = false
  btn.textContent = 'Bewerbung absenden'

  if (error) {
    alert('Fehler beim Absenden: ' + error.message)
    return
  }

  const jobBtn = aktuelleBewerbung.btn
  jobBtn.textContent = 'Bereits beworben'
  jobBtn.disabled = true
  jobBtn.classList.remove('btn-green')
  jobBtn.classList.add('btn-outline')

  schliesseModal()
  await ladeJobs()
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
