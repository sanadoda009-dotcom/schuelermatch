import { supabase } from './supabase.js'
import { requireAuth, logout } from './session.js'
import { ICONS } from './icons.js'
import { ladeLebenslaufAlsPdf } from './pdf.js'
import { initSidebar } from './sidebar.js'
import { toast } from './toast.js'
import { ladeChat, zaehleUngelesen } from './chat.js'
import { initGlocke } from './notifications.js'
import { geocode, distanzKm } from './geo.js'

let profile
let bloecke = []
let aktuelleBewerbung = null // { jobId, btn, zeugnisDatei }
let alleJobs = []
let beworbenIds = new Set()
let gemerkteIds = new Set()
let nurGemerkte = false
let bewerbungsStatus = {}

async function init() {
  profile = await requireAuth('schueler')
  if (!profile) return

  document.getElementById('user-name').textContent = profile.name || 'Schüler'
  document.getElementById('logout-btn').addEventListener('click', logout)

  initSidebar(zeigeView)
  aktualisiereSidebarUser()

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

  // Ungespeicherten Entwurf aus dem Browser wiederherstellen (falls vorhanden)
  const wiederhergestellt = ladeEntwurf()

  document.querySelectorAll('.block-add-btn').forEach(btn => {
    btn.addEventListener('click', () => neuerBlock(btn.dataset.add, btn.dataset.titel, btn.dataset.platzhalter))
  })

  document.querySelectorAll('.cv-template-chip').forEach(chip => {
    chip.addEventListener('click', () => wendeVorlageAn(chip.dataset.vorlage))
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

  document.getElementById('detail-close').addEventListener('click', () => {
    document.getElementById('job-detail-overlay').classList.remove('open')
  })
  document.getElementById('job-detail-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'job-detail-overlay') e.target.classList.remove('open')
  })

  renderVerifyStatus()
  renderBlockEditor()
  renderCvPreview()

  document.getElementById('filter-suche').addEventListener('input', wendeJobFilterAn)
  document.getElementById('filter-ort').addEventListener('input', wendeJobFilterAn)
  document.getElementById('filter-gehalt').addEventListener('change', wendeJobFilterAn)
  document.getElementById('filter-kategorie').addEventListener('change', wendeJobFilterAn)
  document.getElementById('filter-arbeitszeit').addEventListener('change', wendeJobFilterAn)
  document.getElementById('sortierung').addEventListener('change', wendeJobFilterAn)

  // Umkreis-Slider nur zeigen, wenn Wohnort-Koordinaten bekannt sind
  if (profile.lat != null && profile.lon != null) {
    document.getElementById('radius-row').style.display = 'flex'
    document.getElementById('radius-ort').textContent = profile.ort || 'deinem Ort'
    const slider = document.getElementById('filter-radius')
    slider.addEventListener('input', () => {
      const v = parseInt(slider.value)
      document.getElementById('radius-wert').textContent = v === 0 ? 'Egal' : v + ' km'
      wendeJobFilterAn()
    })
  }
  document.getElementById('merkliste-toggle').addEventListener('click', () => {
    nurGemerkte = !nurGemerkte
    const btn = document.getElementById('merkliste-toggle')
    btn.textContent = nurGemerkte ? '♥ Gemerkte' : '♡ Gemerkte'
    btn.setAttribute('aria-pressed', nurGemerkte)
    btn.classList.toggle('btn-green', nurGemerkte)
    btn.classList.toggle('btn-outline', !nurGemerkte)
    wendeJobFilterAn()
  })

  await ladeJobs()
  aktualisiereNachrichtenBadge()

  initGlocke({
    rolle: 'schueler',
    profileId: profile.id,
    onNavigate: (ziel) => document.querySelector(`.sidebar-item[data-view="${ziel}"]`)?.click()
  })
}

/* ---------- CV-VORLAGEN & FORMULIERUNGSHILFE ---------- */

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
    { typ: 'text', titel: 'Ausbildung & Praktika', inhalt: '', platzhalter: 'Schule, Klasse, ggf. Schülerpraktikum mit Zeitraum' },
    { typ: 'skillbar', titel: 'Fähigkeiten', skills: [{ name: 'Zuverlässigkeit', wert: 90 }, { name: 'Teamarbeit', wert: 70 }] },
    { typ: 'sprachen', titel: 'Sprachen', sprachen: [{ name: 'Deutsch', niveau: 'Muttersprache' }, { name: 'Englisch', niveau: 'B1' }] },
    { typ: 'text', titel: 'Ehrenamt & Engagement', inhalt: '', platzhalter: 'Verein, AG, Klassensprecher, Nachbarschaftshilfe …' },
    { typ: 'skills', titel: 'Interessen', tags: '' },
    { typ: 'text', titel: 'Verfügbarkeit', inhalt: '', platzhalter: 'z.B. Mo–Fr ab 15 Uhr, Wochenende flexibel, Ferien ganztags' },
    { typ: 'text', titel: 'Mobilität', inhalt: '', platzhalter: 'z.B. Fahrrad, Bus & Bahn, Mofa-Führerschein' }
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
  'Ich frage lieber einmal mehr nach, bevor ich etwas falsch mache.',
  'Als Klassensprecher habe ich gelernt, Verantwortung für andere zu übernehmen.',
  'Durch mein Hobby kenne ich mich gut mit Technik und Computern aus.'
]

function wendeVorlageAn(name) {
  const vorlage = CV_VORLAGEN[name]
  if (!vorlage) return
  const hatInhalt = bloecke.some(b => b.inhalt?.trim() || b.tags?.trim() || b.bild_url)
  if (hatInhalt && !confirm('Die Vorlage ersetzt deine bisherigen Abschnitte. Fortfahren?')) return

  bloecke = vorlage.map(b => ({ ...b, id: cryptoId() }))
  renderBlockEditor()
  renderCvPreview()
}

function zeigeView(view) {
  document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'))
  document.getElementById('view-' + view).classList.add('active')
  if (view === 'lebenslauf') renderCvPreview()
  if (view === 'abzeichen') renderAbzeichen()
  if (view === 'bewerbungen') renderMeineBewerbungen()
  if (view === 'nachrichten') renderKonversationen()
  else if (chatCleanup) { chatCleanup(); chatCleanup = null }
}

