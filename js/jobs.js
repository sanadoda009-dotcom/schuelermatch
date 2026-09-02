import { supabase } from './supabase.js'
import { ICONS } from './icons.js'
import { passtZurSuche } from './suche.js'
import { hole, zeigeLadefehler } from './zustand.js'
import { meldeMitAnmeldung, meldeButtonHtml } from './melden.js'
import { jobKarteHtml, istNeu } from './job-karte.js'

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

function setzeKategorie(kat) {
  aktiveKategorie = kat
  document.querySelectorAll('#kategorie-pills .pill').forEach(p => {
    p.classList.toggle('active', p.dataset.kat === kat)
  })
}

async function ladeJobs() {
  const grid = document.getElementById('jobs-grid')

  const { data: jobs, gestoert } = await hole(supabase
    .from('jobs')
    .select('*')
    .eq('aktiv', true)
    .order('erstellt_am', { ascending: false }))

  // Eine Server-Stoerung darf nicht als "es gibt keine Jobs" erscheinen.
  if (gestoert) {
    zeigeLadefehler(grid, ladeJobs, 'Die Jobs konnten gerade nicht geladen werden.')
    return
  }

  if (!jobs?.length) {
    // Ein Leerzustand braucht eine Tür, keine Wegbeschreibung.
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="14" width="36" height="26" rx="4"/><path d="M17 14v-3a4 4 0 014-4h6a4 4 0 014 4v3" stroke-linecap="round"/><path d="M6 24h36" /></svg>
        <p>Gerade ist keine einzige Anzeige online.</p>
        <p class="fehler-hinweis">Leg dir jetzt ein Profil an – dann kannst du dich sofort bewerben, wenn die ersten Jobs kommen.</p>
        <div class="fehler-knoepfe">
          <a class="btn btn-green" href="register.html">Profil anlegen</a>
          <a class="btn btn-outline" href="register.html?rolle=firma">Ich suche Schüler</a>
        </div>
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

  document.getElementById('filter-reset-alle')?.addEventListener('click', () => {
    filterZuruecksetzen()
    document.getElementById('filter-panel')?.classList.remove('offen')
    document.getElementById('filter-hintergrund')?.classList.remove('offen')
    document.body.style.overflow = ''
  })
  initFilterPanel()

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
    // Ohne Altersangabe laesst sich nicht sagen, ob die Anzeige fuer
    // dieses Alter erlaubt ist – also nicht zeigen, solange gefiltert wird.
    // `null > alter` ist falsch, so eine Anzeige rutschte vorher durch
    // jeden Altersfilter.
    if (alter && (job.mindestalter == null || job.mindestalter > alter)) return false
    if (gehalt && !(job.stundenlohn >= gehalt)) return false
    if (aktiveKategorie && job.kategorie !== aktiveKategorie) return false
    if (arbeitszeit && job.arbeitszeit !== arbeitszeit) return false
    return true
  })

  renderJobs(sortiereJobs(gefiltert, sortierung))
  schreibeUrlParameter()
  zeigeAktiveFilter()
}

/* ---------- AKTIVE FILTER SICHTBAR MACHEN ---------- */

// Alle Filter ausser der Freitextsuche: als entfernbare Chips ueber den
// Ergebnissen. So sieht man auf einen Blick, warum weniger Jobs erscheinen.
function aktiveFilterListe() {
  const liste = []
  const wert = id => document.getElementById(id).value
  if (aktiveKategorie) liste.push({ id: 'kategorie', text: aktiveKategorie })
  if (wert('filter-ort').trim()) liste.push({ id: 'filter-ort', text: 'Ort: ' + wert('filter-ort').trim() })
  if (wert('filter-alter')) liste.push({ id: 'filter-alter', text: wert('filter-alter') + ' Jahre' })
  if (wert('filter-gehalt')) liste.push({ id: 'filter-gehalt', text: 'ab ' + wert('filter-gehalt') + ' €/Std' })
  if (wert('filter-arbeitszeit')) liste.push({ id: 'filter-arbeitszeit', text: wert('filter-arbeitszeit') })
  return liste
}

function zeigeAktiveFilter() {
  const aktiv = aktiveFilterListe()
  const box = document.getElementById('aktive-filter')

  // Zaehler am Filter-Knopf (nur Handy sichtbar)
  const zaehler = document.getElementById('filter-anzahl')
  if (zaehler) zaehler.textContent = aktiv.length ? String(aktiv.length) : ''

  if (!box) return
  box.innerHTML = aktiv.map(f =>
    `<span class="filter-chip">${escapeHtml(f.text)}
       <button type="button" data-weg="${f.id}" aria-label="Filter ${escapeHtml(f.text)} entfernen">×</button>
     </span>`).join('')

  box.querySelectorAll('[data-weg]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ziel = btn.dataset.weg
      if (ziel === 'kategorie') setzeKategorie('')
      else document.getElementById(ziel).value = ''
      wendeFilterAn()
    })
  })
}

/* ---------- FILTER-PANEL AUF DEM HANDY ---------- */

function initFilterPanel() {
  const panel = document.getElementById('filter-panel')
  const hintergrund = document.getElementById('filter-hintergrund')
  const oeffnen = document.getElementById('filter-oeffnen')
  const schliessenBtn = document.getElementById('filter-schliessen')
  if (!panel || !oeffnen) return

  const setzeOffen = (offen) => {
    panel.classList.toggle('offen', offen)
    hintergrund?.classList.toggle('offen', offen)
    oeffnen.setAttribute('aria-expanded', String(offen))
    document.body.style.overflow = offen ? 'hidden' : ''
  }

  oeffnen.addEventListener('click', () => setzeOffen(!panel.classList.contains('offen')))
  schliessenBtn?.addEventListener('click', () => setzeOffen(false))
  hintergrund?.addEventListener('click', () => setzeOffen(false))
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setzeOffen(false) })
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

  grid.innerHTML = jobs.map(job => jobKarteHtml(job, { klickbar: true })).join('')

  grid.querySelectorAll('[data-detail]').forEach(karte => {
    karte.addEventListener('click', () => oeffneDetail(karte.dataset.detail))
    // role="button" heisst fuer Tastaturnutzer: Enter UND Leertaste muessen ausloesen.
    karte.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()   // sonst scrollt die Leertaste die Seite
      oeffneDetail(karte.dataset.detail)
    })
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
      <span>${ICONS.age} ${job.mindestalter == null ? 'Alter auf Anfrage' : `ab ${job.mindestalter} Jahren`}</span>
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
      ${meldeButtonHtml('id="detail-melden"')}
    </div>
  `
  // Melden von der Jobboerse aus. Bis zum 27.8. gab es den Knopf nur im
  // Chat und im Dashboard - also nirgends dort, wo eine Betrugsanzeige
  // am ehesten gesehen wird.
  document.getElementById('detail-melden').addEventListener('click', () =>
    meldeMitAnmeldung({ typ: 'job', jobId: job.id, titel: job.titel, zitat: [job.titel, job.firma_name].filter(Boolean).join(' · ') }))

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
