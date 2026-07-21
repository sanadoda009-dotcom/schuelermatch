// Eigenständiger Lebenslauf-Editor (lebenslauf.html)
// Links: aufklappbare Karten · Rechts: Live-Vorschau = das ECHTE PDF
// (per pdf.js auf Canvas gerendert – was man sieht, bekommt man exakt).

import { supabase } from './supabase.js'
import { requireAuth } from './session.js'
import { toast } from './toast.js'
import { erzeugeLebenslaufPdfMitAnkern, ladeLebenslaufAlsPdf } from './pdf.js'

let profile
let bloecke = []
let cvDesign = { layout: 'klassisch', farbe: 'gruen' }
let offeneKarten = new Set(['persoenlich'])
let letzteAnker = []
let speicherTimer = null
let vorschauTimer = null
let vorschauLauf = 0

const CV_VORLAGEN = {
  'erster-job': [
    { typ: 'text', titel: 'Über mich', inhalt: 'Ich bin motiviert, lerne schnell und suche meinen ersten Nebenjob, um eigenes Geld zu verdienen und Erfahrung zu sammeln.' },
    { typ: 'skills', titel: 'Fähigkeiten', tags: 'Zuverlässig, Pünktlich, Freundlich, Lernbereit' },
    { typ: 'text', titel: 'Erfahrung', inhalt: 'Noch keine Berufserfahrung – dafür packe ich zu Hause regelmäßig mit an (z.B. Einkaufen, Aufräumen, auf Geschwister aufpassen).' }
  ],
  'nachhilfe': [
    { typ: 'text', titel: 'Über mich', inhalt: 'Ich erkläre gerne und habe Geduld – besonders in Mathe und Deutsch helfe ich jüngeren Schülern gern weiter.' },
    { typ: 'skills', titel: 'Stärkste Fächer', tags: 'Mathe, Deutsch, Englisch' },
    { typ: 'text', titel: 'Erfahrung', inhalt: 'Ich habe schon meinen Geschwistern und Mitschülern bei Hausaufgaben geholfen und sie auf Prüfungen vorbereitet.' },
    { typ: 'skills', titel: 'Fähigkeiten', tags: 'Geduldig, Erklärt verständlich, Zuverlässig' }
  ],
  'praktisch': [
    { typ: 'text', titel: 'Über mich', inhalt: 'Ich arbeite gerne praktisch und mit den Händen – ob Garten, Haushalt oder Botengänge, auf mich ist Verlass.' },
    { typ: 'skills', titel: 'Fähigkeiten', tags: 'Körperlich fit, Sorgfältig, Selbstständig, Pünktlich' },
    { typ: 'text', titel: 'Erfahrung', inhalt: 'Regelmäßige Gartenarbeit bei Nachbarn, Einkäufe für die Familie und kleinere Reparaturen zu Hause.' }
  ],
  'komplett': [
    { typ: 'text', titel: 'Über mich', inhalt: '', platzhalter: '2–3 Sätze: Wer bist du, was macht dich aus, warum suchst du einen Nebenjob?' },
    { typ: 'text', titel: 'Ausbildung', inhalt: '', platzhalter: 'Schule, Klasse, ggf. Schülerpraktikum mit Zeitraum' },
    { typ: 'skillbar', titel: 'Fähigkeiten', skills: [{ name: 'Zuverlässigkeit', wert: 90 }, { name: 'Teamarbeit', wert: 70 }] },
    { typ: 'sprachen', titel: 'Sprachen', sprachen: [{ name: 'Deutsch', niveau: 'Muttersprache' }, { name: 'Englisch', niveau: 'B1' }] },
    { typ: 'text', titel: 'Erfahrung', inhalt: '', platzhalter: 'Praktika, Ehrenamt, Babysitten, Nachbarschaftshilfe …' },
    { typ: 'skills', titel: 'Interessen', tags: '' },
    { typ: 'text', titel: 'Verfügbarkeit', inhalt: '', platzhalter: 'z.B. Mo–Fr ab 15 Uhr, Wochenende flexibel, Ferien ganztags' }
  ]
}

