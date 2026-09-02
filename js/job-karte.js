// Die Jobkarte – an EINER Stelle (2.9.2026).
//
// ANLASS: Sanad – „wir kümmern uns mal um das ganze Jobs- und
// Bewerbungssystem […] auf das maximale Level".
//
// Der erste Befund war kein Aussehen, sondern eine Zählung: Dieselbe
// Jobkarte wurde an VIER Stellen einzeln gebaut – js/jobs.js (Jobbörse),
// js/dashboard-schueler.js (eingeloggt), js/jobs-preview.js (Startseite)
// und js/dashboard-firma.js (eigene Anzeigen). Was das kostet, hat sich
// am 1.9. gezeigt: Die Korrektur „ab null J." musste in FÜNF Dateien
// einzeln nachgezogen werden. Wer eine vergisst, hat einen Fehler, den
// niemand sieht.
//
// Deshalb: eine Quelle. Was hier steht, gilt überall.
//
// Bewusst OHNE Supabase-Import. So kann ein Test die Karte direkt bauen
// und prüfen – das Muster, das im Projekt schon Trefferlogik,
// Chat-Warnungen und Dateipfade aus dem Blindflug geholt hat.

import { ICONS } from './icons.js'

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

// Wie lange eine Anzeige als "NEU" gilt.
export const NEU_STUNDEN = 72

export function istNeu(job, jetzt = Date.now()) {
  if (!job?.erstellt_am) return false
  const t = new Date(job.erstellt_am).getTime()
  if (!Number.isFinite(t)) return false
  return jetzt - t < NEU_STUNDEN * 3600 * 1000
}

// „vor 2 Tagen" statt eines Datums.
//
// Indeed und StepStone schreiben das an jede Karte, und aus gutem Grund:
// Ob eine Anzeige von gestern oder von vor drei Monaten ist, entscheidet,
// ob sich das Bewerben überhaupt lohnt. Ein Datum muss man umrechnen,
// „vor 2 Tagen" nicht.
export function alterText(job, jetzt = Date.now()) {
  if (!job?.erstellt_am) return ''
  const t = new Date(job.erstellt_am).getTime()
  if (!Number.isFinite(t)) return ''
  const tage = Math.floor((jetzt - t) / (24 * 3600 * 1000))
  if (tage < 0) return ''                       // Datum in der Zukunft
  if (tage === 0) return 'heute eingestellt'
  if (tage === 1) return 'gestern eingestellt'
  if (tage < 7) return `vor ${tage} Tagen eingestellt`
  if (tage < 14) return 'vor einer Woche eingestellt'
  if (tage < 31) return `vor ${Math.floor(tage / 7)} Wochen eingestellt`
  if (tage < 60) return 'vor einem Monat eingestellt'
  return `vor ${Math.floor(tage / 30)} Monaten eingestellt`
}

// Ab hier lohnt die Nachfrage, ob die Stelle ueberhaupt noch frei ist.
export const ALT_TAGE = 60

export function istAlt(job, jetzt = Date.now()) {
  if (!job?.erstellt_am) return false
  const t = new Date(job.erstellt_am).getTime()
  if (!Number.isFinite(t)) return false
  return (jetzt - t) / (24 * 3600 * 1000) >= ALT_TAGE
}

// Das Mindestalter in Worten. Stand früher in fünf Dateien einzeln –
// und war in allen fünf falsch, solange `null` möglich war.
export function altersText(job) {
  return job?.mindestalter == null ? 'Alter auf Anfrage' : `ab ${job.mindestalter} J.`
}

function anfangsbuchstabe(job) {
  return escapeHtml(((job.firma_name || job.titel || '?')[0]).toUpperCase())
}

const HERZ = '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.9-9.5-9.2C1.1 8.2 3 5 6.2 5c1.9 0 3.4 1 4.3 2.4l1.5 2.1 1.5-2.1C14.4 6 15.9 5 17.8 5 21 5 22.9 8.2 21.5 11.3c-2 4.3-9.5 9.2-9.5 9.2z"/></svg>'

/**
 * Baut eine Jobkarte.
 *
 * @param {object} job     Die Anzeige.
 * @param {object} o       Was diese Ansicht zusätzlich kann:
 *   titelAlsKnopf  Überschrift als <button> (Dashboard: Karte ist nicht
 *                  als Ganzes klickbar, der Titel öffnet die Ansicht).
 *   klickbar       Ganze Karte öffnet die Ansicht (Jobbörse).
 *   merkbar        Herz zum Merken zeigen.
 *   gemerkt        Herz ist gefüllt.
 *   distanz        Entfernung in km, wenn berechenbar.
 *   fussHtml       Was unten steht (Bewerben-Knopf oder Status).
 *   jetzt          Für Tests: fester Zeitpunkt.
 */
export function jobKarteHtml(job, o = {}) {
  const alter = alterText(job, o.jetzt ?? Date.now())
  const klick = o.klickbar
    ? ` job-card--clickable" data-detail="${job.id}" role="button" tabindex="0" aria-label="Details zu ${escapeHtml(job.titel)}`
    : ` job-card--clickable" data-detail="${job.id}`

  return `
    <div class="job-card${klick}">
      ${istNeu(job, o.jetzt ?? Date.now()) ? '<span class="neu-badge">NEU</span>' : ''}
      ${o.merkbar ? `<button class="merken-btn ${o.gemerkt ? 'gemerkt' : ''}" data-merken="${job.id}" aria-label="Job merken" title="Job merken">${HERZ}</button>` : ''}

      <div class="job-card-top">
        <div class="company-logo">${anfangsbuchstabe(job)}</div>
        <span class="job-badge"${o.merkbar ? ' style="margin-right:44px;"' : ''}>${ICONS.age} ${altersText(job)}</span>
      </div>

      <h3>${o.titelAlsKnopf
        ? `<button type="button" class="job-titel-btn" data-detail-btn="${job.id}">${escapeHtml(job.titel)}</button>`
        : escapeHtml(job.titel)}</h3>
      ${job.firma_name ? `<p class="job-firma">bei ${escapeHtml(job.firma_name)}</p>` : ''}

      <p class="company-name">${ICONS.pin} ${escapeHtml(job.ort || '')}${
        o.distanz != null ? ` <span class="distanz-chip">${o.distanz} km</span>` : ''}${
        job.kategorie ? ` <span class="kategorie-chip">${escapeHtml(job.kategorie)}</span>` : ''}${
        job.arbeitszeit ? ` <span class="arbeitszeit-chip">🕐 ${escapeHtml(job.arbeitszeit)}</span>` : ''}</p>

      ${job.beschreibung ? `<p class="job-description">${escapeHtml(job.beschreibung)}</p>` : ''}

      <div class="job-meta">
        ${job.stundenlohn ? `<span class="lohn-highlight">${job.stundenlohn} €/Std</span>` : ''}
        ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
      </div>

      ${alter ? `<p class="job-frische${istAlt(job, o.jetzt ?? Date.now()) ? ' job-alt' : ''}">${alter}</p>` : ''}
      ${o.fussHtml || ''}
    </div>`
}
