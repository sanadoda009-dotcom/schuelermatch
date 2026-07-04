import { supabase } from './supabase.js'
import { requireAuth, logout } from './session.js'
import { ICONS } from './icons.js'
import { ladeLebenslaufAlsPdf } from './pdf.js'
import { initSidebar } from './sidebar.js'
import { toast } from './toast.js'

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
  document.getElementById('profile-form').addEventListener('submit', speichereProfil)

  initSidebar((view) => {
    document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'))
    document.getElementById('view-' + view).classList.add('active')
  })

  const avatar = document.getElementById('sidebar-avatar')
  avatar.textContent = (profile.name || '?')[0].toUpperCase()
  document.getElementById('sidebar-name').textContent = profile.name || 'Firma'

  await ladeEigeneJobs()
}

// Bewerber-Ampel: bewertet auf einen Blick, wie gut ein Bewerber passt.
function bewerberAmpel(bewerber, job) {
  const verifiziert = Boolean(bewerber.verifiziert)
  const alterPasst = !job.mindestalter || (bewerber.alter_jahre && bewerber.alter_jahre >= job.mindestalter)
  const cvVoll = Array.isArray(bewerber.lebenslauf_bloecke) && bewerber.lebenslauf_bloecke.some(b => b.inhalt?.trim() || b.tags?.trim() || b.bild_url)

  const punkte = [verifiziert, alterPasst, cvVoll].filter(Boolean).length
  if (punkte === 3) return { klasse: 'ampel-gruen', text: 'Top-Match' }
  if (punkte === 2) return { klasse: 'ampel-gelb', text: 'Passt teils' }
  return { klasse: 'ampel-rot', text: 'Prüfen' }
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
  toast('Firmenprofil gespeichert!')
}

