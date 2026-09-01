// Eigenständiger Lebenslauf-Editor (lebenslauf.html)
// Links: aufklappbare Karten · Rechts: Live-Vorschau = das ECHTE PDF
// (per pdf.js auf Canvas gerendert – was man sieht, bekommt man exakt).

import { supabase } from './supabase.js'
import { requireAuth } from './session.js'
import { toast } from './toast.js'
import { verstaendlich } from './zustand.js'
import { erzeugeLebenslaufPdfMitAnkern, ladeLebenslaufAlsPdf } from './pdf.js'
import { sichereMediaUrl } from './sicher.js'
import { dokumentPfad, pfadAusUrl, pruefeFuerBucket, verwaisterPfad } from './dokument-pfad.js'

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

// ---------------------------------------------------------------------------
// UMBAU DES EDITORS (1.9.2026)
//
// Sanad: "wie man die sachen eintippt, es bearbeitet, reinschreibt, pfeil
// nach oben schiebt ist einfach haesslich und man checkt es nicht ganz
// schnell". Angesehen habe ich mir dafuer Resumonk, Kickresume, Rezi,
// Enhancv und lebenslauf.de. Was dort ueberall gleich ist:
//
//   1. Verschoben wird mit einem Griff zum Ziehen, nicht mit Pfeilchen.
//      Die Pfeile bleiben trotzdem - ohne sie waere es fuer Tastatur und
//      Vorlesehilfen nicht bedienbar (WCAG 2.2, 2.5.7 "Dragging
//      Movements" verlangt einen Weg ohne Ziehen).
//   2. Ein Abschnitt wird ueber eine benannte Auswahl hinzugefuegt, nicht
//      ueber acht gleichrangige Knoepfe nebeneinander.
//   3. Die Werkzeuge stehen nicht in der Kopfzeile, wo sie die
//      Ueberschrift zerdruecken.
//
// Und aus den deutschen Ratgebern: Ein Schueler-Lebenslauf ist
// tabellarisch und **antichronologisch** - das Neueste oben. Das steht
// jetzt in den Platzhaltern, damit niemand raten muss.

// Der Typ eines Abschnitts in Worten. An der Karte stand vorher
// "SKILLBAR" - das versteht niemand.
const TYP_NAME = {
  text: 'Text',
  skills: 'Stichworte',
  sprachen: 'Sprache & Niveau',
  skillbar: 'Fähigkeiten mit Balken',
  bild: 'Bild',
}

// Der Schieberegler sagt jetzt ein Wort statt einer Prozentzahl.
const STUFEN = ['Anfänger', 'Grundlagen', 'Geübt', 'Gut', 'Sehr gut', 'Stark']
function stufenWort(wert) {
  return STUFEN[Math.min(STUFEN.length - 1, Math.max(0, Math.round((Number(wert) || 0) / 20)))]
}

// Die Auswahl hinter "+ Abschnitt hinzufuegen". Jeder Eintrag sagt, wofuer
// er da ist - vorher musste man aus dem Knopfnamen raten.
const ABSCHNITTE = [
  {
    gruppe: 'Das gehört fast immer rein',
    eintraege: [
      { typ: 'text', titel: 'Schulbildung',
        was: 'Welche Schule, welche Klasse, welcher Abschluss.',
        platzhalter: `seit 2023 · Gymnasium Musterstadt, 9. Klasse
2019–2023 · Grundschule Nord` },
      { typ: 'text', titel: 'Erfahrung',
        was: 'Praktika, Ehrenamt, Babysitten, Nachbarschaftshilfe – alles zählt.',
        platzhalter: `März 2026 · Schülerpraktikum Bäckerei Kern
seit 2025 · Babysitten in der Nachbarschaft` },
      { typ: 'skillbar', titel: 'Fähigkeiten',
        was: 'Was du kannst, mit einem Balken dahinter.' },
    ],
  },
  {
    gruppe: 'Wenn es passt',
    eintraege: [
      { typ: 'sprachen', titel: 'Sprachen',
        was: 'Sprache und Niveau, von A1 bis Muttersprache.' },
      { typ: 'skills', titel: 'Interessen',
        was: 'Ein paar Stichworte, mit Komma getrennt.' },
      { typ: 'text', titel: 'Wann ich Zeit habe',
        was: 'Damit die Firma gleich sieht, ob es zu deinem Stundenplan passt.',
        platzhalter: 'Mo–Fr ab 15 Uhr · Wochenende flexibel · Ferien ganztags' },
      { typ: 'text', titel: '', name: 'Eigener Abschnitt',
        was: 'Einer, den du selbst benennst.' },
      { typ: 'bild', titel: '', name: 'Bild',
        was: 'Ein Zeugnis, eine Urkunde oder ein Foto von deiner Arbeit.' },
    ],
  },
]

