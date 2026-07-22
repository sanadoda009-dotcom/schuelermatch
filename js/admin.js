// Admin-Bereich: Schüler-Verifizierungen prüfen und freischalten.
// Zugriff nur für Profile mit ist_admin = true (per RLS zusätzlich in der DB abgesichert).

import { supabase } from './supabase.js'
import { requireAuth, logout } from './session.js'
import { toast } from './toast.js'

let profile
let alleSchueler = []
let filter = 'offen'
let alleFirmen = []
let firmaFilter = 'neu'

const DOKUMENTE = [
  { spalte: 'schuelerausweis_url', label: 'Schülerausweis' },
  { spalte: 'schulbestaetigung_url', label: 'Schulbestätigung' }
]

async function init() {
  profile = await requireAuth()
  if (!profile) return

  if (!profile.ist_admin) {
    document.querySelector('main').innerHTML =
      '<div class="empty-state"><p>Dieser Bereich ist nur für Administratoren.</p></div>'
    return
  }

  document.getElementById('logout-btn').addEventListener('click', logout)
  document.getElementById('dok-close').addEventListener('click', schliesseDok)
  document.getElementById('dok-overlay').addEventListener('click', e => {
    if (e.target.id === 'dok-overlay') schliesseDok()
  })
  document.querySelectorAll('#admin-filter .pill').forEach(p => {
    p.addEventListener('click', () => {
      filter = p.dataset.af
      document.querySelectorAll('#admin-filter .pill').forEach(x => x.classList.toggle('active', x.dataset.af === filter))
      render()
    })
  })

  // Reiter-Umschaltung Schüler / Firmen
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(x => x.classList.toggle('active', x === t))
      document.getElementById('panel-schueler').classList.toggle('active', t.dataset.tab === 'schueler')
      document.getElementById('panel-firmen').classList.toggle('active', t.dataset.tab === 'firmen')
    })
  })
  document.querySelectorAll('#firma-filter .pill').forEach(p => {
    p.addEventListener('click', () => {
      firmaFilter = p.dataset.ff
      document.querySelectorAll('#firma-filter .pill').forEach(x => x.classList.toggle('active', x.dataset.ff === firmaFilter))
      renderFirmen()
    })
  })

  await Promise.all([ladeSchueler(), ladeFirmen()])
}

async function ladeSchueler() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, alter_jahre, ort, schule, klasse, verifiziert, schuelerausweis_url, schulbestaetigung_url, erstellt_am')
    .eq('role', 'schueler')
    .order('erstellt_am', { ascending: false })

  if (error) {
    document.getElementById('admin-liste').innerHTML =
      `<div class="empty-state"><p>Konnte nicht laden: ${escapeHtml(error.message)}</p></div>`
    return
  }
  alleSchueler = data || []
  render()
}

function hatDokument(s) {
  return Boolean(s.schuelerausweis_url || s.schulbestaetigung_url)
}

// "Zu prüfen" = Dokument liegt vor, aber noch nicht freigeschaltet
function istOffen(s) {
  return hatDokument(s) && !s.verifiziert
}

