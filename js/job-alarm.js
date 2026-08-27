// Job-Alarm im Schüler-Dashboard.
//
// Sitzt unter der Jobliste — an der Stelle, an der jemand merkt, dass
// gerade nichts Passendes dabei ist. Genau dann ist der Alarm etwas
// wert, und genau dann stehen die Filter schon so, wie er sie will:
// Der Alarm übernimmt sie einfach.
//
// GRACEFUL DEGRADATION: Solange die Tabelle `job_alarme` in der
// Datenbank noch nicht angelegt ist, bleibt die Karte unsichtbar,
// statt eine Fehlermeldung zu zeigen. Ein Schüler soll nichts von
// einer halbfertigen Baustelle mitbekommen.
import { supabase } from './supabase.js'
import { geocode } from './geo.js'
import { toast } from './toast.js'

let profile = null
let alarm = null          // die gespeicherte Zeile, oder null
let filterLesen = null    // Funktion, die den aktuellen Filterstand liefert
let karte = null

function el(id) { return document.getElementById(id) }

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, z => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]))
}

function normOrt(s) { return String(s ?? '').trim().toLowerCase() }

// Beschreibt in einem Satz, wonach der Alarm sucht.
function beschreibung(a) {
  const teile = []
  teile.push(a.kategorie ? a.kategorie : 'Alle Bereiche')
  if (a.ort) teile.push(`${a.ort} (${a.umkreis_km} km)`)
  if (a.arbeitszeit) teile.push(a.arbeitszeit)
  if (a.min_lohn) teile.push(`ab ${a.min_lohn} €/Std`)
  return teile.join(' · ')
}

function zeichne() {
  if (!karte) return

  if (!alarm) {
    karte.className = 'alarm-karte'
    karte.innerHTML = `
      <div class="alarm-text">
        <b>Nichts Passendes dabei?</b>
        <p>Wir schreiben dir, sobald ein Job dazukommt, der zu deiner Suche passt.
           Höchstens eine E-Mail pro Tag.</p>
      </div>
      <button type="button" class="btn btn-green" id="alarm-an">Mit dieser Suche einrichten</button>
      <button type="button" class="alarm-link" id="alarm-zu-einstellungen">oder selbst einstellen</button>`
    el('alarm-an').addEventListener('click', () => einrichten())
    el('alarm-zu-einstellungen').addEventListener('click', zuEinstellungen)
    return
  }

  const aus = !alarm.aktiv
  karte.className = aus ? 'alarm-karte' : 'alarm-karte alarm-an'
  karte.innerHTML = `
    <div class="alarm-text">
      <b>${aus ? 'Job-Alarm ist aus' : 'Job-Alarm läuft'}</b>
      <p>${aus
        ? 'Du bekommst gerade keine E-Mails über neue Jobs.'
        : `Wir melden uns bei neuen Jobs: <span class="alarm-kriterien">${esc(beschreibung(alarm))}</span>`}</p>
    </div>
    <div class="alarm-knoepfe">
      ${aus
        ? '<button type="button" class="btn btn-green" id="alarm-an">Wieder einschalten</button>'
        : '<button type="button" class="btn btn-outline" id="alarm-neu">Auf aktuelle Filter setzen</button>' +
          '<button type="button" class="btn btn-outline" id="alarm-aus">Ausschalten</button>'}
      <button type="button" class="alarm-link" id="alarm-zu-einstellungen">Einstellungen</button>
    </div>`

  if (el('alarm-an')) el('alarm-an').addEventListener('click', () => schalte(true))
  if (el('alarm-aus')) el('alarm-aus').addEventListener('click', () => schalte(false))
  if (el('alarm-neu')) el('alarm-neu').addEventListener('click', () => einrichten())
  if (el('alarm-zu-einstellungen')) el('alarm-zu-einstellungen').addEventListener('click', zuEinstellungen)
}

// Springt in den Bereich „Einstellungen". Ueber die Seitenleiste, damit
// die Umschaltung dort passiert, wo sie ohnehin gebaut ist - eine eigene
// Kopie waere eine zweite Stelle, die kaputtgehen kann.
function zuEinstellungen() {
  document.querySelector('.sidebar-item[data-view="einstellungen"]')?.click()
  el('alarm-ort')?.focus()
}

