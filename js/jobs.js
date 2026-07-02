import { supabase } from './supabase.js'
import { ICONS } from './icons.js'

let alleJobs = []

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
  renderJobs(alleJobs)

  document.getElementById('filter-suche').addEventListener('input', wendeFilterAn)
  document.getElementById('filter-ort').addEventListener('input', wendeFilterAn)
  document.getElementById('filter-alter').addEventListener('change', wendeFilterAn)
  document.getElementById('filter-gehalt').addEventListener('change', wendeFilterAn)
  document.getElementById('filter-kategorie').addEventListener('change', wendeFilterAn)
  document.getElementById('sortierung').addEventListener('change', wendeFilterAn)
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
  const kategorie = document.getElementById('filter-kategorie').value
  const sortierung = document.getElementById('sortierung').value

  const gefiltert = alleJobs.filter(job => {
    if (suche && !(job.titel || '').toLowerCase().includes(suche)) return false
    if (ort && !(job.ort || '').toLowerCase().includes(ort)) return false
    if (alter && job.mindestalter > alter) return false
    if (gehalt && !(job.stundenlohn >= gehalt)) return false
    if (kategorie && job.kategorie !== kategorie) return false
    return true
  })

  renderJobs(sortiereJobs(gefiltert, sortierung))
}

function renderJobs(jobs) {
  const grid = document.getElementById('jobs-grid')

  if (!jobs.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="14" width="36" height="26" rx="4"/><path d="M17 14v-3a4 4 0 014-4h6a4 4 0 014 4v3" stroke-linecap="round"/><path d="M6 24h36" /></svg>
        <p>Keine Jobs passen zu diesem Filter.</p>
      </div>`
    return
  }

  grid.innerHTML = jobs.map(job => `
    <div class="job-card">
      <div class="job-card-top">
        <div class="company-logo">${escapeHtml((job.titel || '?')[0].toUpperCase())}</div>
        <span class="job-badge">${ICONS.age} ab ${job.mindestalter} J.</span>
      </div>
      <h3>${escapeHtml(job.titel)}</h3>
      <p class="company-name">${ICONS.pin} ${escapeHtml(job.ort || '')}${job.kategorie ? ` <span class="kategorie-chip">${escapeHtml(job.kategorie)}</span>` : ''}</p>
      ${job.beschreibung ? `<p class="job-description">${escapeHtml(job.beschreibung)}</p>` : ''}
      <div class="job-meta">
        ${job.stundenlohn ? `<span>${ICONS.money} ${job.stundenlohn} €/Std</span>` : ''}
        ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
      </div>
    </div>
  `).join('')
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

ladeJobs()