const FORMULIERUNGS_BEISPIELE = [
  'Ich bin ein offener und freundlicher Mensch, der gerne Neues lernt.',
  'Auf mich kann man sich verlassen – wenn ich etwas zusage, halte ich es.',
  'In meiner Freizeit mache ich Sport im Verein, dadurch bin ich teamfähig und diszipliniert.',
  'Ich übernehme gerne Verantwortung und arbeite sorgfältig.',
  'Ich bleibe auch bei stressigen Aufgaben ruhig und behalte den Überblick.',
  'Mit Kunden und älteren Menschen gehe ich respektvoll und geduldig um.',
  'Neue Aufgaben muss man mir nur einmal zeigen – dann klappt es.',
  'Ich bin körperlich fit und packe gerne mit an.',
  'Pünktlichkeit ist für mich selbstverständlich – ich plane immer Puffer ein.',
  'Als Klassensprecher habe ich gelernt, Verantwortung für andere zu übernehmen.'
]

const CEFR_NIVEAUS = ['Muttersprache', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1']

/* ---------- Start ---------- */

async function init() {
  profile = await requireAuth('schueler')
  if (!profile) return

  bloecke = Array.isArray(profile.lebenslauf_bloecke) && profile.lebenslauf_bloecke.length
    ? profile.lebenslauf_bloecke : []

  // Lokalen Entwurf bevorzugen (gleicher Schlüssel wie früher im Dashboard)
  try {
    const roh = localStorage.getItem('cv-draft-' + profile.id)
    if (roh) {
      const e = JSON.parse(roh)
      if (Array.isArray(e.bloecke) && e.bloecke.length) bloecke = e.bloecke
      if (e.schule) profile.schule = e.schule
      if (e.klasse) profile.klasse = e.klasse
    }
  } catch {}

  // Design: DB-Wert als Basis (gilt geräteübergreifend), lokaler Cache gewinnt falls vorhanden
  if (profile.cv_design?.layout) cvDesign = profile.cv_design
  try {
    const d = JSON.parse(localStorage.getItem('cv-design-' + profile.id) || 'null')
    if (d?.layout) cvDesign = d
  } catch {}

  bloecke.forEach(b => { if (!b.id) b.id = neueId() })

  setzeStatus('✓ Alle Änderungen gespeichert')
  renderKarten()
  bindeStatisches()
  renderVorschau()
}

function neueId() { return 'b' + Math.random().toString(36).slice(2, 10) }

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

/* ---------- Karten (linke Spalte) ---------- */

function kartenTitel(b) {
  if (b.titel?.trim()) return b.titel
  if (b.typ === 'text') return 'Textabschnitt'
  if (b.typ === 'skills') return 'Interessen/Tags'
  if (b.typ === 'skillbar') return 'Fähigkeiten'
  if (b.typ === 'sprachen') return 'Sprachen'
  if (b.typ === 'bild') return 'Bild'
  return 'Abschnitt'
}

function blockGefuellt(b) {
  if (b.typ === 'text') return Boolean(b.inhalt?.trim())
  if (b.typ === 'skills') return Boolean(b.tags?.trim())
  if (b.typ === 'bild') return Boolean(b.bild_url)
  if (b.typ === 'sprachen') return (b.sprachen || []).some(s => s.name?.trim())
  if (b.typ === 'skillbar') return (b.skills || []).some(s => s.name?.trim())
  return false
}

function renderKarten() {
  const wrap = document.getElementById('ll-karten')

  const persoenlichVoll = Boolean((profile.name || '').trim() && (profile.schule || '').trim())
  const karten = [`
    <details class="ll-karte" data-karte="persoenlich" ${offeneKarten.has('persoenlich') ? 'open' : ''}>
      <summary><span class="ll-check ${persoenlichVoll ? 'ok' : ''}">${persoenlichVoll ? '✓' : ''}</span> Persönliches <span class="ll-karte-typ mono">PROFIL</span></summary>
      <div class="ll-karte-body">
        <div class="ll-foto-zeile">
          <div class="cv-photo-preview" id="ll-foto-preview" style="${profile.foto_url ? `background-image:url(${profile.foto_url})` : ''}">${profile.foto_url ? '' : '📷'}</div>
          <div>
            <input type="file" id="ll-foto" accept="image/*" style="display:none;">
            <button type="button" class="btn btn-outline" id="ll-foto-btn" style="padding:8px 14px; font-size:0.82rem;">${profile.foto_url ? 'Foto ändern' : 'Foto hochladen'}</button>
            <p class="mono" style="font-size:0.68rem; color:var(--ink-soft); margin-top:6px;">Optional, aber empfohlen (max. 3 MB)</p>
          </div>
        </div>
        <div class="form-group"><label>Name</label><input type="text" id="ll-name" value="${escapeHtml(profile.name || '')}"></div>
        <div class="ll-zwei">
          <div class="form-group"><label>Schule</label><input type="text" id="ll-schule" value="${escapeHtml(profile.schule || '')}" placeholder="z.B. Gymnasium Musterstadt"></div>
          <div class="form-group"><label>Klasse</label><input type="text" id="ll-klasse" value="${escapeHtml(profile.klasse || '')}" placeholder="z.B. 9. Klasse"></div>
        </div>
        <div class="ll-zwei">
          <div class="form-group"><label>Ort</label><input type="text" id="ll-ort" value="${escapeHtml(profile.ort || '')}" placeholder="z.B. München"></div>
          <div class="form-group"><label>E-Mail (aus deinem Konto)</label><input type="text" value="${escapeHtml(profile.email || '')}" disabled></div>
        </div>
      </div>
    </details>`]

  for (const b of bloecke) {
    karten.push(`
    <details class="ll-karte" data-karte="${b.id}" ${offeneKarten.has(b.id) ? 'open' : ''}>
      <summary>
        <span class="ll-check ${blockGefuellt(b) ? 'ok' : ''}">${blockGefuellt(b) ? '✓' : ''}</span>
        <span class="ll-karte-name">${escapeHtml(kartenTitel(b))}</span>
        <span class="ll-karte-typ mono">${b.typ.toUpperCase()}</span>
        <span class="ll-karte-tools">
          <button type="button" data-hoch="${b.id}" title="Nach oben">↑</button>
          <button type="button" data-runter="${b.id}" title="Nach unten">↓</button>
          <button type="button" data-weg="${b.id}" title="Löschen">✕</button>
        </span>
      </summary>
      <div class="ll-karte-body">
        <div class="form-group"><label>Titel des Abschnitts</label>
          <input type="text" class="ll-titel" data-id="${b.id}" value="${escapeHtml(b.titel || '')}" placeholder="z.B. Erfahrung"></div>
        ${editorFuer(b)}
      </div>
    </details>`)
  }

  wrap.innerHTML = karten.join('')
  bindeKarten(wrap)
  aktualisiereFortschritt()
}

function editorFuer(b) {
  if (b.typ === 'text') return `
    <textarea class="ll-inhalt" data-id="${b.id}" placeholder="${escapeHtml(b.platzhalter || 'Dein Text…')}" rows="4">${escapeHtml(b.inhalt || '')}</textarea>
    <button type="button" class="tipp-btn ll-tipp" data-id="${b.id}">💡 Formulierungshilfe</button>`
  if (b.typ === 'skills') return `
    <input type="text" class="ll-tags" data-id="${b.id}" value="${escapeHtml(b.tags || '')}" placeholder="Komma-getrennt, z.B. Fußball, Zeichnen, Technik">`
  if (b.typ === 'sprachen') return (b.sprachen || []).map((s, i) => `
    <div class="zeilen-editor">
      <input type="text" class="ll-sprache-name" data-id="${b.id}" data-i="${i}" placeholder="z.B. Deutsch" value="${escapeHtml(s.name || '')}">
      <select class="ll-sprache-niveau" data-id="${b.id}" data-i="${i}">
        ${CEFR_NIVEAUS.map(n => `<option ${s.niveau === n ? 'selected' : ''}>${n}</option>`).join('')}
      </select>
      <button type="button" class="zeile-weg" data-zeile-weg="${b.id}" data-i="${i}">✕</button>
    </div>`).join('') + `
    <button type="button" class="tipp-btn" data-sprache-add="${b.id}">+ Sprache</button>`
  if (b.typ === 'skillbar') return (b.skills || []).map((s, i) => `
    <div class="zeilen-editor">
      <input type="text" class="ll-skill-name" data-id="${b.id}" data-i="${i}" placeholder="z.B. Teamfähigkeit" value="${escapeHtml(s.name || '')}">
      <input type="range" class="ll-skill-wert" data-id="${b.id}" data-i="${i}" min="0" max="100" step="10" value="${s.wert ?? 60}">
      <button type="button" class="zeile-weg" data-zeile-weg="${b.id}" data-i="${i}">✕</button>
    </div>`).join('') + `
    <button type="button" class="tipp-btn" data-skill-add="${b.id}">+ Fähigkeit</button>`
  if (b.typ === 'bild') return `
    <input type="file" class="ll-bild-datei" data-id="${b.id}" accept="image/*" style="display:none;">
    <div style="display:flex; gap:8px;">
      <button type="button" class="btn btn-outline ll-bild-btn" data-id="${b.id}" style="padding:8px 14px; font-size:0.82rem;">${b.bild_url ? 'Bild ändern' : 'Bild auswählen'}</button>
      ${b.bild_url ? `<button type="button" class="btn btn-outline ll-bild-weg" data-id="${b.id}" style="padding:8px 14px; font-size:0.82rem; color:var(--coral);">Entfernen</button>` : ''}
    </div>
    ${b.bild_url ? `<img src="${b.bild_url}" class="block-image-preview">` : ''}`
  return ''
}

function bindeKarten(wrap) {
  const block = id => bloecke.find(b => b.id === id)

  wrap.querySelectorAll('details.ll-karte').forEach(d => {
    d.addEventListener('toggle', () => {
      const id = d.dataset.karte
      if (d.open) { offeneKarten.add(id); scrolleZuAnker(id) }
      else offeneKarten.delete(id)
    })
  })

  // Persönliches
  const feld = (elId, prop) => {
    document.getElementById(elId)?.addEventListener('input', e => {
      profile[prop] = e.target.value
      geaendert(false)
    })
  }
  feld('ll-name', 'name'); feld('ll-schule', 'schule'); feld('ll-klasse', 'klasse'); feld('ll-ort', 'ort')
  document.getElementById('ll-foto-btn')?.addEventListener('click', () => document.getElementById('ll-foto').click())
  document.getElementById('ll-foto')?.addEventListener('change', ladeFotoHoch)

  // Blöcke: Textfelder (ohne Neuaufbau, damit der Fokus bleibt)
  wrap.querySelectorAll('.ll-titel').forEach(el => el.addEventListener('input', e => {
    block(el.dataset.id).titel = e.target.value
    const name = el.closest('details').querySelector('.ll-karte-name')
    if (name) name.textContent = kartenTitel(block(el.dataset.id))
    geaendert(false)
  }))
  wrap.querySelectorAll('.ll-inhalt').forEach(el => el.addEventListener('input', () => { block(el.dataset.id).inhalt = el.value; geaendert(false) }))
  wrap.querySelectorAll('.ll-tags').forEach(el => el.addEventListener('input', () => { block(el.dataset.id).tags = el.value; geaendert(false) }))
  wrap.querySelectorAll('.ll-sprache-name').forEach(el => el.addEventListener('input', () => { block(el.dataset.id).sprachen[el.dataset.i].name = el.value; geaendert(false) }))
  wrap.querySelectorAll('.ll-sprache-niveau').forEach(el => el.addEventListener('change', () => { block(el.dataset.id).sprachen[el.dataset.i].niveau = el.value; geaendert(false) }))
  wrap.querySelectorAll('.ll-skill-name').forEach(el => el.addEventListener('input', () => { block(el.dataset.id).skills[el.dataset.i].name = el.value; geaendert(false) }))
  wrap.querySelectorAll('.ll-skill-wert').forEach(el => el.addEventListener('input', () => { block(el.dataset.id).skills[el.dataset.i].wert = parseInt(el.value); geaendert(false) }))

  // Strukturänderungen (bauen die Karten neu)
  wrap.querySelectorAll('[data-sprache-add]').forEach(el => el.addEventListener('click', () => {
    block(el.dataset.spracheAdd).sprachen.push({ name: '', niveau: 'B1' }); geaendert(true)
  }))
  wrap.querySelectorAll('[data-skill-add]').forEach(el => el.addEventListener('click', () => {
    block(el.dataset.skillAdd).skills.push({ name: '', wert: 60 }); geaendert(true)
  }))
  wrap.querySelectorAll('[data-zeile-weg]').forEach(el => el.addEventListener('click', () => {
    const b = block(el.dataset.zeileWeg)
    ;(b.typ === 'sprachen' ? b.sprachen : b.skills).splice(el.dataset.i, 1)
    geaendert(true)
  }))
  wrap.querySelectorAll('[data-hoch]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); verschiebe(el.dataset.hoch, -1) }))
  wrap.querySelectorAll('[data-runter]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); verschiebe(el.dataset.runter, 1) }))
  wrap.querySelectorAll('[data-weg]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault()
    // Zwei-Klick-Bestätigung statt Popup
    if (el.dataset.confirm !== '1') {
      el.dataset.confirm = '1'
      el.classList.add('weg-confirm')
      toast('Nochmal klicken, um den Abschnitt zu löschen', 'info')
      clearTimeout(el._t)
      el._t = setTimeout(() => { el.dataset.confirm = '0'; el.classList.remove('weg-confirm') }, 3000)
      return
    }
    bloecke = bloecke.filter(b => b.id !== el.dataset.weg)
    offeneKarten.delete(el.dataset.weg)
    geaendert(true)
  }))

  // Formulierungshilfe
  wrap.querySelectorAll('.ll-tipp').forEach(el => el.addEventListener('click', () => {
    const b = block(el.dataset.id)
    const beispiel = FORMULIERUNGS_BEISPIELE[Math.floor(Math.random() * FORMULIERUNGS_BEISPIELE.length)]
    b.inhalt = (b.inhalt ? b.inhalt.trim() + ' ' : '') + beispiel
    const ta = wrap.querySelector(`.ll-inhalt[data-id="${b.id}"]`)
    if (ta) ta.value = b.inhalt
    geaendert(false)
  }))

  // Bild-Blöcke
  wrap.querySelectorAll('.ll-bild-btn').forEach(el => el.addEventListener('click', () =>
    wrap.querySelector(`.ll-bild-datei[data-id="${el.dataset.id}"]`).click()))
  wrap.querySelectorAll('.ll-bild-datei').forEach(el => el.addEventListener('change', e =>
    ladeBlockBildHoch(el.dataset.id, e.target.files[0])))
  wrap.querySelectorAll('.ll-bild-weg').forEach(el => el.addEventListener('click', () => {
    block(el.dataset.id).bild_url = ''
    geaendert(true)
  }))
}

function verschiebe(id, richtung) {
  const idx = bloecke.findIndex(b => b.id === id)
  const ziel = idx + richtung
  if (ziel < 0 || ziel >= bloecke.length) return
  ;[bloecke[idx], bloecke[ziel]] = [bloecke[ziel], bloecke[idx]]
  geaendert(true)
}

/* ---------- Statische Bedienelemente ---------- */

function bindeStatisches() {
  // Abschnitt hinzufügen
  document.querySelectorAll('.block-add-btn').forEach(btn => btn.addEventListener('click', () => {
    const typ = btn.dataset.add
    const basis = { id: neueId(), typ, titel: btn.dataset.titel || '' }
    if (btn.dataset.platzhalter) basis.platzhalter = btn.dataset.platzhalter
    if (typ === 'text') basis.inhalt = ''
    if (typ === 'skills') basis.tags = ''
    if (typ === 'bild') basis.bild_url = ''
    if (typ === 'sprachen') basis.sprachen = [{ name: '', niveau: 'B1' }]
    if (typ === 'skillbar') basis.skills = [{ name: '', wert: 60 }]
    bloecke.push(basis)
    offeneKarten.add(basis.id)
    geaendert(true)
  }))

  // Vorlagen
  document.querySelectorAll('#ll-vorlagen [data-vorlage]').forEach(btn => btn.addEventListener('click', () => {
    const vorlage = CV_VORLAGEN[btn.dataset.vorlage]
    if (!vorlage) return
    // Ersetzt bestehende Inhalte -> Zwei-Klick-Bestätigung statt Popup
    if (bloecke.some(blockGefuellt) && btn.dataset.confirm !== '1') {
      document.querySelectorAll('#ll-vorlagen [data-vorlage]').forEach(b => { b.dataset.confirm = '0'; b.classList.remove('weg-confirm') })
      btn.dataset.confirm = '1'
      btn.classList.add('weg-confirm')
      toast('Ersetzt deine Abschnitte – nochmal klicken zum Bestätigen', 'info')
      clearTimeout(btn._t)
      btn._t = setTimeout(() => { btn.dataset.confirm = '0'; btn.classList.remove('weg-confirm') }, 3500)
      return
    }
    btn.dataset.confirm = '0'
    btn.classList.remove('weg-confirm')
    bloecke = vorlage.map(b => ({ ...b, id: neueId() }))
    bloecke.forEach(b => offeneKarten.add(b.id))
    geaendert(true)
  }))

  // Design-Auswahl
  const zeigeDesign = () => {
    document.querySelectorAll('[data-pdf-layout]').forEach(b => b.classList.toggle('active', b.dataset.pdfLayout === cvDesign.layout))
    document.querySelectorAll('[data-pdf-farbe]').forEach(b => b.classList.toggle('active', b.dataset.pdfFarbe === cvDesign.farbe))
  }
  zeigeDesign()
  document.querySelectorAll('[data-pdf-layout]').forEach(b => b.addEventListener('click', () => {
    cvDesign = { ...cvDesign, layout: b.dataset.pdfLayout }
    localStorage.setItem('cv-design-' + profile.id, JSON.stringify(cvDesign))
    zeigeDesign(); planeVorschau(); planeSpeichern() // Design auch ins Profil (Firma sieht es)
  }))
  document.querySelectorAll('[data-pdf-farbe]').forEach(b => b.addEventListener('click', () => {
    cvDesign = { ...cvDesign, farbe: b.dataset.pdfFarbe }
    localStorage.setItem('cv-design-' + profile.id, JSON.stringify(cvDesign))
    zeigeDesign(); planeVorschau(); planeSpeichern()
  }))

  // Download
  document.getElementById('cv-download-btn').addEventListener('click', () => ladeLebenslaufAlsPdf(datenFuerPdf()))

  // Mobil-Umschalter
  document.querySelectorAll('#ll-mobil-toggle button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#ll-mobil-toggle button').forEach(x => x.classList.toggle('active', x === b))
    document.body.classList.toggle('ll-zeige-vorschau', b.dataset.ansicht === 'vorschau')
  }))
}

