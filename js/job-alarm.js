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
      <button type="button" class="btn btn-green" id="alarm-an">Job-Alarm einrichten</button>`
    el('alarm-an').addEventListener('click', () => einrichten())
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
    </div>`

  if (el('alarm-an')) el('alarm-an').addEventListener('click', () => schalte(true))
  if (el('alarm-aus')) el('alarm-aus').addEventListener('click', () => schalte(false))
  if (el('alarm-neu')) el('alarm-neu').addEventListener('click', () => einrichten())
}

function knoepfeSperren(gesperrt) {
  karte?.querySelectorAll('button').forEach(b => { b.disabled = gesperrt })
}

// Legt den Alarm an oder überschreibt ihn mit dem aktuellen Filterstand.
async function einrichten() {
  const f = filterLesen()

  if (!f.ort) {
    toast('Trag oben links einen Ort ein — sonst wissen wir nicht, wo wir suchen sollen.', 'fehler')
    el('filter-ort')?.focus()
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
    toast('Job-Alarm eingerichtet. Wir melden uns, sobald etwas Passendes kommt.')
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
    toast(an ? 'Job-Alarm wieder an.' : 'Job-Alarm aus. Du kannst ihn jederzeit wieder einschalten.')
  } catch (e) {
    console.error(e)
    toast('Das hat gerade nicht geklappt. Versuch es später noch einmal.', 'fehler')
  } finally {
    knoepfeSperren(false)
  }
}

/**
 * @param {object} p        Profil des eingeloggten Schülers
 * @param {Function} lesen  liefert { ort, umkreis, kategorie, arbeitszeit, minLohn }
 */
export async function initJobAlarm(p, lesen) {
  profile = p
  filterLesen = lesen
  karte = el('alarm-karte')
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
    return
  }

  alarm = data
  karte.hidden = false
  zeichne()
}
