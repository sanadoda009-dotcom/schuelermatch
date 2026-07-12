import { supabase } from './supabase.js'
import { ICONS } from './icons.js'

let alleJobs = []
let aktiveKategorie = ''

// Deep-Links: jobs.html?q=nachhilfe&kategorie=Nachhilfe&ort=münchen&lohn=12&zeit=Wochenende&sort=lohn
function lieseUrlParameter() {
  const params = new URLSearchParams(window.location.search)
  const q = params.get('q')
  const kat = params.get('kategorie')
  const jobId = params.get('job')
  if (q) document.getElementById('filter-suche').value = q
  if (kat) setzeKategorie(kat)
  if (params.get('ort')) document.getElementById('filter-ort').value = params.get('ort')
  if (params.get('alter')) document.getElementById('filter-alter').value = params.get('alter')
  if (params.get('lohn')) document.getElementById('filter-gehalt').value = params.get('lohn')
  if (params.get('zeit')) document.getElementById('filter-arbeitszeit').value = params.get('zeit')
  if (params.get('sort')) document.getElementById('sortierung').value = params.get('sort')
  if (jobId) oeffneDetail(jobId)
}

// Filter-Zustand in die URL spiegeln -> jede Suche ist ein teilbarer Link
function schreibeUrlParameter() {
  const params = new URLSearchParams()
  const setzen = (key, wert) => { if (wert) params.set(key, wert) }
  setzen('q', document.getElementById('filter-suche').value.trim())
  setzen('kategorie', aktiveKategorie)
  setzen('ort', document.getElementById('filter-ort').value.trim())
  setzen('alter', document.getElementById('filter-alter').value)
  setzen('lohn', document.getElementById('filter-gehalt').value)
  setzen('zeit', document.getElementById('filter-arbeitszeit').value)
  const sort = document.getElementById('sortierung').value
  if (sort && sort !== 'neueste') params.set('sort', sort)
  const neu = params.toString()
  history.replaceState(null, '', neu ? `?${neu}` : location.pathname)
}

function filterZuruecksetzen() {
  document.getElementById('filter-suche').value = ''
  document.getElementById('filter-ort').value = ''
  document.getElementById('filter-alter').value = ''
  document.getElementById('filter-gehalt').value = ''
  document.getElementById('filter-arbeitszeit').value = ''
  document.getElementById('sortierung').value = 'neueste'
  setzeKategorie('')
  wendeFilterAn()
}

function istNeu(job) {
  return job.erstellt_am && (Date.now() - new Date(job.erstellt_am).getTime()) < 72 * 3600 * 1000
}

function passtZurSuche(job, suche) {
  if (!suche) return true
  return [job.titel, job.beschreibung, job.kategorie, job.ort]
    .some(feld => (feld || '').toLowerCase().includes(suche))
}

function setzeKategorie(kat) {
  aktiveKategorie = kat
  document.querySelectorAll('#kategorie-pills .pill').forEach(p => {
    p.classList.toggle('active', p.dataset.kat === kat)
  })
}