/* ---------- Daten & Speichern ---------- */

function datenFuerPdf() {
  return { ...profile, bloecke, cv_design: cvDesign }
}

// zentrale Änderungs-Routine: Entwurf sichern, speichern planen, Vorschau planen
function geaendert(struktur) {
  try {
    localStorage.setItem('cv-draft-' + profile.id, JSON.stringify({
      schule: profile.schule || '', klasse: profile.klasse || '', bloecke, zeit: Date.now()
    }))
  } catch {}
  if (struktur) renderKarten()
  else aktualisiereFortschritt()
  planeSpeichern()
  planeVorschau()
}

function setzeStatus(text) {
  document.getElementById('save-status').textContent = text
}

function planeSpeichern() {
  setzeStatus('Speichert…')
  clearTimeout(speicherTimer)
  speicherTimer = setTimeout(speichern, 900)
}

async function speichern() {
  const updates = {
    name: profile.name || '',
    ort: profile.ort || '',
    schule: profile.schule || '',
    klasse: profile.klasse || '',
    lebenslauf_bloecke: bloecke,
    cv_design: cvDesign
  }
  const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id)
  if (error) {
    setzeStatus('⚠ Speichern fehlgeschlagen – Änderungen sind lokal gesichert')
    return
  }
  try { localStorage.removeItem('cv-draft-' + profile.id) } catch {}
  setzeStatus('✓ Alle Änderungen gespeichert')
}