/* ---------- NACHRICHTEN ---------- */

let chatCleanup = null

async function aktualisiereNachrichtenBadge() {
  const n = await zaehleUngelesen(profile.id)
  const el = document.getElementById('badge-nachrichten')
  if (el) el.textContent = n > 0 ? n : ''
}

async function renderKonversationen() {
  const container = document.getElementById('konv-container')
  document.getElementById('chat-container').innerHTML = ''
  container.style.display = 'block'
  container.innerHTML = '<div class="skeleton-card" style="height:70px;"></div>'

  const { data } = await supabase.from('bewerbungen')
    .select('id, job:job_id(titel)')
    .eq('schueler_id', profile.id)
    .eq('status', 'angenommen')
    .order('erstellt_am', { ascending: false })

  if (!data || !data.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 10h32v22H16l-8 8V10z" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <p>Noch keine Chats. Sobald eine Firma deine Bewerbung annimmt, kannst du hier sicher schreiben.</p>
      </div>`
    return
  }

  container.innerHTML = `<div class="konv-liste">${data.map(b => `
    <button class="konv-item" data-bewerbung="${b.id}" data-titel="${escapeHtml(b.job?.titel || 'Job')}">
      <div class="cv-photo-preview" style="background:linear-gradient(135deg,var(--match-green),var(--indigo));">💬</div>
      <div><b>${escapeHtml(b.job?.titel || 'Job')}</b><span>Angenommen · Chat öffnen</span></div>
    </button>`).join('')}</div>`

  container.querySelectorAll('.konv-item').forEach(btn =>
    btn.addEventListener('click', () => oeffneChat(btn.dataset.bewerbung, btn.dataset.titel)))
}

async function oeffneChat(bewerbungId, titel) {
  if (chatCleanup) { chatCleanup(); chatCleanup = null }
  document.getElementById('konv-container').style.display = 'none'
  const cc = document.getElementById('chat-container')
  cc.innerHTML = `
    <div class="chat-box">
      <div class="chat-kopf">
        <div class="cv-photo-preview" style="background:linear-gradient(135deg,var(--match-green),var(--indigo));">💬</div>
        <b>${escapeHtml(titel)}</b>
        <button type="button" class="zurueck">← Zurück</button>
      </div>
      <div id="chat-inner"></div>
    </div>`
  cc.querySelector('.zurueck').addEventListener('click', () => {
    if (chatCleanup) { chatCleanup(); chatCleanup = null }
    renderKonversationen()
    aktualisiereNachrichtenBadge()
  })
  chatCleanup = await ladeChat(cc.querySelector('#chat-inner'), bewerbungId, profile.id)
  setTimeout(aktualisiereNachrichtenBadge, 500)
}

/* ---------- ONBOARDING-CHECKLISTE ---------- */

function renderOnboarding() {
  const box = document.getElementById('onboarding-box')
  if (!box) return
  const wegKey = 'onboarding-weg-' + profile.id
  if (localStorage.getItem(wegKey)) { box.innerHTML = ''; return }

  const schritte = [
    { name: 'Profil ausfüllen', hinweis: 'Ort & Alter angeben', fertig: Boolean(profile.ort && profile.alter_jahre), view: 'profil' },
    { name: 'Profilfoto hochladen', hinweis: 'Gesicht zeigen schafft Vertrauen', fertig: Boolean(profile.foto_url), view: 'profil' },
    { name: 'Lebenslauf erstellen', hinweis: 'Mit Vorlage in 2 Minuten', fertig: lebenslaufVollstaendig(), view: 'lebenslauf' },
    { name: 'Verifizieren lassen', hinweis: 'Schülerausweis hochladen', fertig: Boolean(profile.verifiziert || profile.schuelerausweis_url || profile.schulbestaetigung_url), view: 'verifizierung' },
    { name: 'Erste Bewerbung senden', hinweis: 'Unten wartet dein Match', fertig: beworbenIds.size >= 1, view: 'jobs' }
  ]
  const erledigt = schritte.filter(s => s.fertig).length
  if (erledigt === schritte.length) { box.innerHTML = ''; localStorage.setItem(wegKey, '1'); return }

  box.innerHTML = `
    <div class="onboard-card">
      <div class="onboard-kopf">
        <b>🚀 Deine ersten Schritte (${erledigt}/${schritte.length})</b>
        <button type="button" class="onboard-weg" title="Ausblenden">✕</button>
      </div>
      <div class="onboard-balken"><div class="onboard-balken-voll" style="width:${Math.round(erledigt / schritte.length * 100)}%"></div></div>
      <div class="onboard-schritte">
        ${schritte.map(s => `
          <button type="button" class="onboard-schritt ${s.fertig ? 'fertig' : ''}" data-onboard-view="${s.view}" ${s.fertig ? 'disabled' : ''}>
            <span class="onboard-check">${s.fertig ? '✓' : ''}</span>
            <span><b>${s.name}</b><small>${s.hinweis}</small></span>
          </button>`).join('')}
      </div>
    </div>`

  box.querySelector('.onboard-weg').addEventListener('click', () => {
    localStorage.setItem(wegKey, '1')
    box.innerHTML = ''
  })
  box.querySelectorAll('[data-onboard-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.onboardView
      if (view === 'jobs') document.getElementById('jobs-grid')?.scrollIntoView({ behavior: 'smooth' })
      else document.querySelector(`.sidebar-item[data-view="${view}"]`)?.click()
    })
  })
}

/* ---------- MEINE BEWERBUNGEN ---------- */

async function renderMeineBewerbungen() {
  const container = document.getElementById('bewerbungen-container')
  container.innerHTML = '<div class="skeleton-card" style="height:90px;"></div>'

  const { data } = await supabase.from('bewerbungen')
    .select('id, status, erstellt_am, job:job_id(id, titel, ort, stundenlohn, kategorie, firma_name, aktiv)')
    .eq('schueler_id', profile.id)
    .order('erstellt_am', { ascending: false })

  const liste = data || []
  if (!liste.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8h24v32H12z M18 16h12M18 22h12M18 28h8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <p>Noch keine Bewerbungen. Stöbere bei den <a href="#" id="bew-zu-jobs" style="color:var(--match-green-dark); text-decoration:underline;">Jobs</a> und bewirb dich mit einem Klick!</p>
      </div>`
    document.getElementById('bew-zu-jobs')?.addEventListener('click', (e) => {
      e.preventDefault()
      document.querySelector('.sidebar-item[data-view="jobs"]')?.click()
    })
    return
  }

  // Kopf-Statistik wie bei LinkedIn "My Jobs"
  const offen = liste.filter(b => b.status !== 'angenommen' && b.status !== 'abgelehnt').length
  const zusagen = liste.filter(b => b.status === 'angenommen').length

  container.innerHTML = `
    <div class="bew-stats">
      <div><b>${liste.length}</b><span>Gesamt</span></div>
      <div><b>${offen}</b><span>In Prüfung</span></div>
      <div><b>${zusagen}</b><span>Zusagen</span></div>
    </div>
    <div class="bew-liste">
      ${liste.map(b => bewerbungKarte(b)).join('')}
    </div>`

  container.querySelectorAll('[data-chat-bewerbung]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.sidebar-item[data-view="nachrichten"]')?.click()
      oeffneChat(btn.dataset.chatBewerbung, btn.dataset.chatTitel)
    })
  })
}