async function ladeJobs() {
  const grid = document.getElementById('jobs-grid')

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('aktiv', true)
    .order('erstellt_am', { ascending: false })

  if (error || !jobs?.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="14" width="36" height="26" rx="4"/><path d="M17 14v-3a4 4 0 014-4h6a4 4 0 014 4v3" stroke-linecap="round"/><path d="M6 24h36" /></svg>
        <p>Aktuell keine Jobs verfügbar. Schau bald wieder vorbei!</p>
      </div>`
    return
  }

  alleJobs = jobs

  document.getElementById('filter-suche').addEventListener('input', wendeFilterAn)
  document.getElementById('filter-ort').addEventListener('input', wendeFilterAn)
  document.getElementById('filter-alter').addEventListener('change', wendeFilterAn)
  document.getElementById('filter-gehalt').addEventListener('change', wendeFilterAn)
  document.getElementById('sortierung').addEventListener('change', wendeFilterAn)
  document.getElementById('filter-arbeitszeit').addEventListener('change', wendeFilterAn)
  document.querySelectorAll('#kategorie-pills .pill').forEach(p => {
    p.addEventListener('click', () => {
      setzeKategorie(p.dataset.kat)
      wendeFilterAn()
    })
  })

  lieseUrlParameter()
  wendeFilterAn()
}

function sortiereJobs(jobs, modus) {
  const kopie = [...jobs]
  if (modus === 'lohn') kopie.sort((a, b) => (b.stundenlohn || 0) - (a.stundenlohn || 0))
  else if (modus === 'alter') kopie.sort((a, b) => (a.mindestalter || 0) - (b.mindestalter || 0))
  // 'neueste' entspricht der Reihenfolge aus der Datenbank
  return kopie
}

function wendeFilterAn() {
  const suche = document.getElementById('filter-suche').value.trim().toLowerCase()
  const ort = document.getElementById('filter-ort').value.trim().toLowerCase()
  const alter = parseInt(document.getElementById('filter-alter').value) || null
  const gehalt = parseFloat(document.getElementById('filter-gehalt').value) || null
  const arbeitszeit = document.getElementById('filter-arbeitszeit').value
  const sortierung = document.getElementById('sortierung').value

  const gefiltert = alleJobs.filter(job => {
    if (!passtZurSuche(job, suche)) return false
    if (ort && !(job.ort || '').toLowerCase().includes(ort)) return false
    if (alter && job.mindestalter > alter) return false
    if (gehalt && !(job.stundenlohn >= gehalt)) return false
    if (aktiveKategorie && job.kategorie !== aktiveKategorie) return false
    if (arbeitszeit && job.arbeitszeit !== arbeitszeit) return false
    return true
  })

  renderJobs(sortiereJobs(gefiltert, sortierung))
  schreibeUrlParameter()
}

function renderJobs(jobs) {
  const grid = document.getElementById('jobs-grid')
  const zaehler = document.getElementById('jobs-count')
  if (zaehler) zaehler.textContent = `${jobs.length} Job${jobs.length === 1 ? '' : 's'} gefunden`

  if (!jobs.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="14" width="36" height="26" rx="4"/><path d="M17 14v-3a4 4 0 014-4h6a4 4 0 014 4v3" stroke-linecap="round"/><path d="M6 24h36" /></svg>
        <p>Keine Jobs passen zu diesem Filter.</p>
        <button type="button" class="btn btn-outline" id="filter-reset" style="margin-top:14px;">Filter zurücksetzen</button>
      </div>`
    document.getElementById('filter-reset')?.addEventListener('click', filterZuruecksetzen)
    return
  }

  grid.innerHTML = jobs.map(job => `
    <div class="job-card job-card--clickable" data-detail="${job.id}" role="button" tabindex="0" aria-label="Details zu ${escapeHtml(job.titel)}">
      ${istNeu(job) ? '<span class="neu-badge">NEU</span>' : ''}
      <div class="job-card-top">
        <div class="company-logo">${escapeHtml((job.titel || '?')[0].toUpperCase())}</div>
        <span class="job-badge">${ICONS.age} ab ${job.mindestalter} J.</span>
      </div>
      <h3>${escapeHtml(job.titel)}</h3>
      <p class="company-name">${ICONS.pin} ${escapeHtml(job.ort || '')}${job.kategorie ? ` <span class="kategorie-chip">${escapeHtml(job.kategorie)}</span>` : ''}${job.arbeitszeit ? ` <span class="arbeitszeit-chip">🕐 ${escapeHtml(job.arbeitszeit)}</span>` : ''}</p>
      ${job.beschreibung ? `<p class="job-description">${escapeHtml(job.beschreibung)}</p>` : ''}
      <div class="job-meta">
        ${job.stundenlohn ? `<span class="lohn-highlight">${job.stundenlohn} €/Std</span>` : ''}
        ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
      </div>
    </div>
  `).join('')

  grid.querySelectorAll('[data-detail]').forEach(karte => {
    karte.addEventListener('click', () => oeffneDetail(karte.dataset.detail))
    karte.addEventListener('keydown', e => { if (e.key === 'Enter') oeffneDetail(karte.dataset.detail) })
  })
}

function oeffneDetail(jobId) {
  const job = alleJobs.find(j => j.id === jobId)
  if (!job) return

  supabase.rpc('job_aufruf_zaehlen', { p_job: jobId }) // Aufruf zählen (Fehler ignorieren)

  document.getElementById('detail-titel').textContent = job.titel
  document.getElementById('detail-body').innerHTML = `
    <p class="company-name" style="margin-top:4px;">${ICONS.pin} ${escapeHtml(job.ort || '')}${job.kategorie ? ` <span class="kategorie-chip">${escapeHtml(job.kategorie)}</span>` : ''}${job.arbeitszeit ? ` <span class="arbeitszeit-chip">🕐 ${escapeHtml(job.arbeitszeit)}</span>` : ''}</p>
    <div class="job-meta" style="margin:14px 0;">
      <span>${ICONS.age} ab ${job.mindestalter} Jahren</span>
      ${job.stundenlohn ? `<span class="lohn-highlight">${job.stundenlohn} €/Std</span>` : ''}
      ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
    </div>
    ${job.beschreibung ? `<p style="font-size:0.95rem; line-height:1.7; color:var(--ink); white-space:pre-wrap;">${escapeHtml(job.beschreibung)}</p>` : '<p class="cv-preview-empty">Keine weitere Beschreibung vorhanden.</p>'}
    <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
      <a href="job.html?id=${job.id}" class="share-btn" style="text-decoration:none;">Als eigene Seite öffnen ↗</a>
      <button type="button" class="share-btn" id="detail-share">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Link kopieren
      </button>
    </div>
  `
  document.getElementById('detail-share').addEventListener('click', async (e) => {
    const link = `${location.origin}/job.html?id=${job.id}`
    try {
      await navigator.clipboard.writeText(link)
      e.currentTarget.textContent = '✓ Kopiert!'
    } catch {
      prompt('Link zum Kopieren:', link)
    }
  })
  document.getElementById('job-detail-overlay').classList.add('open')
}

document.getElementById('detail-close')?.addEventListener('click', () => {
  document.getElementById('job-detail-overlay').classList.remove('open')
})
document.getElementById('job-detail-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'job-detail-overlay') e.target.classList.remove('open')
})

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

ladeJobs()