function knoepfeSperren(gesperrt) {
  karte?.querySelectorAll('button').forEach(b => { b.disabled = gesperrt })
}

// Legt den Alarm an oder überschreibt ihn.
//
// `quelle` liefert die Werte — entweder aus den Job-Filtern (Schnellweg
// unter der Liste) oder aus dem Formular im Bereich „Einstellungen".
// Beide schreiben dieselbe Zeile; es gibt genau einen Alarm je Schüler.
async function einrichten(quelle = filterLesen) {
  const f = quelle()

  if (!f.ort) {
    // Je nachdem, woher der Aufruf kam, steht das Ortsfeld woanders.
    const feld = el('alarm-ort')?.offsetParent ? el('alarm-ort') : el('filter-ort')
    toast('Trag einen Ort ein — sonst wissen wir nicht, wo wir suchen sollen.', 'fehler')
    feld?.focus()
    return
  }

  knoepfeSperren(true)
  try {
    // Koordinaten für die Umkreissuche.
    //
    // ACHTUNG: geocode() gibt NIE null zurück, sondern immer ein Objekt
    // mit `status` — 'ok', 'unbekannt' oder 'gestoert'. Ein schlichtes
    // `if (geo)` ist deshalb immer wahr und schreibt `undefined` in die
    // Felder. Genau diese Unterscheidung ist der Grund, warum es in
    // js/geo.js drei Zustände statt zwei gibt.
    //
    // Die Koordinaten müssen immer zu `ort` in derselben Zeile passen.
    // Darum:
    //   ok         -> übernehmen
    //   unbekannt  -> leeren, es wird über den Ortsnamen verglichen
    //   gestoert   -> nur die bisherigen behalten, wenn der Ort GLEICH
    //                 geblieben ist. Sonst zeigten sie auf die alte
    //                 Stadt, und der Umkreis suchte am falschen Fleck.
    let lat = null, lon = null
    const geo = await geocode(f.ort)
    if (geo.status === 'ok') {
      lat = geo.lat
      lon = geo.lon
    } else if (geo.status === 'gestoert' && alarm && normOrt(alarm.ort) === normOrt(f.ort)) {
      lat = alarm.lat ?? null
      lon = alarm.lon ?? null
    }

    const zeile = {
      schueler_id: profile.id,
      ort: f.ort,
      lat, lon,
      umkreis_km: f.umkreis || 25,
      kategorie: f.kategorie || null,
      arbeitszeit: f.arbeitszeit || null,
      min_lohn: f.minLohn || null,
      aktiv: true,
    }

    // upsert auf schueler_id: Es gibt genau einen Alarm je Schüler.
    const { data, error } = await supabase
      .from('job_alarme')
      .upsert(zeile, { onConflict: 'schueler_id' })
      .select()
      .single()

    if (error) throw error
    alarm = data
    zeichne()
    zeichneFormular()
    toast('Job-Alarm gespeichert. Wir melden uns, sobald etwas Passendes kommt.')
  } catch (e) {
    console.error(e)
    toast('Der Job-Alarm ließ sich gerade nicht speichern. Versuch es später noch einmal.', 'fehler')
  } finally {
    knoepfeSperren(false)
  }
}

async function schalte(an) {
  knoepfeSperren(true)
  try {
    const { data, error } = await supabase
      .from('job_alarme')
      .update({ aktiv: an })
      .eq('schueler_id', profile.id)
      .select()
      .single()
    if (error) throw error
    alarm = data
    zeichne()
    zeichneFormular()
    toast(an ? 'Job-Alarm wieder an.' : 'Job-Alarm aus. Du kannst ihn jederzeit wieder einschalten.')
  } catch (e) {
    console.error(e)
    toast('Das hat gerade nicht geklappt. Versuch es später noch einmal.', 'fehler')
  } finally {
    knoepfeSperren(false)
  }
}