function bewerbungKarte(b) {
  const status = b.status || 'ausstehend'
  const datum = b.erstellt_am ? new Date(b.erstellt_am).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const job = b.job || {}
  const inaktiv = job.aktiv === false

  // 3-Schritte-Timeline: Eingereicht -> In Pruefung -> Antwort
  const schritt3 = status === 'angenommen'
    ? '<div class="bew-schritt done gruen"><span class="punkt">🎉</span>Zusage!</div>'
    : status === 'abgelehnt'
      ? '<div class="bew-schritt done"><span class="punkt">•</span>Diesmal nicht geklappt</div>'
      : '<div class="bew-schritt"><span class="punkt">○</span>Antwort steht aus</div>'

  return `
    <div class="bew-card ${status === 'angenommen' ? 'bew-card--zusage' : ''}">
      <div class="bew-card-kopf">
        <div>
          <b>${escapeHtml(job.titel || 'Job (nicht mehr verfügbar)')}</b>
          <span class="bew-meta">${job.ort ? escapeHtml(job.ort) : ''}${job.stundenlohn ? ' · ' + job.stundenlohn + ' €/Std' : ''}${job.kategorie ? ' · ' + escapeHtml(job.kategorie) : ''}${inaktiv ? ' · <i>Anzeige pausiert</i>' : ''}</span>
        </div>
        <span class="bew-datum mono">${datum}</span>
      </div>
      <div class="bew-timeline">
        <div class="bew-schritt done"><span class="punkt">✓</span>Eingereicht</div>
        <div class="bew-linie ${status !== 'ausstehend' ? 'done' : ''}"></div>
        <div class="bew-schritt ${status !== 'ausstehend' ? 'done' : 'aktiv'}"><span class="punkt">${status !== 'ausstehend' ? '✓' : '◐'}</span>In Prüfung</div>
        <div class="bew-linie ${status !== 'ausstehend' ? 'done' : ''}"></div>
        ${schritt3}
      </div>
      ${status === 'angenommen' ? `<button type="button" class="btn btn-green" style="margin-top:12px;" data-chat-bewerbung="${b.id}" data-chat-titel="${escapeHtml(job.titel || 'Job')}">💬 Zum Chat mit der Firma</button>` : ''}
      ${status === 'abgelehnt' ? '<p class="bew-trost">Kopf hoch – das gehört dazu. Firmen suchen oft sehr spezifisch. Deine nächste Chance wartet schon!</p>' : ''}
    </div>`
}

function aktualisiereSidebarUser() {
  const avatar = document.getElementById('sidebar-avatar')
  if (profile.foto_url) { avatar.style.backgroundImage = `url(${profile.foto_url})`; avatar.textContent = '' }
  else avatar.textContent = (profile.name || '?')[0].toUpperCase()
  document.getElementById('sidebar-name').textContent = profile.name || 'Schüler'
  document.getElementById('sidebar-status').textContent = profile.verifiziert ? '✓ verifiziert' : 'nicht verifiziert'
}

function renderAbzeichen() {
  const hatFoto = Boolean(profile.foto_url)
  const cvVoll = lebenslaufVollstaendig()
  const beworben = beworbenIds.size
  const gemerkt = gemerkteIds.size
  const angenommen = Object.values(bewerbungsStatus).some(s => s === 'angenommen')

  const liste = [
    { icon: '🎓', name: 'Willkommen', beschr: 'Account erstellt', erreicht: true },
    { icon: '📸', name: 'Gesicht zeigen', beschr: 'Profilbild hochgeladen', erreicht: hatFoto },
    { icon: '✅', name: 'Verifiziert', beschr: 'Als Schüler bestätigt', erreicht: Boolean(profile.verifiziert) },
    { icon: '📄', name: 'Bereit', beschr: 'Lebenslauf ausgefüllt', erreicht: cvVoll },
    { icon: '🚀', name: 'Erste Bewerbung', beschr: 'Auf 1 Job beworben', erreicht: beworben >= 1 },
    { icon: '🔥', name: 'Fleißig', beschr: 'Auf 3 Jobs beworben', erreicht: beworben >= 3 },
    { icon: '⭐', name: 'Sammler', beschr: '3 Jobs gemerkt', erreicht: gemerkt >= 3 },
    { icon: '🏆', name: 'Angenommen!', beschr: 'Eine Zusage erhalten', erreicht: angenommen }
  ]

  document.getElementById('abzeichen-grid').innerHTML = liste.map(a => `
    <div class="abzeichen ${a.erreicht ? 'erreicht' : ''}">
      <span class="icon">${a.icon}</span>
      <b>${a.name}</b>
      <span>${a.beschr}</span>
    </div>
  `).join('')
}

function cryptoId() {
  return 'b' + Math.random().toString(36).slice(2, 10)
}

/* ---------- BLOCK-EDITOR ---------- */