function render() {
  const offen = alleSchueler.filter(istOffen).length
  const verifiziert = alleSchueler.filter(s => s.verifiziert).length

  document.getElementById('admin-stats').innerHTML = `
    <div class="stat-box"><b>${offen}</b><span>Zu prüfen</span></div>
    <div class="stat-box"><b>${verifiziert}</b><span>Verifiziert</span></div>
    <div class="stat-box"><b>${alleSchueler.length}</b><span>Schüler gesamt</span></div>`

  let liste = alleSchueler
  if (filter === 'offen') liste = alleSchueler.filter(istOffen)
  else if (filter === 'verifiziert') liste = alleSchueler.filter(s => s.verifiziert)

  const box = document.getElementById('admin-liste')
  if (!liste.length) {
    box.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M24 6l14 6v10c0 9-6 16-14 19-8-3-14-10-14-19V12l14-6z"/><path d="M18 24l4 4 8-8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <p>${filter === 'offen' ? 'Nichts zu prüfen – alles erledigt! 🎉' : 'Keine Einträge.'}</p>
      </div>`
    return
  }

  box.innerHTML = liste.map(s => karte(s)).join('')

  box.querySelectorAll('[data-dok]').forEach(btn =>
    btn.addEventListener('click', () => zeigeDokument(btn.dataset.dok, btn.dataset.spalte, btn.dataset.name)))
  box.querySelectorAll('[data-frei]').forEach(btn =>
    btn.addEventListener('click', () => entscheide(btn.dataset.frei, true, btn)))
  box.querySelectorAll('[data-ablehnen]').forEach(btn =>
    btn.addEventListener('click', () => entscheide(btn.dataset.ablehnen, false, btn)))
  box.querySelectorAll('[data-zurueckziehen]').forEach(btn =>
    btn.addEventListener('click', () => zurueckziehen(btn.dataset.zurueckziehen, btn)))
}

function karte(s) {
  const dokButtons = DOKUMENTE
    .filter(d => s[d.spalte])
    .map(d => `<button type="button" class="btn btn-dark admin-dok-btn" data-dok="${escapeHtml(s[d.spalte])}" data-spalte="${d.spalte}" data-name="${escapeHtml(s.name || '')}">📄 ${d.label} ansehen</button>`)
    .join('')

  const status = s.verifiziert
    ? '<span class="admin-status admin-status--ok">✓ Verifiziert</span>'
    : hatDokument(s)
      ? '<span class="admin-status admin-status--warten">⏳ Wartet auf Prüfung</span>'
      : '<span class="admin-status admin-status--keins">Kein Dokument hochgeladen</span>'

  const aktionen = s.verifiziert
    ? `<button type="button" class="btn btn-outline" style="color:var(--coral);" data-zurueckziehen="${s.id}">Verifizierung zurückziehen</button>`
    : hatDokument(s)
      ? `<button type="button" class="btn btn-green" data-frei="${s.id}">✓ Freischalten</button>
         <button type="button" class="btn btn-outline" style="color:var(--coral);" data-ablehnen="${s.id}">Ablehnen</button>`
      : ''

  return `
    <div class="admin-karte">
      <div class="admin-karte-kopf">
        <div>
          <b>${escapeHtml(s.name || 'Ohne Namen')}</b>
          <span class="admin-meta">${s.alter_jahre ? s.alter_jahre + ' Jahre' : 'Alter unbekannt'}${s.ort ? ' · ' + escapeHtml(s.ort) : ''}</span>
        </div>
        ${status}
      </div>
      <div class="admin-details">
        <div><span>Schule</span><b>${escapeHtml(s.schule || '—')}</b></div>
        <div><span>Klasse</span><b>${escapeHtml(s.klasse || '—')}</b></div>
        <div><span>E-Mail</span><b>${escapeHtml(s.email || '—')}</b></div>
      </div>
      ${dokButtons ? `<div class="admin-dok-zeile">${dokButtons}</div>` : ''}
      ${aktionen ? `<div class="admin-aktionen">${aktionen}</div>` : ''}
    </div>`
}

/* ---------- Dokument ansehen ---------- */

async function zeigeDokument(pfad, spalte, name) {
  const inhalt = document.getElementById('dok-inhalt')
  document.getElementById('dok-titel').textContent =
    (DOKUMENTE.find(d => d.spalte === spalte)?.label || 'Dokument') + ' – ' + name
  inhalt.innerHTML = '<p style="padding:30px; text-align:center; color:var(--ink-soft);">Wird geladen…</p>'
  document.getElementById('dok-overlay').classList.add('open')

  const { data, error } = await supabase.storage.from('verifizierung').createSignedUrl(pfad, 120)
  if (error || !data?.signedUrl) {
    inhalt.innerHTML = `<p style="padding:30px; text-align:center; color:var(--coral);">Konnte nicht geladen werden: ${escapeHtml(error?.message || 'unbekannt')}</p>`
    return
  }

  const istPdf = pfad.toLowerCase().endsWith('.pdf')
  inhalt.innerHTML = istPdf
    ? `<iframe src="${data.signedUrl}" class="dok-frame" title="Dokument"></iframe>`
    : `<img src="${data.signedUrl}" class="dok-bild" alt="Verifizierungs-Dokument">`
}

function schliesseDok() {
  document.getElementById('dok-overlay').classList.remove('open')
  document.getElementById('dok-inhalt').innerHTML = ''
}

/* ---------- Entscheiden ---------- */

// Nach der Entscheidung werden die Dokumente gelöscht (Datensparsamkeit):
// Wir brauchen den Ausweis nur zur Prüfung, nicht dauerhaft.
async function entscheide(id, freischalten, btn) {
  const s = alleSchueler.find(x => x.id === id)
  if (!s) return

  // Zwei-Klick-Bestätigung beim Ablehnen (löscht das Dokument)
  if (!freischalten && btn.dataset.confirm !== '1') {
    btn.dataset.confirm = '1'
    btn.textContent = 'Wirklich ablehnen?'
    btn.classList.add('btn-confirm')
    toast('Nochmal klicken – das Dokument wird dabei gelöscht', 'info')
    clearTimeout(btn._t)
    btn._t = setTimeout(() => {
      btn.dataset.confirm = '0'; btn.textContent = 'Ablehnen'; btn.classList.remove('btn-confirm')
    }, 4000)
    return
  }
  clearTimeout(btn._t)

  btn.disabled = true
  btn.textContent = freischalten ? 'Wird freigeschaltet…' : 'Wird abgelehnt…'

  const pfade = DOKUMENTE.map(d => s[d.spalte]).filter(Boolean)
  if (pfade.length) {
    const { error: delErr } = await supabase.storage.from('verifizierung').remove(pfade)
    if (delErr) {
      toast('Dokument konnte nicht gelöscht werden: ' + delErr.message, 'fehler')
      btn.disabled = false
      btn.textContent = freischalten ? '✓ Freischalten' : 'Ablehnen'
      return
    }
  }

  const { error } = await supabase.from('profiles').update({
    verifiziert: freischalten,
    schuelerausweis_url: null,
    schulbestaetigung_url: null
  }).eq('id', id)

  if (error) {
    toast('Fehler: ' + error.message, 'fehler')
    btn.disabled = false
    btn.textContent = freischalten ? '✓ Freischalten' : 'Ablehnen'
    return
  }

  toast(freischalten
    ? `${s.name || 'Schüler'} ist jetzt verifiziert ✓`
    : `${s.name || 'Schüler'} abgelehnt – Dokument gelöscht, er kann neu hochladen`)
  await ladeSchueler()
}

async function zurueckziehen(id, btn) {
  if (btn.dataset.confirm !== '1') {
    btn.dataset.confirm = '1'
    btn.textContent = 'Wirklich zurückziehen?'
    btn.classList.add('btn-confirm')
    clearTimeout(btn._t)
    btn._t = setTimeout(() => {
      btn.dataset.confirm = '0'; btn.textContent = 'Verifizierung zurückziehen'; btn.classList.remove('btn-confirm')
    }, 4000)
    return
  }
  clearTimeout(btn._t)
  btn.disabled = true

  const { error } = await supabase.from('profiles').update({ verifiziert: false }).eq('id', id)
  if (error) {
    toast('Fehler: ' + error.message, 'fehler')
    btn.disabled = false
    return
  }
  toast('Verifizierung zurückgezogen')
  await ladeSchueler()
}

/* ============================================================
   FIRMEN-FREIGABE
   ============================================================ */

async function ladeFirmen() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, ort, firma_status, erstellt_am')
    .eq('role', 'firma')
    .order('erstellt_am', { ascending: false })

  if (error) {
    document.getElementById('firma-liste').innerHTML =
      `<div class="empty-state"><p>Konnte nicht laden: ${escapeHtml(error.message)}</p></div>`
    return
  }
  alleFirmen = data || []

  // Job-Anzahl pro Firma dazuladen (ein Query, dann zählen)
  const ids = alleFirmen.map(f => f.id)
  if (ids.length) {
    const { data: jobs } = await supabase.from('jobs').select('id, firma_id, titel, aktiv').in('firma_id', ids)
    const proFirma = {}
    ;(jobs || []).forEach(j => { (proFirma[j.firma_id] ||= []).push(j) })
    alleFirmen.forEach(f => { f.jobs = proFirma[f.id] || [] })
  }
  renderFirmen()
}

function renderFirmen() {
  const neu = alleFirmen.filter(f => f.firma_status === 'neu').length
  document.getElementById('firma-stats').innerHTML = `
    <div class="stat-box"><b>${neu}</b><span>Zu prüfen</span></div>
    <div class="stat-box"><b>${alleFirmen.filter(f => f.firma_status === 'freigegeben').length}</b><span>Freigegeben</span></div>
    <div class="stat-box"><b>${alleFirmen.length}</b><span>Firmen gesamt</span></div>`

  // Badges an den Reitern
  const bs = document.getElementById('tab-badge-firmen')
  if (bs) bs.textContent = neu > 0 ? neu : ''

  let liste = alleFirmen
  if (firmaFilter !== 'alle') liste = alleFirmen.filter(f => f.firma_status === firmaFilter)

  const box = document.getElementById('firma-liste')
  if (!liste.length) {
    box.innerHTML = `<div class="empty-state"><p>${firmaFilter === 'neu' ? 'Keine neuen Firmen zu prüfen 🎉' : 'Keine Einträge.'}</p></div>`
    return
  }

  box.innerHTML = liste.map(f => firmaKarte(f)).join('')
  box.querySelectorAll('[data-frei-firma]').forEach(b => b.addEventListener('click', () => setzeFirmaStatus(b.dataset.freiFirma, 'freigegeben', b)))
  box.querySelectorAll('[data-sperr-firma]').forEach(b => b.addEventListener('click', () => setzeFirmaStatus(b.dataset.sperrFirma, 'gesperrt', b)))
}

function firmaKarte(f) {
  const jobs = f.jobs || []
  const status = f.firma_status === 'freigegeben'
    ? '<span class="admin-status admin-status--ok">✓ Freigegeben</span>'
    : f.firma_status === 'gesperrt'
      ? '<span class="admin-status admin-status--keins">Gesperrt</span>'
      : '<span class="admin-status admin-status--warten">⏳ Zu prüfen</span>'

  const jobListe = jobs.length
    ? `<div class="admin-details" style="grid-template-columns:1fr;">
         ${jobs.map(j => `<div><span>Job</span><b>${escapeHtml(j.titel || 'Ohne Titel')}${j.aktiv ? '' : ' (pausiert)'}</b></div>`).join('')}
       </div>`
    : `<p class="admin-meta" style="margin-top:12px;">Noch keine Jobs angelegt.</p>`

  let aktionen = ''
  if (f.firma_status === 'neu') {
    aktionen = `<button type="button" class="btn btn-green" data-frei-firma="${f.id}">✓ Firma freigeben</button>
                <button type="button" class="btn btn-outline" style="color:var(--coral);" data-sperr-firma="${f.id}">Sperren</button>`
  } else if (f.firma_status === 'freigegeben') {
    aktionen = `<button type="button" class="btn btn-outline" style="color:var(--coral);" data-sperr-firma="${f.id}">Sperren</button>`
  } else {
    aktionen = `<button type="button" class="btn btn-green" data-frei-firma="${f.id}">✓ Wieder freigeben</button>`
  }

  return `
    <div class="admin-karte">
      <div class="admin-karte-kopf">
        <div>
          <b>${escapeHtml(f.name || 'Ohne Namen')}</b>
          <span class="admin-meta">${f.ort ? escapeHtml(f.ort) : 'Ort unbekannt'} · ${escapeHtml(f.email || '')}</span>
        </div>
        ${status}
      </div>
      ${jobListe}
      <div class="admin-aktionen">${aktionen}</div>
    </div>`
}

async function setzeFirmaStatus(id, neuerStatus, btn) {
  // Sperren mit Zwei-Klick-Bestätigung
  if (neuerStatus === 'gesperrt' && btn.dataset.confirm !== '1') {
    btn.dataset.confirm = '1'
    btn.dataset.orig = btn.textContent
    btn.textContent = 'Wirklich sperren?'
    btn.classList.add('btn-confirm')
    clearTimeout(btn._t)
    btn._t = setTimeout(() => { btn.dataset.confirm = '0'; btn.textContent = btn.dataset.orig; btn.classList.remove('btn-confirm') }, 4000)
    return
  }
  clearTimeout(btn._t)
  btn.disabled = true

  const f = alleFirmen.find(x => x.id === id)
  const { error } = await supabase.from('profiles').update({ firma_status: neuerStatus }).eq('id', id)
  if (error) {
    toast('Fehler: ' + error.message, 'fehler')
    btn.disabled = false
    return
  }
  toast(neuerStatus === 'freigegeben'
    ? `${f?.name || 'Firma'} freigegeben – Jobs sind jetzt sichtbar, E-Mail geht raus`
    : `${f?.name || 'Firma'} gesperrt – Jobs nicht mehr sichtbar`)
  await ladeFirmen()
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

init()