function aktualisiereFortschritt() {
  const karten = [
    Boolean((profile.name || '').trim() && (profile.schule || '').trim()),
    ...bloecke.map(blockGefuellt)
  ]
  const prozent = karten.length ? Math.round(karten.filter(Boolean).length / karten.length * 100) : 0
  document.getElementById('ll-progress-fill').style.width = prozent + '%'
  document.getElementById('ll-progress-label').textContent = prozent + ' % fertig'
}

/* ---------- Live-Vorschau (echtes PDF auf Canvas) ---------- */

function planeVorschau() {
  clearTimeout(vorschauTimer)
  vorschauTimer = setTimeout(renderVorschau, 450)
}

// Schutz gegen hängende pdf.js-Renderer (z.B. wenn der Worker stirbt):
// jeder Schritt bekommt ein Zeitlimit; schlägt das Zeichnen fehl,
// bleibt die Vorschau benutzbar (Knopf öffnet das PDF im neuen Tab).
function mitZeitlimit(promise, ms, name) {
  return Promise.race([promise, new Promise((_, nein) => setTimeout(() => nein(new Error('Zeitlimit: ' + name)), ms))])
}

async function zeichneSeiten(doc, lauf) {
  const pdfjs = window.pdfjsLib
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }
  const pdf = await mitZeitlimit(pdfjs.getDocument({ data: doc.output('arraybuffer') }).promise, 8000, 'PDF öffnen')
  const seiten = []
  for (let n = 1; n <= pdf.numPages; n++) {
    if (lauf !== vorschauLauf) return null
    const page = await mitZeitlimit(pdf.getPage(n), 5000, 'Seite laden')
    const vp = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = vp.width; canvas.height = vp.height
    canvas.className = 'll-a4'
    canvas.dataset.seite = n
    await mitZeitlimit(page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise, 8000, 'Seite zeichnen')
    seiten.push(canvas)
  }
  return seiten
}