function neuerBlock(typ, titel, platzhalter) {
  const basis = { id: cryptoId(), typ, titel: titel || '' }
  if (platzhalter) basis.platzhalter = platzhalter
  if (typ === 'text') basis.inhalt = ''
  if (typ === 'skills') basis.tags = ''
  if (typ === 'bild') basis.bild_url = ''
  if (typ === 'sprachen') basis.sprachen = [{ name: '', niveau: 'B1' }]
  if (typ === 'skillbar') basis.skills = [{ name: '', wert: 60 }]
  bloecke.push(basis)
  renderBlockEditor()
  renderCvPreview()
}

const CEFR_NIVEAUS = ['Muttersprache', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1']
function cefrProzent(niveau) {
  const map = { 'Muttersprache': 100, 'C2': 100, 'C1': 85, 'B2': 70, 'B1': 55, 'A2': 40, 'A1': 25 }
  return map[niveau] || 50
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
  if (typ === 'skills') return 'Tags'
  if (typ === 'skillbar') return 'Skill-Regler'
  if (typ === 'sprachen') return 'Sprachen'
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
      ${b.typ === 'text' ? `<textarea class="block-inhalt-input" placeholder="${escapeHtml(b.platzhalter || 'Dein Text...')}">${escapeHtml(b.inhalt || '')}</textarea><button type="button" class="tipp-btn" title="Beispielsatz einfügen">💡 Formulierungshilfe</button>` : ''}
      ${b.typ === 'skills' ? `<input type="text" class="block-tags-input" placeholder="Komma-getrennt, z.B. Sport, Musik, Technik, Lesen" value="${escapeHtml(b.tags || '')}">` : ''}
      ${b.typ === 'bild' ? `
        <input type="file" class="block-bild-input" accept="image/*" style="display:none;">
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-outline block-bild-btn" style="padding:8px 14px; font-size:0.82rem;">${b.bild_url ? 'Bild ändern' : 'Bild auswählen'}</button>
          ${b.bild_url ? `<button type="button" class="btn btn-outline block-bild-remove" style="padding:8px 14px; font-size:0.82rem; color:var(--coral);">Entfernen</button>` : ''}
        </div>
        ${b.bild_url ? `<img src="${b.bild_url}" class="block-image-preview">` : ''}
      ` : ''}
      ${b.typ === 'sprachen' ? `
        ${(b.sprachen || []).map((s, i) => `
          <div class="zeilen-editor">
            <input type="text" class="sprache-name" data-i="${i}" placeholder="z.B. Deutsch" value="${escapeHtml(s.name || '')}">
            <select class="sprache-niveau" data-i="${i}">
              ${CEFR_NIVEAUS.map(n => `<option ${s.niveau === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            <button type="button" class="zeile-weg" data-i="${i}" title="Entfernen">✕</button>
          </div>
        `).join('')}
        <button type="button" class="tipp-btn sprache-add">+ Sprache hinzufügen</button>
      ` : ''}
      ${b.typ === 'skillbar' ? `
        ${(b.skills || []).map((s, i) => `
          <div class="zeilen-editor">
            <input type="text" class="skill-name" data-i="${i}" placeholder="z.B. Teamfähigkeit" value="${escapeHtml(s.name || '')}">
            <input type="range" class="skill-wert" data-i="${i}" min="0" max="100" step="10" value="${s.wert ?? 60}">
            <span class="skill-wert-label mono">${s.wert ?? 60}%</span>
            <button type="button" class="zeile-weg" data-i="${i}" title="Entfernen">✕</button>
          </div>
        `).join('')}
        <button type="button" class="tipp-btn skill-add">+ Fähigkeit hinzufügen</button>
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
    el.querySelector('.block-bild-remove')?.addEventListener('click', () => {
      block.bild_url = ''
      renderBlockEditor()
      renderCvPreview()
    })
    el.querySelector('.tipp-btn:not(.sprache-add):not(.skill-add)')?.addEventListener('click', () => {
      const beispiel = FORMULIERUNGS_BEISPIELE[Math.floor(Math.random() * FORMULIERUNGS_BEISPIELE.length)]
      const feld = el.querySelector('.block-inhalt-input')
      block.inhalt = (block.inhalt ? block.inhalt.trim() + ' ' : '') + beispiel
      feld.value = block.inhalt
      renderCvPreview()
    })

    // Sprachen-Editor
    el.querySelectorAll('.sprache-name').forEach(inp => inp.addEventListener('input', e => { block.sprachen[e.target.dataset.i].name = e.target.value; renderCvPreview() }))
    el.querySelectorAll('.sprache-niveau').forEach(sel => sel.addEventListener('change', e => { block.sprachen[e.target.dataset.i].niveau = e.target.value; renderCvPreview() }))
    el.querySelector('.sprache-add')?.addEventListener('click', () => { block.sprachen.push({ name: '', niveau: 'B1' }); renderBlockEditor(); renderCvPreview() })

    // Skill-Regler-Editor
    el.querySelectorAll('.skill-name').forEach(inp => inp.addEventListener('input', e => { block.skills[e.target.dataset.i].name = e.target.value; renderCvPreview() }))
    el.querySelectorAll('.skill-wert').forEach(rng => rng.addEventListener('input', e => {
      block.skills[e.target.dataset.i].wert = parseInt(e.target.value)
      e.target.nextElementSibling.textContent = e.target.value + '%'
      renderCvPreview()
    }))
    el.querySelector('.skill-add')?.addEventListener('click', () => { block.skills.push({ name: '', wert: 60 }); renderBlockEditor(); renderCvPreview() })

    // Zeile entfernen (Sprachen & Skills)
    el.querySelectorAll('.zeile-weg').forEach(btn => btn.addEventListener('click', e => {
      const i = parseInt(e.target.dataset.i)
      if (block.typ === 'sprachen') block.sprachen.splice(i, 1)
      if (block.typ === 'skillbar') block.skills.splice(i, 1)
      renderBlockEditor(); renderCvPreview()
    }))
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
      return `<div class="cv-preview-section"><h4>${ICONS.text}${escapeHtml(b.titel || 'Abschnitt')}</h4>${b.inhalt ? `<p>${escapeHtml(b.inhalt)}</p>` : '<p class="cv-preview-empty">Noch keine Angaben</p>'}</div>`
    }
    if (b.typ === 'skills') {
      const tags = (b.tags || '').split(',').map(t => t.trim()).filter(Boolean)
      return `<div class="cv-preview-section"><h4>${ICONS.tag}${escapeHtml(b.titel || 'Fähigkeiten')}</h4>${tags.length ? `<div class="cv-tags">${tags.map(t => `<span class="cv-tag">${escapeHtml(t)}</span>`).join('')}</div>` : '<p class="cv-preview-empty">Noch keine Angaben</p>'}</div>`
    }
    if (b.typ === 'bild') {
      return `<div class="cv-preview-section"><h4>${ICONS.image}${escapeHtml(b.titel || 'Bild')}</h4>${b.bild_url ? `<img src="${b.bild_url}" class="cv-preview-image">` : '<p class="cv-preview-empty">Noch kein Bild hochgeladen</p>'}</div>`
    }
    if (b.typ === 'sprachen') {
      const sprachen = (b.sprachen || []).filter(s => s.name?.trim())
      return `<div class="cv-preview-section"><h4>${ICONS.tag}${escapeHtml(b.titel || 'Sprachen')}</h4>${sprachen.length ? `<div class="cv-sprachen">${sprachen.map(s => `<span class="cv-sprache-badge">${escapeHtml(s.name)}<b>${escapeHtml(s.niveau)}</b></span>`).join('')}</div>` : '<p class="cv-preview-empty">Noch keine Angaben</p>'}</div>`
    }
    if (b.typ === 'skillbar') {
      const skills = (b.skills || []).filter(s => s.name?.trim())
      return `<div class="cv-preview-section"><h4>${ICONS.tag}${escapeHtml(b.titel || 'Fähigkeiten')}</h4>${skills.length ? skills.map(s => `<div class="cv-skillbar"><div class="cv-skillbar-top"><span>${escapeHtml(s.name)}</span></div><div class="cv-skillbar-track"><div style="width:${s.wert}%"></div></div></div>`).join('') : '<p class="cv-preview-empty">Noch keine Angaben</p>'}</div>`
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

  aktualisiereFortschritt()
  autoSave()
}

function autoSaveKey() { return `cv-draft-${profile.id}` }

function autoSave() {
  try {
    const entwurf = {
      schule: document.getElementById('cv-schule').value,
      klasse: document.getElementById('cv-klasse').value,
      bloecke,
      zeit: Date.now()
    }
    localStorage.setItem(autoSaveKey(), JSON.stringify(entwurf))
    const hint = document.getElementById('autosave-hint')
    if (hint) hint.textContent = '✓ Automatisch zwischengespeichert'
  } catch {}
}

function ladeEntwurf() {
  try {
    const roh = localStorage.getItem(autoSaveKey())
    if (!roh) return false
    const e = JSON.parse(roh)
    if (Array.isArray(e.bloecke) && e.bloecke.length) bloecke = e.bloecke
    if (e.schule) document.getElementById('cv-schule').value = e.schule
    if (e.klasse) document.getElementById('cv-klasse').value = e.klasse
    return true
  } catch { return false }
}

function aktualisiereFortschritt() {
  const schule = document.getElementById('cv-schule').value.trim()
  const hatAbschnitt = blockHatInhalt()

  const items = [
    { label: 'Profilbild', done: Boolean(profile.foto_url) },
    { label: 'Schule', done: Boolean(schule) },
    { label: 'Min. 1 Abschnitt', done: hatAbschnitt },
    { label: 'Verifizierung', done: Boolean(profile.verifiziert) }
  ]

  document.getElementById('cv-progress').innerHTML = items.map(i => `
    <span class="cv-progress-item ${i.done ? 'done' : ''}">${i.done ? '✓' : '○'} ${i.label}</span>
  `).join('')

  const prozent = Math.round(items.filter(i => i.done).length / items.length * 100)
  document.getElementById('cv-progress-fill').style.width = prozent + '%'
  document.getElementById('cv-progress-label').textContent = prozent + '% vollständig'
}

async function persistiereLebenslauf() {
  const updates = {
    schule: document.getElementById('cv-schule').value,
    klasse: document.getElementById('cv-klasse').value,
    lebenslauf_bloecke: bloecke
  }
  const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id)
  if (!error) profile = { ...profile, ...updates }
  return !error
}

async function speichereLebenslauf() {
  const btn = document.getElementById('cv-save-btn')
  btn.disabled = true
  btn.textContent = 'Speichert...'

  const ok = await persistiereLebenslauf()

  btn.disabled = false
  btn.textContent = 'Lebenslauf speichern'

  if (!ok) {
    alert('Fehler beim Speichern.')
    return
  }

  try { localStorage.removeItem(autoSaveKey()) } catch {}
  const hint = document.getElementById('autosave-hint')
  if (hint) hint.textContent = '✓ Gespeichert'
  toast('Lebenslauf gespeichert!')
}

function blockHatInhalt() {
  return bloecke.some(b =>
    (b.typ === 'text' && b.inhalt?.trim()) ||
    (b.typ === 'skills' && b.tags?.trim()) ||
    (b.typ === 'bild' && b.bild_url) ||
    (b.typ === 'sprachen' && (b.sprachen || []).some(s => s.name?.trim())) ||
    (b.typ === 'skillbar' && (b.skills || []).some(s => s.name?.trim()))
  )
}

function lebenslaufVollstaendig() {
  return Boolean(profile.schule && blockHatInhalt())
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

  setzeDokStatus('ausweis-status', profile.schuelerausweis_url, 'schuelerausweis_url')
  setzeDokStatus('bestaetigung-status', profile.schulbestaetigung_url, 'schulbestaetigung_url')
}

function setzeDokStatus(elId, pfad, spalte) {
  const el = document.getElementById(elId)
  if (!pfad) { el.innerHTML = ''; return }
  el.innerHTML = `Hochgeladen ✓ · <button type="button" class="dok-loeschen" data-pfad="${escapeHtml(pfad)}" data-spalte="${spalte}" style="background:none;border:none;color:var(--coral);cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;padding:0;text-decoration:underline;">Dokument löschen</button>`
  el.querySelector('.dok-loeschen').addEventListener('click', loescheDokument)
}

// Löscht das hochgeladene Verifizierungs-Dokument aus dem Storage + leert den DB-Pfad.
// Der Verifizierungs-Status (verifiziert) bleibt erhalten.
async function loescheDokument(e) {
  const btn = e.currentTarget
  const pfad = btn.dataset.pfad
  const spalte = btn.dataset.spalte
  if (!confirm('Dieses Dokument endgültig löschen? Dein Verifizierungs-Status bleibt erhalten.')) return

  btn.disabled = true
  btn.textContent = 'Wird gelöscht...'

  // 1) Datei aus dem privaten Storage entfernen
  const { error: storageError } = await supabase.storage.from('verifizierung').remove([pfad])
  if (storageError) {
    alert('Fehler beim Löschen der Datei: ' + storageError.message)
    btn.disabled = false; btn.textContent = 'Dokument löschen'
    return
  }

  // 2) Pfad in der Datenbank leeren, damit kein toter Verweis bleibt
  const { error: dbError } = await supabase.from('profiles').update({ [spalte]: null }).eq('id', profile.id)
  if (dbError) {
    alert('Datei gelöscht, aber DB-Pfad konnte nicht geleert werden: ' + dbError.message)
    return
  }

  profile[spalte] = null
  renderVerifyStatus()
  toast('Dokument gelöscht')
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
  aktualisiereSidebarUser()
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

  // Wohnort in Koordinaten umwandeln (für den Umkreis-Filter)
  const koord = await geocode(updates.ort)
  updates.lat = koord?.lat ?? null
  updates.lon = koord?.lon ?? null

  const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id)

  btn.disabled = false
  btn.textContent = 'Speichern'

  if (error) {
    alert('Fehler: ' + error.message)
    return
  }

  profile = { ...profile, ...updates }
  document.getElementById('user-name').textContent = profile.name
  aktualisiereSidebarUser()
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
    renderOnboarding()
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="14" width="36" height="26" rx="4"/><path d="M17 14v-3a4 4 0 014-4h6a4 4 0 014 4v3" stroke-linecap="round"/><path d="M6 24h36" /></svg>
        <p>Aktuell keine passenden Jobs verfügbar. Schau bald wieder vorbei!</p>
      </div>`
    return
  }

  const [{ data: bewerbungen }, { data: gemerkte }] = await Promise.all([
    supabase.from('bewerbungen').select('job_id, status').eq('schueler_id', profile.id),
    supabase.from('gemerkte_jobs').select('job_id').eq('schueler_id', profile.id)
  ])
  beworbenIds = new Set((bewerbungen || []).map(b => b.job_id))
  bewerbungsStatus = {}
  ;(bewerbungen || []).forEach(b => { bewerbungsStatus[b.job_id] = b.status || 'ausstehend' })
  gemerkteIds = new Set((gemerkte || []).map(g => g.job_id))

  // Sidebar-Badge: Anzahl Bewerbungen in Prüfung
  const offeneBew = (bewerbungen || []).filter(b => b.status !== 'angenommen' && b.status !== 'abgelehnt').length
  const bewBadge = document.getElementById('badge-bewerbungen-s')
  if (bewBadge) bewBadge.textContent = offeneBew > 0 ? offeneBew : ''

  renderStats(jobs.length, beworbenIds.size)
  renderOnboarding()

  alleJobs = jobs
  wendeJobFilterAn()
}

function wendeJobFilterAn() {
  const suche = document.getElementById('filter-suche').value.trim().toLowerCase()
  const ort = document.getElementById('filter-ort').value.trim().toLowerCase()
  const gehalt = parseFloat(document.getElementById('filter-gehalt').value) || null
  const kategorie = document.getElementById('filter-kategorie').value
  const arbeitszeit = document.getElementById('filter-arbeitszeit').value
  const sortierung = document.getElementById('sortierung').value
  const radiusEl = document.getElementById('filter-radius')
  const radius = radiusEl ? parseInt(radiusEl.value) : 0
  const habeKoord = profile.lat != null && profile.lon != null

  let gefiltert = alleJobs.filter(job => {
    if (suche && ![job.titel, job.beschreibung, job.kategorie, job.ort].some(f => (f || '').toLowerCase().includes(suche))) return false
    if (ort && !(job.ort || '').toLowerCase().includes(ort)) return false
    if (gehalt && !(job.stundenlohn >= gehalt)) return false
    if (kategorie && job.kategorie !== kategorie) return false
    if (arbeitszeit && job.arbeitszeit !== arbeitszeit) return false
    if (nurGemerkte && !gemerkteIds.has(job.id)) return false
    if (radius > 0 && habeKoord) {
      const d = distanzKm(profile.lat, profile.lon, job.lat, job.lon)
      if (d == null || d > radius) return false
    }
    return true
  })

  if (sortierung === 'lohn') {
    gefiltert = [...gefiltert].sort((a, b) => (b.stundenlohn || 0) - (a.stundenlohn || 0))
  }

  renderJobs(gefiltert)
}

async function toggleMerken(jobId, btn) {
  const istGemerkt = gemerkteIds.has(jobId)
  btn.disabled = true

  if (istGemerkt) {
    const { error } = await supabase.from('gemerkte_jobs')
      .delete().eq('schueler_id', profile.id).eq('job_id', jobId)
    if (!error) gemerkteIds.delete(jobId)
  } else {
    const { error } = await supabase.from('gemerkte_jobs')
      .insert({ schueler_id: profile.id, job_id: jobId })
    if (!error) gemerkteIds.add(jobId)
  }

  btn.disabled = false
  const jetztGemerkt = gemerkteIds.has(jobId)
  btn.classList.toggle('gemerkt', jetztGemerkt)
  toast(jetztGemerkt ? 'Job gemerkt ❤' : 'Job entfernt')
  if (nurGemerkte) wendeJobFilterAn()
}

function renderJobs(jobs) {
  const grid = document.getElementById('jobs-grid')
  const zaehler = document.getElementById('jobs-count')
  if (zaehler) zaehler.textContent = `${jobs.length} Job${jobs.length === 1 ? '' : 's'} gefunden`

  if (!jobs.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="14" width="36" height="26" rx="4"/><path d="M17 14v-3a4 4 0 014-4h6a4 4 0 014 4v3" stroke-linecap="round"/><path d="M6 24h36" /></svg>
        <p>${nurGemerkte ? 'Du hast noch keine Jobs gemerkt. Klick auf das Herz bei einem Job!' : 'Keine Jobs passen zu diesem Filter.'}</p>
      </div>`
    return
  }

  const herzSvg = '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.9-9.5-9.2C1.1 8.2 3 5 6.2 5c1.9 0 3.4 1 4.3 2.4l1.5 2.1 1.5-2.1C14.4 6 15.9 5 17.8 5 21 5 22.9 8.2 21.5 11.3c-2 4.3-9.5 9.2-9.5 9.2z"/></svg>'

  grid.innerHTML = jobs.map(job => {
    const dist = (profile.lat != null && job.lat != null) ? distanzKm(profile.lat, profile.lon, job.lat, job.lon) : null
    return `
    <div class="job-card job-card--clickable" data-detail="${job.id}">
      ${job.erstellt_am && (Date.now() - new Date(job.erstellt_am).getTime()) < 72 * 3600 * 1000 ? '<span class="neu-badge">NEU</span>' : ''}
      <button class="merken-btn ${gemerkteIds.has(job.id) ? 'gemerkt' : ''}" data-merken="${job.id}" aria-label="Job merken" title="Job merken">${herzSvg}</button>
      <div class="job-card-top">
        <div class="company-logo">${escapeHtml((job.titel || '?')[0].toUpperCase())}</div>
        <span class="job-badge" style="margin-right:44px;">${ICONS.age} ab ${job.mindestalter} J.</span>
      </div>
      <h3>${escapeHtml(job.titel)}</h3>
      <p class="company-name">${ICONS.pin} ${escapeHtml(job.ort || '')}${dist != null ? ` <span class="distanz-chip">${dist} km</span>` : ''}${job.kategorie ? ` <span class="kategorie-chip">${escapeHtml(job.kategorie)}</span>` : ''}${job.arbeitszeit ? ` <span class="arbeitszeit-chip">🕐 ${escapeHtml(job.arbeitszeit)}</span>` : ''}</p>
      ${job.beschreibung ? `<p class="job-description">${escapeHtml(job.beschreibung)}</p>` : ''}
      <div class="job-meta">
        ${job.stundenlohn ? `<span class="lohn-highlight">${job.stundenlohn} €/Std</span>` : ''}
        ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
      </div>
      ${beworbenIds.has(job.id)
        ? `<div class="job-status job-status--${bewerbungsStatus[job.id] || 'ausstehend'}">${schuelerStatusLabel(bewerbungsStatus[job.id])}</div>`
        : `<button class="btn btn-green btn-full" style="margin-top:14px;" data-job-id="${job.id}" data-job-titel="${escapeHtml(job.titel)}">Jetzt bewerben</button>`}
    </div>
  `}).join('')

  grid.querySelectorAll('button[data-job-id]').forEach(btn => {
    btn.addEventListener('click', () => oeffneBewerbungsModal(btn.dataset.jobId, btn.dataset.jobTitel, btn))
  })
  grid.querySelectorAll('button[data-merken]').forEach(btn => {
    btn.addEventListener('click', () => toggleMerken(btn.dataset.merken, btn))
  })
  grid.querySelectorAll('[data-detail]').forEach(karte => {
    karte.addEventListener('click', (e) => {
      if (e.target.closest('button')) return // Buttons (Merken/Bewerben) nicht abfangen
      oeffneDetail(karte.dataset.detail)
    })
  })
}

