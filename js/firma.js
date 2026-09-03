// Die öffentliche Firmenseite (2.9.2026).
//
// ANLASS: Sanad – „wir müssen uns mal ums Firmenprofil kümmern".
// Der Ist-Zustand war dünn: Das Firmenprofil bestand aus Firmenname,
// Standort und einer Mail-Einstellung. Eine öffentliche Seite gab es
// nicht. Ein Schüler sah auf der Anzeige einen Namen und einen Buchstaben
// im Kreis — weniger als bei einem Kleinanzeigen-Inserat. Auf einer
// Plattform, auf der sich Minderjährige bewerben, ist das die falsche
// Reihenfolge.
//
// WAS DIESE SEITE OHNE DATENBANKÄNDERUNG KANN
// Öffentlich lesbar sind heute schon die Anzeigen (mit `firma_name`) und
// die Bewertungen. Damit funktioniert die Seite sofort: Name, offene
// Stellen, Bewertungen.
//
// WAS `supabase/firma-oeffentlich.sql` DAZUGIBT
// Ein Firmenprofil darf sonst niemand lesen außer der Firma selbst. Die
// Datei legt eine SICHT mit genau den öffentlichen Spalten an — Logo und
// „Wer wir sind" kommen erst damit. Bis dahin bleibt der Block weg,
// statt leer dazustehen.

import { supabase } from './supabase.js'
import { ICONS } from './icons.js'
import { hole, zeigeLadefehler } from './zustand.js'
import { sichereMediaUrl } from './sicher.js'
import { jobKarteHtml } from './job-karte.js'

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

const el = () => document.getElementById('firma-seite')

function zeigeNichtGefunden() {
  el().innerHTML = `
    <div class="empty-state">
      <h1>Diesen Arbeitgeber gibt es hier nicht</h1>
      <p>Vielleicht wurde die Seite entfernt, oder der Link stimmt nicht.</p>
      <div class="fehler-knoepfe">
        <a class="btn btn-green" href="jobs.html">Alle Jobs ansehen</a>
      </div>
    </div>`
}

// „auf SchülerMatch seit März 2026" – eine kleine, aber ehrliche Angabe:
// Wie lange ist die Firma schon dabei?
function seitText(wert) {
  if (!wert) return ''
  const d = new Date(wert)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

async function laden() {
  const id = new URLSearchParams(location.search).get('id')
  if (!id) { zeigeNichtGefunden(); return }

  // Die Anzeigen sind öffentlich lesbar – sie tragen auch den Firmennamen.
  const { data: jobs, gestoert } = await hole(supabase
    .from('jobs')
    .select('*')
    .eq('firma_id', id)
    .eq('aktiv', true)
    .order('erstellt_am', { ascending: false }))

  if (gestoert) {
    zeigeLadefehler(el(), laden, 'Die Seite konnte gerade nicht geladen werden.')
    return
  }

  // Das Profil kommt aus der Sicht `firmen_oeffentlich`. Gibt es sie noch
  // nicht (supabase/firma-oeffentlich.sql nicht eingespielt), liefert
  // Supabase einen Fehler – dann geht es ohne weiter, statt abzubrechen.
  let profil = null
  try {
    const { data } = await supabase
      .from('firmen_oeffentlich')
      .select('*')
      .eq('id', id)
      .single()
    profil = data || null
  } catch { profil = null }

  const name = profil?.name || jobs?.[0]?.firma_name || ''
  if (!name && !(jobs || []).length) { zeigeNichtGefunden(); return }

  // Bewertungen sind öffentlich lesbar.
  const { data: bewertungen } = await hole(supabase
    .from('bewertungen')
    .select('*')
    .eq('firma_id', id)
    .order('erstellt_am', { ascending: false }))

  render({ id, name, profil, jobs: jobs || [], bewertungen: bewertungen || [] })
}

function render({ id, name, profil, jobs, bewertungen }) {
  const logo = sichereMediaUrl(profil?.foto_url)
  const ort = profil?.ort || jobs[0]?.ort || ''
  const seit = seitText(profil?.erstellt_am)

  document.title = `${name || 'Arbeitgeber'} – SchülerMatch`

  el().innerHTML = `
    <a href="jobs.html" class="mono" style="color:var(--ink-soft); font-size:0.82rem;">← Alle Jobs</a>

    <div class="firma-kopf">
      <div class="firma-logo" ${logo ? `style="background-image:url('${logo}')"` : ''}>${
        logo ? '' : escapeHtml((name || '?')[0].toUpperCase())}</div>
      <div>
        <h1>${escapeHtml(name || 'Arbeitgeber')}</h1>
        <p class="company-name">${ort ? `${ICONS.pin} ${escapeHtml(ort)}` : ''}</p>
        <p class="firma-marken">
          <span class="firma-marke">✓ Von SchülerMatch geprüft</span>
          ${seit ? `<span class="firma-marke firma-marke--leise">dabei seit ${escapeHtml(seit)}</span>` : ''}
        </p>
      </div>
    </div>

    ${profil?.ueber_mich ? `
      <section>
        <h2>Wer wir sind</h2>
        <p style="white-space:pre-wrap;">${escapeHtml(profil.ueber_mich)}</p>
      </section>` : ''}

    <section>
      <h2>Offene Stellen${jobs.length ? ` (${jobs.length})` : ''}</h2>
      ${jobs.length
        ? `<div class="jobs-grid">${jobs.map(j => jobKarteHtml(j, { klickbar: true })).join('')}</div>`
        : '<p class="cv-preview-empty">Gerade ist keine Anzeige online.</p>'}
    </section>

    <section>
      <h2>Was Schüler sagen${bewertungen.length ? ` (${bewertungen.length})` : ''}</h2>
      ${bewertungen.length
        ? bewertungen.map(b => `
            <div class="firma-bewertung">
              <b>${escapeHtml(b.schueler_name || 'Ein Schüler')}</b>
              ${b.kommentar ? `<p>${escapeHtml(b.kommentar)}</p>` : ''}
            </div>`).join('')
        : `<p class="cv-preview-empty">Noch keine Bewertungen. Sie können nur von
           Schülern kommen, die hier tatsächlich angenommen wurden.</p>`}
    </section>`

  // Von der Karte in die Anzeige.
  el().querySelectorAll('[data-detail]').forEach(karte => {
    const auf = () => { location.href = `job.html?id=${encodeURIComponent(karte.dataset.detail)}` }
    karte.addEventListener('click', auf)
    karte.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      auf()
    })
  })
}

laden()