async function renderVorschau() {
  const lauf = ++vorschauLauf
  const ziel = document.getElementById('vorschau-seiten')
  let doc = null
  try {
    const ergebnis = await erzeugeLebenslaufPdfMitAnkern(datenFuerPdf())
    doc = ergebnis.doc
    if (lauf !== vorschauLauf) return

    const seiten = await zeichneSeiten(doc, lauf)
    if (seiten === null || lauf !== vorschauLauf) return
    ziel.innerHTML = ''
    seiten.forEach(c => ziel.appendChild(c))
    letzteAnker = ergebnis.anker
  } catch (e) {
    if (lauf !== vorschauLauf) return
    // Fallback: Inline-Zeichnen klappt nicht -> PDF trotzdem anschaubar machen
    ziel.innerHTML = `
      <div class="ll-vorschau-lade">
        Die eingebettete Vorschau kann gerade nicht gezeichnet werden.<br><br>
        <button type="button" class="btn btn-green" id="ll-vorschau-neu">Nochmal versuchen</button>
        ${doc ? '<button type="button" class="btn btn-outline" id="ll-vorschau-tab" style="margin-left:8px;">PDF in neuem Tab öffnen</button>' : ''}
      </div>`
    document.getElementById('ll-vorschau-neu')?.addEventListener('click', renderVorschau)
    if (doc) {
      document.getElementById('ll-vorschau-tab')?.addEventListener('click', () => {
        window.open(doc.output('bloburl'), '_blank')
      })
    }
  }
}