function oeffneDetail(jobId) {
  const job = alleJobs.find(j => j.id === jobId)
  if (!job) return

  supabase.rpc('job_aufruf_zaehlen', { p_job: jobId })

  document.getElementById('detail-titel').textContent = job.titel
  document.getElementById('detail-body').innerHTML = `
    <p class="company-name" style="margin-top:4px;">${ICONS.pin} ${escapeHtml(job.ort || '')}${job.kategorie ? ` <span class="kategorie-chip">${escapeHtml(job.kategorie)}</span>` : ''}${job.arbeitszeit ? ` <span class="arbeitszeit-chip">🕐 ${escapeHtml(job.arbeitszeit)}</span>` : ''}</p>
    <div class="job-meta" style="margin:14px 0;">
      <span>${ICONS.age} ab ${job.mindestalter} Jahren</span>
      ${job.stundenlohn ? `<span class="lohn-highlight">${job.stundenlohn} €/Std</span>` : ''}
      ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
    </div>
    ${job.beschreibung ? `<p style="font-size:0.95rem; line-height:1.7; color:var(--ink); white-space:pre-wrap;">${escapeHtml(job.beschreibung)}</p>` : '<p class="cv-preview-empty">Keine weitere Beschreibung vorhanden.</p>'}
  `

  const btn = document.getElementById('detail-bewerben-btn')
  const beworben = beworbenIds.has(job.id)
  btn.textContent = beworben ? schuelerStatusLabel(bewerbungsStatus[job.id]) : 'Jetzt bewerben'
  btn.disabled = beworben
  btn.className = beworben ? `job-status job-status--${bewerbungsStatus[job.id] || 'ausstehend'}` : 'btn btn-green btn-full'
  btn.style.marginTop = '20px'
  btn.style.width = '100%'
  btn.onclick = beworben ? null : () => {
    document.getElementById('job-detail-overlay').classList.remove('open')
    const kartenBtn = document.querySelector(`button[data-job-id="${job.id}"]`)
    oeffneBewerbungsModal(job.id, job.titel, kartenBtn)
  }

  document.getElementById('job-detail-overlay').classList.add('open')
  renderDetailBewertungen(job)
}