function sammleFormular() {
  return {
    titel: document.getElementById('job-titel').value,
    beschreibung: document.getElementById('job-beschreibung').value,
    kategorie: document.getElementById('job-kategorie').value || null,
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

  const warBearbeitung = Boolean(editingJobId)
  beendeBearbeitung()
  toast(warBearbeitung ? 'Job aktualisiert' : 'Job veröffentlicht! 🎉')
  await ladeEigeneJobs()
}

function starteBearbeitung(job) {
  editingJobId = job.id
  document.getElementById('job-titel').value = job.titel || ''
  document.getElementById('job-beschreibung').value = job.beschreibung || ''
  document.getElementById('job-kategorie').value = job.kategorie || ''
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
    .select('id, status, job_id, motivationsschreiben, zeugnis_url, bewerber:schueler_id(name, email, ort, alter_jahre, schule, klasse, foto_url, lebenslauf_bloecke, verifiziert)')
    .in('job_id', jobs.map(j => j.id))

  renderStats(jobs.length, bewerbungen?.length || 0)
  const offen = (bewerbungen || []).filter(b => (b.status || 'ausstehend') === 'ausstehend').length
  document.getElementById('badge-bewerbungen').textContent = offen > 0 ? offen : ''

  const bewerberByJob = {}
  ;(bewerbungen || []).forEach(b => {
    if (!bewerberByJob[b.job_id]) bewerberByJob[b.job_id] = []
    bewerberByJob[b.job_id].push(b)
  })

  list.innerHTML = jobs.map(job => {
    const bewerbungenFuerJob = bewerberByJob[job.id] || []
    return `
    <div class="job-card" style="${job.aktiv ? '' : 'opacity:0.65;'}">
      <div class="job-card-top">
        <div class="company-logo">${escapeHtml((job.titel || '?')[0].toUpperCase())}</div>
        <span class="job-badge ${job.aktiv ? '' : 'job-badge--pausiert'}">${job.aktiv ? `${ICONS.age} ab ${job.mindestalter} J.` : '⏸ Pausiert'}</span>
      </div>
      <h3>${escapeHtml(job.titel)}</h3>
      <p class="company-name">${ICONS.pin} ${escapeHtml(job.ort || '')}${job.kategorie ? ` <span class="kategorie-chip">${escapeHtml(job.kategorie)}</span>` : ''}</p>
      <div class="job-meta">
        ${job.stundenlohn ? `<span>${ICONS.money} ${job.stundenlohn} €/Std</span>` : ''}
        ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
      </div>
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button class="btn btn-outline" style="flex:1; padding:9px;" data-edit="${job.id}">Bearbeiten</button>
        <button class="btn btn-outline" style="flex:1; padding:9px;" data-pause="${job.id}" data-aktiv="${job.aktiv}">${job.aktiv ? 'Pausieren' : 'Aktivieren'}</button>
        <button class="btn btn-outline" style="flex:1; padding:9px; color:var(--coral);" data-delete="${job.id}">Löschen</button>
      </div>
      <div class="bewerber-list">
        <p class="bewerber-title">${bewerbungenFuerJob.length} Bewerbung(en)</p>
        ${bewerbungenFuerJob.map((b, idx) => `
          <div class="bewerber-item">
            <div style="display:flex; gap:10px; align-items:center;">
              <div class="cv-photo-preview" style="width:40px; height:40px; font-size:1rem; ${b.bewerber.foto_url ? `background-image:url(${b.bewerber.foto_url})` : ''}">${b.bewerber.foto_url ? '' : escapeHtml((b.bewerber.name || '?')[0].toUpperCase())}</div>
              <div>
                <strong>${escapeHtml(b.bewerber.name || 'Unbekannt')}</strong>, ${b.bewerber.alter_jahre || '?'} Jahre – ${escapeHtml(b.bewerber.ort || '')}
                <span class="ampel ${bewerberAmpel(b.bewerber, job).klasse}"><span class="ampel-dot"></span>${bewerberAmpel(b.bewerber, job).text}</span>
                <span class="status-badge status-${escapeHtml(b.status || 'ausstehend')}">${statusLabel(b.status)}</span><br>
                <a href="mailto:${escapeHtml(b.bewerber.email || '')}" class="mono">${escapeHtml(b.bewerber.email || '')}</a>
              </div>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px;">
              <button class="btn btn-dark" style="flex:1; padding:8px; font-size:0.82rem;" data-pdf-job="${job.id}" data-pdf-idx="${idx}">Lebenslauf (PDF)</button>
              ${b.zeugnis_url ? `<button class="btn btn-outline" style="flex:1; padding:8px; font-size:0.82rem;" data-zeugnis-job="${job.id}" data-zeugnis-idx="${idx}">Zeugnis</button>` : ''}
            </div>
            ${(b.status || 'ausstehend') === 'ausstehend' ? `
            <div style="display:flex; gap:8px; margin-top:8px;">
              <button class="btn btn-green" style="flex:1; padding:8px; font-size:0.82rem;" data-status-id="${b.id}" data-status-wert="angenommen" data-email="${escapeHtml(b.bewerber.email || '')}" data-name="${escapeHtml(b.bewerber.name || '')}" data-jobtitel="${escapeHtml(job.titel || '')}">Annehmen</button>
              <button class="btn btn-outline" style="flex:1; padding:8px; font-size:0.82rem; color:var(--coral);" data-status-id="${b.id}" data-status-wert="abgelehnt" data-email="${escapeHtml(b.bewerber.email || '')}" data-name="${escapeHtml(b.bewerber.name || '')}" data-jobtitel="${escapeHtml(job.titel || '')}">Ablehnen</button>
            </div>` : ''}
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
  list.querySelectorAll('[data-pause]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true
      const neuerWert = btn.dataset.aktiv !== 'true'
      const { error } = await supabase.from('jobs').update({ aktiv: neuerWert }).eq('id', btn.dataset.pause)
      if (error) {
        alert('Fehler: ' + error.message)
        btn.disabled = false
        return
      }
      await ladeEigeneJobs()
    })
  })
  list.querySelectorAll('[data-pdf-job]').forEach(btn => {
    btn.addEventListener('click', () => {
      const b = bewerberByJob[btn.dataset.pdfJob][btn.dataset.pdfIdx]
      btn.disabled = true
      btn.textContent = 'Wird erstellt...'
      ladeLebenslaufAlsPdf({ ...b.bewerber, bloecke: b.bewerber.lebenslauf_bloecke, motivationsschreiben: b.motivationsschreiben }).finally(() => {
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
  list.querySelectorAll('[data-status-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true
      const wert = btn.dataset.statusWert
      const { error } = await supabase
        .from('bewerbungen')
        .update({ status: wert })
        .eq('id', btn.dataset.statusId)
      if (error) {
        alert('Fehler: ' + error.message)
        btn.disabled = false
        return
      }
      toast(wert === 'angenommen' ? 'Bewerber angenommen ✓' : 'Bewerber abgelehnt')
      antwortMailAnbieten(wert, btn.dataset.email, btn.dataset.name, btn.dataset.jobtitel)
      await ladeEigeneJobs()
    })
  })
}

// Höfliche, vorformulierte Antwort-Mail (Zeit sparen für Arbeitgeber)
function antwortMailAnbieten(status, email, name, jobtitel) {
  if (!email) return
  const vorname = (name || '').split(' ')[0] || 'Hallo'
  let betreff, text
  if (status === 'angenommen') {
    betreff = `Deine Bewerbung bei uns – ${jobtitel}`
    text = `Hallo ${vorname},\n\nvielen Dank für deine Bewerbung als "${jobtitel}"! Wir würden dich gerne kennenlernen. Melde dich bitte kurz, wann es dir zeitlich passt.\n\nViele Grüße\n${profile.name || ''}`
  } else {
    betreff = `Deine Bewerbung – ${jobtitel}`
    text = `Hallo ${vorname},\n\nvielen Dank für dein Interesse an der Stelle "${jobtitel}" und die Mühe mit deiner Bewerbung. Wir haben uns diesmal für jemand anderen entschieden – das sagt nichts über dich aus, wir hatten viele gute Bewerbungen.\n\nBleib dran, du findest bestimmt bald etwas Passendes!\n\nViele Grüße\n${profile.name || ''}`
  }
  const mailto = `mailto:${email}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`
  if (confirm(status === 'angenommen'
    ? 'Bewerber angenommen! Möchtest du ihm direkt eine Zusage-Mail schreiben? (Text ist vorbereitet)'
    : 'Bewerber abgelehnt. Möchtest du ihm eine höfliche Absage-Mail schreiben? (Text ist vorbereitet)')) {
    window.location.href = mailto
  }
}

function statusLabel(status) {
  if (status === 'angenommen') return '✓ Angenommen'
  if (status === 'abgelehnt') return 'Abgelehnt'
  return 'Ausstehend'
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