function scrolleZuAnker(kartenId) {
  const anker = letzteAnker.find(a => a.id === kartenId)
  if (!anker) return
  const container = document.getElementById('vorschau-seiten')
  const canvas = container.querySelector(`canvas[data-seite="${anker.seite}"]`)
  if (!canvas) return
  const zielY = canvas.offsetTop + (anker.y / 297) * canvas.clientHeight - 24
  container.scrollTo({ top: Math.max(0, zielY), behavior: 'smooth' })
}

/* ---------- Uploads ---------- */

async function ladeFotoHoch(e) {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 3 * 1024 * 1024) { toast('Das Bild ist zu groß (max. 3 MB).', 'fehler'); return }

  const btn = document.getElementById('ll-foto-btn')
  btn.disabled = true; btn.textContent = 'Wird hochgeladen…'

  const ext = file.name.split('.').pop()
  const path = `${profile.id}/avatar.${ext}`
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (upErr) { toast('Fehler beim Hochladen: ' + upErr.message, 'fehler'); btn.disabled = false; btn.textContent = 'Foto hochladen'; return }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const foto_url = data.publicUrl + '?t=' + Date.now()
  const { error: dbErr } = await supabase.from('profiles').update({ foto_url }).eq('id', profile.id)
  btn.disabled = false
  if (dbErr) { toast('Fehler beim Speichern: ' + dbErr.message, 'fehler'); return }

  profile.foto_url = foto_url
  toast('Foto gespeichert!')
  renderKarten()
  planeVorschau()
}

async function ladeBlockBildHoch(blockId, file) {
  if (!file) return
  const b = bloecke.find(x => x.id === blockId)
  const ext = file.name.split('.').pop()
  const path = `${profile.id}/${blockId}.${ext}`
  const { error } = await supabase.storage.from('lebenslauf-bilder').upload(path, file, { upsert: true })
  if (error) { toast('Fehler beim Hochladen: ' + error.message, 'fehler'); return }
  const { data } = supabase.storage.from('lebenslauf-bilder').getPublicUrl(path)
  b.bild_url = data.publicUrl + '?t=' + Date.now()
  geaendert(true)
}

init()