function sterneHtml(n) {
  let h = ''
  for (let i = 1; i <= 5; i++) h += `<span class="${i <= n ? '' : 'leer'}">★</span>`
  return `<span class="sterne-anzeige">${h}</span>`
}

function bewertungKarte(b) {
  const datum = b.erstellt_am ? new Date(b.erstellt_am).toLocaleDateString('de-DE', { year: 'numeric', month: 'short' }) : ''
  return `<div class="bewertung-card">
    <div class="kopf"><span class="name">${escapeHtml(b.schueler_name || 'Schüler:in')}</span><span class="verifiziert">✓ war hier</span></div>
    ${sterneHtml(b.sterne)}
    ${b.kommentar ? `<p>${escapeHtml(b.kommentar)}</p>` : ''}
    ${datum ? `<span class="datum">${datum}</span>` : ''}
  </div>`
}

// Zeigt Firmen-Bewertungen im Job-Detail. Angenommene Schüler bekommen ein Abgabe-Formular.
async function renderDetailBewertungen(job) {
  const body = document.getElementById('detail-body')
  let wrap = document.getElementById('detail-bewertungen')
  if (!wrap) {
    wrap = document.createElement('div')
    wrap.id = 'detail-bewertungen'
    wrap.style.marginTop = '8px'
    body.appendChild(wrap)
  }
  if (!job.firma_id) { wrap.innerHTML = ''; return }

  const { data } = await supabase.from('bewertungen')
    .select('sterne, kommentar, schueler_name, schueler_id, erstellt_am')
    .eq('firma_id', job.firma_id)
    .order('erstellt_am', { ascending: false })
  const liste = data || []
  const meine = liste.find(b => b.schueler_id === profile.id)
  const darfBewerten = bewerbungsStatus[job.id] === 'angenommen'

  let html = ''
  if (liste.length) {
    const schnitt = liste.reduce((s, b) => s + b.sterne, 0) / liste.length
    html += `<h3 style="margin-top:22px; font-size:1.05rem;">Bewertungen von ${escapeHtml(job.firma_name || 'dieser Firma')}</h3>`
    html += `<div class="bewertung-summary">${sterneHtml(Math.round(schnitt))}<span class="schnitt">${schnitt.toFixed(1)}</span><span class="anzahl">aus ${liste.length} ${liste.length === 1 ? 'Bewertung' : 'Bewertungen'}</span></div>`
    html += `<div class="bewertung-liste">${liste.slice(0, 5).map(bewertungKarte).join('')}</div>`
  }

  if (darfBewerten) {
    const start = meine ? meine.sterne : 0
    const sterne = [1, 2, 3, 4, 5].map(i => `<span data-wert="${i}" class="${i <= start ? 'aktiv' : ''}">★</span>`).join('')
    html += `<div class="bewerten-box">
      <h4>${meine ? 'Deine Bewertung bearbeiten' : `Wie war es bei ${escapeHtml(job.firma_name || 'dieser Firma')}?`}</h4>
      <p class="hinweis">Du siehst dieses Formular, weil du hier angenommen wurdest. Nur eine Bewertung pro Firma.</p>
      <div class="sterne-wahl" id="sterne-wahl">${sterne}</div>
      <textarea id="bewertung-text" maxlength="600" placeholder="Was sollten andere Schüler wissen? (optional)">${meine ? escapeHtml(meine.kommentar || '') : ''}</textarea>
      <div style="display:flex; gap:10px; margin-top:12px; align-items:center; flex-wrap:wrap;">
        <button type="button" class="btn btn-green" id="bewertung-senden">${meine ? 'Aktualisieren' : 'Bewertung abschicken'}</button>
        ${meine ? '<button type="button" class="btn btn-outline" id="bewertung-loeschen">Löschen</button>' : ''}
        <span id="bewertung-status" style="font-size:0.82rem; color:var(--ink-soft);"></span>
      </div>
    </div>`
  }

  wrap.innerHTML = html
  if (darfBewerten) verdrahteBewertenBox(job, meine)
}