/* ---------- Start ---------- */

// Der Editor steht statisch im HTML und war deshalb schon da, bevor
// requireAuth antworten konnte – man sah ihn kurz aufblitzen und wurde
// dann weggeschoben. Er wird jetzt bis zur Antwort zurueckgehalten.
// `visibility` statt `display`, damit sich das Layout nicht verschiebt.
function zeigeEditor() {
  document.querySelector('main')?.classList.remove('pruefe-zugang')
}

async function init() {
  // Der Lebenslauf-Editor ist eine Schuelerseite. Wer als Firma hier
  // landet (etwa ueber den Ratgeber), bekommt das gesagt – frueher wurde
  // er wortlos ins Formular zum Anzeigen-Aufgeben geschoben.
  profile = await requireAuth('schueler', {
    hinweis: {
      firma: {
        titel: 'Der Lebenslauf-Editor ist für Schüler',
        text: 'Du bist als Arbeitgeber angemeldet. Diese Seite hilft Schülern dabei, ' +
              'ihren Lebenslauf zu schreiben – für dich gibt es sie deshalb nicht. ' +
              'Was Schüler hier zusammenstellen, siehst du bei jeder Bewerbung auf deine Anzeigen.',
        knoepfe: [
          { text: 'Zu deinen Anzeigen', href: 'dashboard-firma.html' },
          { text: 'Zurück zum Ratgeber', href: 'ratgeber.html' },
        ],
      },
    },
  })
  // Erst freigeben, wenn feststeht, dass die Seite bleibt. Bei einer
  // Weiterleitung (nicht angemeldet) bliebe sie sonst kurz sichtbar,
  // genau der Effekt, der hier weg soll.
  if (!profile) return
  zeigeEditor()

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
    <details class="ll-karte ll-karte-fest" data-karte="persoenlich" ${offeneKarten.has('persoenlich') ? 'open' : ''}>
      <summary>
        <span class="ll-check ${persoenlichVoll ? 'ok' : ''}" aria-hidden="true">${persoenlichVoll ? '✓' : ''}</span>
        <span class="ll-karte-name">Persönliches</span>
        <span class="ll-karte-typ">Kopf des Lebenslaufs</span>
      </summary>
      <div class="ll-karte-body">
        <div class="ll-foto-zeile">
          <div class="cv-photo-preview" id="ll-foto-preview" style="${sichereMediaUrl(profile.foto_url) ? `background-image:url('${sichereMediaUrl(profile.foto_url)}')` : ''}">${sichereMediaUrl(profile.foto_url) ? '' : '📷'}</div>
          <div>
            <input type="file" id="ll-foto" accept="image/*" aria-label="Profilbild auswählen" style="display:none;">
            <button type="button" class="btn btn-outline ll-foto-knopf" id="ll-foto-btn">${profile.foto_url ? 'Foto ändern' : 'Foto hochladen'}</button>
            <p class="ll-feldhilfe">Freiwillig – niemand darf eins verlangen. Höchstens 3 MB.</p>
          </div>
        </div>
        <div class="form-group"><label for="ll-name">Name</label><input type="text" id="ll-name" value="${escapeHtml(profile.name || '')}" placeholder="Vor- und Nachname"></div>
        <div class="ll-zwei">
          <div class="form-group"><label for="ll-schule">Schule</label><input type="text" id="ll-schule" value="${escapeHtml(profile.schule || '')}" placeholder="z.B. Gymnasium Musterstadt"></div>
          <div class="form-group"><label for="ll-klasse">Klasse</label><input type="text" id="ll-klasse" value="${escapeHtml(profile.klasse || '')}" placeholder="z.B. 9. Klasse"></div>
        </div>
        <div class="ll-zwei">
          <div class="form-group"><label for="ll-ort">Ort</label><input type="text" id="ll-ort" value="${escapeHtml(profile.ort || '')}" placeholder="z.B. München"></div>
          <div class="form-group"><label for="ll-email">E-Mail</label><input type="text" id="ll-email" value="${escapeHtml(profile.email || '')}" disabled>
            <p class="ll-feldhilfe">Kommt aus deinem Konto und lässt sich hier nicht ändern.</p></div>
        </div>
      </div>
    </details>`]

  bloecke.forEach((b, i) => {
    const erste = i === 0
    const letzte = i === bloecke.length - 1
    karten.push(`
    <details class="ll-karte" data-karte="${b.id}" data-pos="${i}" ${offeneKarten.has(b.id) ? 'open' : ''}>
      <summary>
        <span class="ll-griff" aria-hidden="true" title="Ziehen zum Verschieben">⠿</span>
        <span class="ll-check ${blockGefuellt(b) ? 'ok' : ''}" aria-hidden="true">${blockGefuellt(b) ? '✓' : ''}</span>
        <span class="ll-karte-name">${escapeHtml(kartenTitel(b))}</span>
        <span class="ll-karte-typ">${TYP_NAME[b.typ] || b.typ}</span>
      </summary>
      <div class="ll-karte-body">
        <div class="form-group">
          <label for="titel-${b.id}">Überschrift</label>
          <input type="text" id="titel-${b.id}" class="ll-titel" data-id="${b.id}" value="${escapeHtml(b.titel || '')}" placeholder="z.B. Erfahrung">
        </div>
        ${editorFuer(b)}
        <div class="ll-karte-fuss">
          <button type="button" class="ll-werkzeug" data-hoch="${b.id}" ${erste ? 'disabled' : ''}>↑ Nach oben</button>
          <button type="button" class="ll-werkzeug" data-runter="${b.id}" ${letzte ? 'disabled' : ''}>↓ Nach unten</button>
          <button type="button" class="ll-werkzeug ll-werkzeug-weg" data-weg="${b.id}">Abschnitt löschen</button>
        </div>
      </div>
    </details>`)
  })

  wrap.innerHTML = karten.join('')
  bindeKarten(wrap)
  bindeZiehen(wrap)
  wachseMit(wrap)
  aktualisiereFortschritt()
}

function editorFuer(b) {
  if (b.typ === 'text') return `
    <div class="form-group">
      <label for="inhalt-${b.id}">Was drinstehen soll</label>
      <textarea id="inhalt-${b.id}" class="ll-inhalt" data-id="${b.id}" placeholder="${escapeHtml(b.platzhalter || 'Dein Text…')}" rows="4">${escapeHtml(b.inhalt || '')}</textarea>
      <p class="ll-feldhilfe">Eine Zeile pro Eintrag – das Neueste zuerst.</p>
    </div>
    <button type="button" class="ll-hilfe-knopf ll-tipp" data-id="${b.id}">💡 Beispielsatz einfügen</button>`

  if (b.typ === 'skills') return `
    <div class="form-group">
      <label for="tags-${b.id}">Stichworte</label>
      <input type="text" id="tags-${b.id}" class="ll-tags" data-id="${b.id}" value="${escapeHtml(b.tags || '')}" placeholder="Fußball, Zeichnen, Technik">
      <p class="ll-feldhilfe">Mit Komma getrennt. Vier bis sechs reichen.</p>
    </div>`

  if (b.typ === 'sprachen') return `
    <div class="ll-zeilen">
      ${(b.sprachen || []).map((sp, i) => `
        <div class="ll-zeile">
          <div class="form-group ll-zeile-haupt">
            <label for="spr-${b.id}-${i}">Sprache</label>
            <input type="text" id="spr-${b.id}-${i}" class="ll-sprache-name" data-id="${b.id}" data-i="${i}" placeholder="z.B. Deutsch" value="${escapeHtml(sp.name || '')}">
          </div>
          <div class="form-group ll-zeile-neben">
            <label for="niv-${b.id}-${i}">Niveau</label>
            <select id="niv-${b.id}-${i}" class="ll-sprache-niveau" data-id="${b.id}" data-i="${i}">
              ${CEFR_NIVEAUS.map(n => `<option ${sp.niveau === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
          <button type="button" class="ll-zeile-weg" data-zeile-weg="${b.id}" data-i="${i}">Entfernen</button>
        </div>`).join('')}
    </div>
    <button type="button" class="ll-hilfe-knopf" data-sprache-add="${b.id}">+ Sprache</button>`

  if (b.typ === 'skillbar') return `
    <div class="ll-zeilen">
      ${(b.skills || []).map((sk, i) => `
        <div class="ll-zeile">
          <div class="form-group ll-zeile-haupt">
            <label for="skn-${b.id}-${i}">Fähigkeit</label>
            <input type="text" id="skn-${b.id}-${i}" class="ll-skill-name" data-id="${b.id}" data-i="${i}" placeholder="z.B. Teamfähigkeit" value="${escapeHtml(sk.name || '')}">
          </div>
          <div class="form-group ll-zeile-neben">
            <label for="skw-${b.id}-${i}">Wie gut: <span class="ll-stufe" data-stufe="${b.id}-${i}">${stufenWort(sk.wert ?? 60)}</span></label>
            <input type="range" id="skw-${b.id}-${i}" class="ll-skill-wert" data-id="${b.id}" data-i="${i}" min="0" max="100" step="20" value="${sk.wert ?? 60}">
          </div>
          <button type="button" class="ll-zeile-weg" data-zeile-weg="${b.id}" data-i="${i}">Entfernen</button>
        </div>`).join('')}
    </div>
    <button type="button" class="ll-hilfe-knopf" data-skill-add="${b.id}">+ Fähigkeit</button>`

  if (b.typ === 'bild') return `
    <input type="file" class="ll-bild-datei" data-id="${b.id}" accept="image/*" aria-label="Bild auswählen" style="display:none;">
    <div class="ll-bild-zeile">
      <button type="button" class="btn btn-outline ll-bild-btn" data-id="${b.id}">${b.bild_url ? 'Bild ändern' : 'Bild auswählen'}</button>
      ${b.bild_url ? `<button type="button" class="btn btn-outline ll-bild-weg" data-id="${b.id}">Entfernen</button>` : ''}
    </div>
    ${sichereMediaUrl(b.bild_url) ? `<img src="${sichereMediaUrl(b.bild_url)}" class="block-image-preview" alt="Vorschau des hochgeladenen Bildes">` : ''}`

  return ''
}

// Textfelder wachsen mit dem Inhalt. Vorher blieb jedes bei vier Zeilen
// stehen und man tippte in ein Guckloch.
function wachseMit(wrap) {
  wrap.querySelectorAll('textarea.ll-inhalt').forEach(ta => {
    const passe = () => {
      ta.style.height = 'auto'
      ta.style.height = Math.max(96, ta.scrollHeight) + 'px'
    }
    ta.addEventListener('input', passe)
    passe()
  })
}

// Verschieben durch Ziehen am Griff. Finger und Maus laufen über dieselben
// Pointer-Ereignisse, deshalb funktioniert es auch am Handy.
//
// Während des Ziehens wird die Karte NUR optisch angehoben; verschoben wird
// erst beim Loslassen. Der erste Versuch schob die Karte schon während der
// Bewegung im Dokument herum – dabei wird sie kurz aus dem Dokument genommen
// und wieder eingesetzt, und genau das beendet die Pointer-Erfassung. Nach
// dem ersten Sprung kam kein Ereignis mehr an.
//
// Die beiden Knöpfe im Kartenfuß bleiben als Weg ohne Ziehen bestehen –
// ohne sie wäre die Reihenfolge mit der Tastatur nicht änderbar
// (WCAG 2.2, 2.5.7 "Dragging Movements").
function bindeZiehen(wrap) {
  const beweglich = () => [...wrap.querySelectorAll('details.ll-karte:not(.ll-karte-fest)')]

  wrap.querySelectorAll('.ll-griff').forEach(griff => {
    let karte = null
    let startY = 0
    let andere = []

    // `preventDefault()` auf pointerdown allein reicht nicht: <summary>
    // klappt auch beim anschliessenden click um. Den fangen wir hier ab.
    griff.addEventListener('click', e => { e.preventDefault(); e.stopPropagation() })

    griff.addEventListener('pointerdown', e => {
      e.preventDefault()            // sonst beginnt eine Textauswahl
      karte = griff.closest('details.ll-karte')
      startY = e.clientY
      // Die Lage der übrigen Karten einmal merken. Sie bewegen sich
      // während des Ziehens nicht, also stimmt das bis zum Loslassen.
      andere = beweglich().filter(k => k !== karte)
        .map(k => {
          const r = k.getBoundingClientRect()
          return { id: k.dataset.karte, mitte: r.top + r.height / 2 }
        })
      karte.classList.add('zieht')
      wrap.classList.add('ll-zieht-gerade')
      griff.setPointerCapture(e.pointerId)
    })

    griff.addEventListener('pointermove', e => {
      if (!karte) return
      karte.style.transform = `translateY(${e.clientY - startY}px)`
    })

    const loslassen = e => {
      if (!karte) return
      const y = e.clientY
      const id = karte.dataset.karte
      karte.style.transform = ''
      karte.classList.remove('zieht')
      wrap.classList.remove('ll-zieht-gerade')
      karte = null

      // An welche Stelle gehört sie jetzt? So viele Karten, wie oberhalb
      // des Zeigers enden, liegen künftig davor.
      const ziel = andere.filter(k => k.mitte < y).length
      const von = bloecke.findIndex(b => b.id === id)
      if (von < 0 || ziel === von) return
      const [b] = bloecke.splice(von, 1)
      bloecke.splice(ziel, 0, b)
      geaendert(true)
    }
    griff.addEventListener('pointerup', loslassen)
    griff.addEventListener('pointercancel', loslassen)
  })
}

// Die Auswahl hinter "+ Abschnitt hinzufügen". Vorher standen hier acht
// gleichrangige Knöpfe nebeneinander; jetzt sagt jeder Eintrag, wofür er da ist.
function renderAbschnittWahl() {
  const wrap = document.getElementById('ll-abschnitt-wahl')
  if (!wrap) return
  wrap.innerHTML = ABSCHNITTE.map((g, gi) => `
    <div class="ll-wahl-gruppe">
      <p class="ll-wahl-titel">${escapeHtml(g.gruppe)}</p>
      ${g.eintraege.map((e, i) => `
        <button type="button" class="ll-wahl" data-g="${gi}" data-nr="${i}">
          <b>${escapeHtml(e.name || e.titel)}</b>
          <span>${escapeHtml(e.was)}</span>
        </button>`).join('')}
    </div>`).join('')

  wrap.querySelectorAll('.ll-wahl').forEach(btn => btn.addEventListener('click', () => {
    const vorlage = ABSCHNITTE[Number(btn.dataset.g)].eintraege[Number(btn.dataset.nr)]
    const basis = { id: neueId(), typ: vorlage.typ, titel: vorlage.titel || '' }
    if (vorlage.platzhalter) basis.platzhalter = vorlage.platzhalter
    if (vorlage.typ === 'sprachen') basis.sprachen = [{ name: '', niveau: 'B1' }]
    if (vorlage.typ === 'skillbar') basis.skills = [{ name: '', wert: 60 }]
    bloecke.push(basis)
    offeneKarten.add(basis.id)          // gleich offen - man will ja tippen
    schliesseAbschnittWahl()
    geaendert(true)
    setTimeout(() => {
      document.querySelector(`details[data-karte="${basis.id}"] input, details[data-karte="${basis.id}"] textarea`)?.focus()
    }, 60)
  }))
}

function schliesseAbschnittWahl() {
  document.getElementById('ll-abschnitt-wahl')?.classList.remove('offen')
  document.getElementById('ll-abschnitt-btn')?.setAttribute('aria-expanded', 'false')
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
  wrap.querySelectorAll('.ll-skill-wert').forEach(el => el.addEventListener('input', () => {
    block(el.dataset.id).skills[el.dataset.i].wert = parseInt(el.value)
    // Das Wort neben der Beschriftung mitziehen - eine Prozentzahl sagt
    // niemandem etwas, "Gut" schon.
    const stufe = wrap.querySelector(`.ll-stufe[data-stufe="${el.dataset.id}-${el.dataset.i}"]`)
    if (stufe) stufe.textContent = stufenWort(el.value)
    geaendert(false)
  }))

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
  // Abschnitt hinzufügen: ein Knopf, der eine benannte Auswahl aufklappt.
  renderAbschnittWahl()
  const wahlBtn = document.getElementById('ll-abschnitt-btn')
  const wahl = document.getElementById('ll-abschnitt-wahl')
  wahlBtn?.addEventListener('click', () => {
    const offen = wahl.classList.toggle('offen')
    wahlBtn.setAttribute('aria-expanded', String(offen))
    if (offen) wahl.querySelector('.ll-wahl')?.focus()
  })
  document.addEventListener('keydown', e => { if (e.key === 'Escape') schliesseAbschnittWahl() })

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
  // Groesse UND Dateiart pruefen. Ohne die Typpruefung kaeme
  // dokumentPfad() mit null zurueck und der Upload liefe ins Leere.
  const pruefung = pruefeFuerBucket(file, 'avatars')
  if (!pruefung.ok) { toast(pruefung.fehler, 'fehler'); e.target.value = ''; return }

  const btn = document.getElementById('ll-foto-btn')
  btn.disabled = true; btn.textContent = 'Wird hochgeladen…'

  // Pfad aus dem MIME-Typ, nicht aus dem Dateinamen - und `avatars` ist
  // ein OEFFENTLICHER Bucket: Eine zurueckgebliebene Datei waere unter
  // ihrer alten Adresse fuer immer abrufbar. Siehe js/dokument-pfad.js.
  const path = dokumentPfad(profile.id, 'avatar', file.type)
  const alterPfad = verwaisterPfad(pfadAusUrl(profile.foto_url, 'avatars'), path)
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (upErr) { toast(verstaendlich(upErr, 'Das Hochladen'), 'fehler'); btn.disabled = false; btn.textContent = 'Foto hochladen'; return }
  if (alterPfad) await supabase.storage.from('avatars').remove([alterPfad])

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const foto_url = data.publicUrl + '?t=' + Date.now()
  const { error: dbErr } = await supabase.from('profiles').update({ foto_url }).eq('id', profile.id)
  btn.disabled = false
  if (dbErr) { toast(verstaendlich(dbErr, 'Das Speichern'), 'fehler'); return }

  profile.foto_url = foto_url
  toast('Foto gespeichert!')
  renderKarten()
  planeVorschau()
}

async function ladeBlockBildHoch(blockId, file) {
  if (!file) return
  const b = bloecke.find(x => x.id === blockId)

  const pruefung = pruefeFuerBucket(file, 'lebenslauf-bilder')
  if (!pruefung.ok) { toast(pruefung.fehler, 'fehler'); return }

  // Pfad aus dem MIME-Typ. Auch dieser Bucket ist oeffentlich.
  const path = dokumentPfad(profile.id, blockId, file.type)
  const alterPfad = verwaisterPfad(pfadAusUrl(b?.bild_url, 'lebenslauf-bilder'), path)
  const { error } = await supabase.storage.from('lebenslauf-bilder').upload(path, file, { upsert: true })
  if (error) { toast(verstaendlich(error, 'Das Hochladen'), 'fehler'); return }
  if (alterPfad) await supabase.storage.from('lebenslauf-bilder').remove([alterPfad])
  const { data } = supabase.storage.from('lebenslauf-bilder').getPublicUrl(path)
  b.bild_url = data.publicUrl + '?t=' + Date.now()
  geaendert(true)
}

init()
