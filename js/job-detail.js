import { supabase } from './supabase.js'
import { ICONS } from './icons.js'
import { hole, zeigeLadefehler } from './zustand.js'
import { meldeMitAnmeldung, meldeButtonHtml } from './melden.js'

function escapeHtml(str) {
  const div = document.createElement('div'); div.textContent = str ?? ''; return div.innerHTML
}

function sterneHtml(n) {
  let h = ''
  for (let i = 1; i <= 5; i++) h += `<span class="${i <= n ? '' : 'leer'}">★</span>`
  return `<span class="sterne-anzeige">${h}</span>`
}

async function ladeBewertungenHtml(firmaId) {
  if (!firmaId) return ''
  const { data } = await supabase.from('bewertungen')
    .select('sterne, kommentar, schueler_name, erstellt_am')
    .eq('firma_id', firmaId)
    .order('erstellt_am', { ascending: false })

  if (!data || !data.length) {
    return `<section style="margin-top:24px;"><h2>Bewertungen</h2>
      <p class="cv-preview-empty">Noch keine Bewertungen. Bewertungen können nur Schüler abgeben, die von dieser Firma angenommen wurden.</p></section>`
  }

  const schnitt = data.reduce((s, b) => s + b.sterne, 0) / data.length
  const gerundet = Math.round(schnitt)
  const karten = data.map(b => {
    const datum = b.erstellt_am ? new Date(b.erstellt_am).toLocaleDateString('de-DE', { year: 'numeric', month: 'short' }) : ''
    return `<div class="bewertung-card">
      <div class="kopf">
        <span class="name">${escapeHtml(b.schueler_name || 'Schüler:in')}</span>
        <span class="verifiziert">✓ hat hier gearbeitet</span>
      </div>
      ${sterneHtml(b.sterne)}
      ${b.kommentar ? `<p>${escapeHtml(b.kommentar)}</p>` : ''}
      ${datum ? `<span class="datum">${datum}</span>` : ''}
    </div>`
  }).join('')

  return `<section style="margin-top:24px;">
    <h2>Bewertungen</h2>
    <div class="bewertung-summary">
      ${sterneHtml(gerundet)}
      <span class="schnitt">${schnitt.toFixed(1)}</span>
      <span class="anzahl">aus ${data.length} ${data.length === 1 ? 'Bewertung' : 'Bewertungen'}</span>
    </div>
    <div class="bewertung-liste">${karten}</div>
  </section>`
}

// Wie alt ist die Anzeige? Eine Stelle von vor einem halben Jahr ist
// meist längst vergeben - das sollte man sehen, bevor man Zeit in eine
// Bewerbung steckt.
function alterDerAnzeige(erstelltAm) {
  if (!erstelltAm) return ''
  const tage = Math.floor((Date.now() - new Date(erstelltAm).getTime()) / 86400000)
  if (tage < 0) return ''
  const text = tage < 1 ? 'heute eingestellt'
    : tage === 1 ? 'gestern eingestellt'
    : tage < 7 ? `vor ${tage} Tagen eingestellt`
    : tage < 14 ? 'vor einer Woche eingestellt'
    : tage < 60 ? `vor ${Math.floor(tage / 7)} Wochen eingestellt`
    : `vor ${Math.floor(tage / 30)} Monaten eingestellt`
  // Ab zwei Monaten dezent hervorheben - dann lohnt eine Nachfrage,
  // ob die Stelle ueberhaupt noch frei ist.
  const alt = tage >= 60 ? ' job-alt' : ''
  return `<span class="job-datum${alt}">${text}</span>`
}