function verdrahteBewertenBox(job, meine) {
  let gewaehlt = meine ? meine.sterne : 0
  const wahl = document.getElementById('sterne-wahl')
  wahl.querySelectorAll('span').forEach(s => {
    s.addEventListener('click', () => {
      gewaehlt = Number(s.dataset.wert)
      wahl.querySelectorAll('span').forEach(x => x.classList.toggle('aktiv', Number(x.dataset.wert) <= gewaehlt))
    })
  })

  document.getElementById('bewertung-senden').addEventListener('click', async () => {
    const status = document.getElementById('bewertung-status')
    if (!gewaehlt) { status.textContent = 'Bitte Sterne wählen.'; return }
    const kommentar = document.getElementById('bewertung-text').value.trim()
    status.textContent = 'Speichere …'
    const { error } = await supabase.from('bewertungen').upsert({
      firma_id: job.firma_id,
      schueler_id: profile.id,
      schueler_name: (profile.name || '').split(' ')[0] || 'Schüler:in',
      sterne: gewaehlt,
      kommentar: kommentar || null
    }, { onConflict: 'firma_id,schueler_id' })
    if (error) { status.textContent = 'Fehler: ' + error.message; return }
    toast('Danke für deine Bewertung! ⭐')
    renderDetailBewertungen(job)
  })

  const del = document.getElementById('bewertung-loeschen')
  if (del) del.addEventListener('click', async () => {
    const { error } = await supabase.from('bewertungen').delete()
      .eq('firma_id', job.firma_id).eq('schueler_id', profile.id)
    if (error) { document.getElementById('bewertung-status').textContent = 'Fehler: ' + error.message; return }
    toast('Bewertung gelöscht')
    renderDetailBewertungen(job)
  })
}

