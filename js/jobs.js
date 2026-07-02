import { supabase } from './supabase.js'
import { ICONS } from './icons.js'

let alleJobs = []
let aktiveKategorie = ''

// Deep-Links: jobs.html?q=nachhilfe&kategorie=Nachhilfe
function lieseUrlParameter() {
  const params = new URLSearchParams(window.location.search)
  const q = params.get('q')
  const kat = params.get('kategorie')
  if (q) document.getElementById('filter-suche').value = q
  if (kat) setzeKategorie(kat)
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
  const sortierung = document.getElementById('sortierung').value

  const gefiltert = alleJobs.filter(job => {
    if (suche && !(job.titel || '').toLowerCase().includes(suche)) return false
    if (ort && !(job.ort || '').toLowerCase().includes(ort)) return false
    if (alter && job.mindestalter > alter) return false
    if (gehalt && !(job.stundenlohn >= gehalt)) return false
    if (aktiveKategorie && job.kategorie !== aktiveKategorie) return false
    return true
  })

  renderJobs(sortiereJobs(gefiltert, sortierung))
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
      </div>`
    return
  }

  grid.innerHTML = jobs.map(job => `
    <div class="job-card job-card--clickable" data-detail="${job.id}" role="button" tabindex="0" aria-label="Details zu ${escapeHtml(job.titel)}">
      <div class="job-card-top">
        <div class="company-logo">${escapeHtml((job.titel || '?')[0].toUpperCase())}</div>
        <span class="job-badge">${ICONS.age} ab ${job.mindestalter} J.</span>
      </div>
      <h3>${escapeHtml(job.titel)}</h3>
      <p class="company-name">${ICONS.pin} ${escapeHtml(job.ort || '')}${job.kategorie ? ` <span class="kategorie-chip">${escapeHtml(job.kategorie)}</span>` : ''}</p>
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

  document.getElementById('detail-titel').textContent = job.titel
  document.getElementById('detail-body').innerHTML = `
    <p class="company-name" style="margin-top:4px;">${ICONS.pin} ${escapeHtml(job.ort || '')}${job.kategorie ? ` <span class="kategorie-chip">${escapeHtml(job.kategorie)}</span>` : ''}</p>
    <div class="job-meta" style="margin:14px 0;">
      <span>${ICONS.age} ab ${job.mindestalter} Jahren</span>
      ${job.stundenlohn ? `<span class="lohn-highlight">${job.stundenlohn} €/Std</span>` : ''}
      ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
    </div>
    ${job.beschreibung ? `<p style="font-size:0.95rem; line-height:1.7; color:var(--ink); white-space:pre-wrap;">${escapeHtml(job.beschreibung)}</p>` : '<p class="cv-preview-empty">Keine weitere Beschreibung vorhanden.</p>'}
  `
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