// Eine Anzeige, die es nicht mehr gibt, darf nicht im Google-Index
// stehen bleiben.
//
// Das Problem: Diese Seite liefert IMMER HTTP 200 - sie ist eine
// statische Datei, der Job kommt erst per Abfrage dazu. Google sieht
// also keine 404 und behaelt die Adresse. Bei Stellenanzeigen ist das
// ausdruecklich unerwuenscht: Wer aus der Google-Jobsuche kommt, landet
// auf einer Anzeige, die es nicht mehr gibt.
//
// Abhilfe ist ein nachtraeglich gesetztes `noindex`. Google wertet die
// robots-Angabe nach dem Ausfuehren des JavaScripts aus, das wirkt also.
// Der Titel wird gleich mitgesetzt, sonst steht in Suchergebnis und
// Browsertab weiter "Minijob fuer Schueler".
function nichtIndexieren(titel) {
  let meta = document.querySelector('meta[name="robots"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'robots'
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', 'noindex')
  document.title = `${titel} – SchülerMatch`
}

async function ladeJob() {
  const el = document.getElementById('job-detail')
  const id = new URLSearchParams(location.search).get('id')

  if (!id) {
    nichtIndexieren('Anzeige nicht gefunden')
    el.innerHTML = '<h1>Job nicht gefunden</h1><p><a href="jobs.html" style="color:var(--match-green-dark);text-decoration:underline;">Zurück zu allen Jobs</a></p>'
    return
  }

  const { data: job, gestoert } = await hole(
    supabase.from('jobs').select('*').eq('id', id).eq('aktiv', true).single())

  // Ohne Netz blieb hier frueher fuer immer "Lade Job..." stehen.
  // Hier bewusst KEIN noindex: Die Anzeige gibt es vermutlich noch, nur
  // die Verbindung klemmt gerade. Sie deswegen aus dem Index zu werfen
  // waere schlimmer als das Problem.
  if (gestoert) {
    zeigeLadefehler(el, ladeJob, 'Diese Anzeige konnte gerade nicht geladen werden.')
    return
  }

  if (!job) {
    nichtIndexieren('Anzeige nicht mehr verfügbar')
    el.innerHTML = '<h1>Job nicht verfügbar</h1><p>Diese Anzeige gibt es nicht mehr oder sie wurde pausiert.</p><p><a href="jobs.html" style="color:var(--match-green-dark);text-decoration:underline;">Alle aktuellen Jobs ansehen →</a></p>'
    return
  }

  // Aufruf zählen + Titel/Meta für Teilen setzen
  supabase.rpc('job_aufruf_zaehlen', { p_job: id })
  const bewertungenHtml = await ladeBewertungenHtml(job.firma_id)

  // Strukturierte Daten (schema.org JobPosting) -> Google-Jobs-Auffindbarkeit
  //
  // Google verlangt fuer eine gueltige Stellenanzeige fuenf Angaben:
  // title, description, datePosted, hiringOrganization und jobLocation.
  // Fehlt eine davon, erscheint die Anzeige gar nicht - ohne jede
  // Rueckmeldung.
  //
  // Am 26.8. gemessen: Bei einem Job ohne Ort fiel `jobLocation` still
  // weg. Herausgekommen waeren ungueltige strukturierte Daten. Jetzt
  // wird lieber GAR NICHTS ausgeliefert als etwas Unvollstaendiges -
  // eine fehlerhafte Auszeichnung kann der ganzen Seite schaden, eine
  // fehlende kostet nur diesen einen Job.
  if (job.titel && job.erstellt_am && job.ort) {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: job.titel,
      description: job.beschreibung || job.titel,
      datePosted: job.erstellt_am.slice(0, 10),
      // Ohne validThrough zeigt Google Anzeigen unbegrenzt weiter, auch
      // laengst besetzte. 90 Tage passen zur eigenen Logik der Seite,
      // die eine Anzeige ab zwei Monaten als moeglicherweise veraltet
      // kennzeichnet. Wird ein Job pausiert, liefert diese Seite ohnehin
      // "nicht verfuegbar" und gar keine strukturierten Daten mehr.
      validThrough: new Date(new Date(job.erstellt_am).getTime() + 90 * 864e5)
        .toISOString().slice(0, 10),
      employmentType: 'PART_TIME',
      hiringOrganization: { '@type': 'Organization', name: job.firma_name || 'Arbeitgeber auf SchülerMatch' },
      jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.ort, addressCountry: 'DE' } },
      baseSalary: job.stundenlohn ? { '@type': 'MonetaryAmount', currency: 'EUR', value: { '@type': 'QuantitativeValue', value: job.stundenlohn, unitText: 'HOUR' } } : undefined,
      directApply: true
    }
    const ldScript = document.createElement('script')
    ldScript.type = 'application/ld+json'
    ldScript.textContent = JSON.stringify(jsonLd, (k, v) => v === undefined ? undefined : v)
    document.head.appendChild(ldScript)
  }
  document.title = `${job.titel} – SchülerMatch`
  // Teilen-Vorschau auf diesen Job umschreiben (siehe Kommentar in job.html).
  const setzeMeta = (eigenschaft, wert) => {
    const el = document.querySelector(`meta[property="${eigenschaft}"]`)
    if (el) el.setAttribute('content', wert)
  }
  setzeMeta('og:title', `${job.titel}${job.ort ? ' in ' + job.ort : ''} – SchülerMatch`)
  setzeMeta('og:url', location.href)
  const teile = []
  if (job.stundenlohn) teile.push(`${job.stundenlohn} € pro Stunde`)
  if (job.mindestalter) teile.push(`ab ${job.mindestalter} Jahren`)
  if (job.verfuegbarkeit) teile.push(job.verfuegbarkeit)
  setzeMeta('og:description', teile.length
    ? teile.join(' · ') + '. Kostenlos bewerben auf SchülerMatch.'
    : 'Jugendschutzgeprüfter Minijob, kostenlos für Schüler.')
  document.querySelector('meta[name="description"]')?.setAttribute('content',
    `${job.titel}${job.ort ? ' in ' + job.ort : ''} – ab ${job.mindestalter} Jahren${job.stundenlohn ? ', ' + job.stundenlohn + ' €/Std' : ''}. Kostenlos bewerben auf SchülerMatch.`)

  el.innerHTML = `
    <a href="jobs.html" class="mono" style="color:var(--ink-soft); font-size:0.82rem;">← Alle Jobs</a>
    <div style="display:flex; align-items:center; gap:16px; margin:16px 0 8px;">
      <div class="company-logo" style="width:60px; height:60px; font-size:1.5rem;">${escapeHtml(((job.firma_name || job.titel || '?')[0]).toUpperCase())}</div>
      <div>
        <h1 style="font-size:2rem;">${escapeHtml(job.titel)}</h1>
        ${job.firma_name
          ? `<p class="job-firma">bei ${escapeHtml(job.firma_name)}</p>`
          : ''}
      </div>
    </div>
    <p class="company-name" style="font-size:1rem;">${ICONS.pin} ${escapeHtml(job.ort || '')}
      ${job.kategorie ? `<span class="kategorie-chip">${escapeHtml(job.kategorie)}</span>` : ''}
      ${job.arbeitszeit ? `<span class="arbeitszeit-chip">🕐 ${escapeHtml(job.arbeitszeit)}</span>` : ''}
    </p>

    <div class="job-meta" style="margin:20px 0; font-size:0.95rem;">
      <span>${ICONS.age} ab ${job.mindestalter} Jahren</span>
      ${job.stundenlohn ? `<span class="lohn-highlight">${job.stundenlohn} €/Std</span>` : ''}
      ${job.verfuegbarkeit ? `<span>${ICONS.clock} ${escapeHtml(job.verfuegbarkeit)}</span>` : ''}
      <span>👁 ${job.aufrufe || 0} Aufrufe</span>
      ${alterDerAnzeige(job.erstellt_am)}
    </div>

    <section>
      <h2>Beschreibung</h2>
      ${job.beschreibung ? `<p style="white-space:pre-wrap;">${escapeHtml(job.beschreibung)}</p>` : '<p class="cv-preview-empty">Keine weitere Beschreibung vorhanden.</p>'}
    </section>

    ${bewertungenHtml}

    <div class="legal-highlight" style="margin-top:24px;">
      <h2>Bewerben</h2>
      <p>Zum Bewerben brauchst du ein kostenloses Schüler-Konto. Wir prüfen einmal kurz, ob du wirklich Schüler:in bist – danach bewirbst du dich mit einem Klick.</p>
      <div class="hero-ctas" style="margin-top:14px;">
        <a href="register.html?rolle=schueler" class="btn btn-green">Kostenlos registrieren & bewerben</a>
        <a href="login.html" class="btn btn-outline">Ich habe schon ein Konto</a>
      </div>
    </div>

    <button type="button" id="share-btn" class="share-btn" style="margin-top:20px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Link kopieren
    </button>
    ${meldeButtonHtml('id="melden-btn" style="margin-top:20px; margin-left:8px;"')}
  `

  // Melden direkt von der Anzeigenseite. Wer ueber einen geteilten Link
  // oder ueber Google hier landet, sieht das Dashboard nie - bis zum
  // 27.8. konnte er gar nichts melden.
  document.getElementById('melden-btn').addEventListener('click', () =>
    meldeMitAnmeldung({ typ: 'job', jobId: job.id, titel: job.titel }))

  document.getElementById('share-btn').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(location.href)
      e.currentTarget.textContent = '✓ Kopiert!'
    } catch {
      prompt('Link zum Kopieren:', location.href)
    }
  })
}

ladeJob()