/* ---------- Bereich „Einstellungen" ----------
   Bis zum 27.8. liess sich der Alarm nur unter der Jobliste einrichten -
   und nur, indem er die dort gesetzten Filter uebernahm. Wer ihn spaeter
   anpassen wollte, musste erst die Filter wieder so stellen. Hier stellt
   der Schueler ihn direkt ein.
   Die Karte unter der Liste bleibt: Wer dort ankommt, hat gerade nichts
   Passendes gefunden, und der Schnellweg ist genau dann richtig. */

let formular = null

// Was im Formular steht, in derselben Form wie die Job-Filter.
function formularWerte() {
  const wert = id => (el(id)?.value ?? '').trim()
  return {
    ort: wert('alarm-ort') || profile.ort || '',
    umkreis: parseInt(wert('alarm-umkreis'), 10) || 25,
    kategorie: wert('alarm-kategorie'),
    arbeitszeit: wert('alarm-arbeitszeit'),
    minLohn: parseFloat(wert('alarm-lohn')) || null,
  }
}

// Traegt den gespeicherten Alarm ins Formular ein. Gibt es noch keinen,
// bleiben die Felder leer bis auf den Wohnort - damit niemand vor einem
// leeren Ortsfeld sitzt.
function zeichneFormular() {
  if (!formular) return

  const status = el('alarm-status')
  const schalter = el('alarm-schalter')

  if (!alarm) {
    if (status) { status.textContent = 'noch nicht eingerichtet'; status.className = 'einst-status' }
    if (schalter) schalter.hidden = true
    if (el('alarm-ort') && !el('alarm-ort').value) el('alarm-ort').value = profile.ort || ''
    return
  }

  if (status) {
    status.textContent = alarm.aktiv ? 'läuft' : 'ausgeschaltet'
    status.className = alarm.aktiv ? 'einst-status einst-status--an' : 'einst-status'
  }

  el('alarm-ort').value = alarm.ort || ''
  el('alarm-umkreis').value = String(alarm.umkreis_km || 25)
  el('alarm-kategorie').value = alarm.kategorie || ''
  el('alarm-arbeitszeit').value = alarm.arbeitszeit || ''
  el('alarm-lohn').value = alarm.min_lohn ?? ''

  if (schalter) {
    schalter.hidden = false
    schalter.textContent = alarm.aktiv ? 'Job-Alarm ausschalten' : 'Wieder einschalten'
  }
}

function initFormular() {
  formular = el('alarm-form')
  if (!formular) return

  formular.addEventListener('submit', e => {
    e.preventDefault()
    einrichten(formularWerte)
  })

  // Schnellweg auch von hier: uebernimmt, was in der Jobboerse gerade
  // eingestellt ist.
  el('alarm-von-filtern')?.addEventListener('click', () => {
    const f = filterLesen()
    el('alarm-ort').value = f.ort || ''
    el('alarm-umkreis').value = String(f.umkreis || 25)
    el('alarm-kategorie').value = f.kategorie || ''
    el('alarm-arbeitszeit').value = f.arbeitszeit || ''
    el('alarm-lohn').value = f.minLohn ?? ''
    toast('Übernommen. Zum Speichern noch auf „Job-Alarm speichern".', 'info')
  })

  el('alarm-schalter')?.addEventListener('click', () => schalte(!alarm?.aktiv))
}

/**
 * @param {object} p        Profil des eingeloggten Schülers
 * @param {Function} lesen  liefert { ort, umkreis, kategorie, arbeitszeit, minLohn }
 */
export async function initJobAlarm(p, lesen) {
  profile = p
  filterLesen = lesen
  karte = el('alarm-karte')
  initFormular()
  if (!karte) return

  const { data, error } = await supabase
    .from('job_alarme')
    .select('*')
    .eq('schueler_id', profile.id)
    .maybeSingle()

  if (error) {
    // Tabelle noch nicht angelegt (oder nicht erreichbar): Karte
    // stumm ausblenden statt Fehler zeigen.
    console.warn('Job-Alarm nicht verfügbar:', error.message)
    karte.hidden = true
    // Auch der Bereich „Einstellungen" bleibt dann leer statt kaputt.
    if (el('alarm-status')) el('alarm-status').textContent = 'gerade nicht erreichbar'
    return
  }

  alarm = data
  karte.hidden = false
  zeichne()
  zeichneFormular()
}