async function oeffneBewerbungsModal(jobId, jobTitel, btn) {
  if (!profile.verifiziert) {
    alert('Du musst dich erst als Schüler verifizieren, bevor du dich bewerben kannst.')
    document.querySelector('.sidebar-item[data-view="verifizierung"]').click()
    return
  }

  // Lebenslauf-Stand vor der Prüfung sichern, damit Firmen immer den aktuellen Stand sehen
  await persistiereLebenslauf()

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
  toast('Bewerbung abgeschickt! 🚀')
  await ladeJobs()
}

function schuelerStatusLabel(status) {
  if (status === 'angenommen') return '🎉 Angenommen – die Firma meldet sich!'
  if (status === 'abgelehnt') return 'Diesmal nicht geklappt – dranbleiben!'
  return '⏳ Beworben – Antwort ausstehend'
}

function renderStats(matchCount, beworbenCount) {
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-box"><b>${matchCount}</b><span>Passende Jobs</span></div>
    <div class="stat-box"><b>${beworbenCount}</b><span>Deine Bewerbungen</span></div>
  `
  const neu = alleJobs.filter(j => j.erstellt_am && (Date.now() - new Date(j.erstellt_am).getTime()) < 72 * 3600 * 1000).length
  document.getElementById('badge-jobs').textContent = neu > 0 ? neu : ''
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

init()
