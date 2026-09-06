import { supabase } from './supabase.js'
import { ICONS } from './icons.js'
import { hole, zeigeLadefehler } from './zustand.js'
import { jobKarteHtml } from './job-karte.js'

async function ladeVorschauJobs() {
  const grid = document.getElementById('preview-jobs-grid')
  if (!grid) return

  // Störung und Leere sind zwei verschiedene Dinge – siehe zustand.js.
  const { data: jobs, gestoert } = await hole(supabase
    .from('jobs')
    .select('*')
    .eq('aktiv', true)
    .order('erstellt_am', { ascending: false })
    .limit(3))

  if (gestoert) {
    zeigeLadefehler(grid, ladeVorschauJobs, 'Die Job-Vorschau konnte gerade nicht geladen werden.')
    return
  }
  if (!jobs?.length) {
    grid.innerHTML = `<p style="text-align:center; grid-column:1/-1; color:var(--ink-soft);">Gerade ist keine Anzeige online – die ersten kommen bald.</p>`
    return
  }

  // `klickbar` war hier nie gesetzt (4.9.2026 gemessen). Die Karte trug
  // trotzdem `job-card--clickable` und damit `cursor: pointer` - sie SAH
  // also klickbar aus, hatte aber weder role noch tabindex, und es
  // lauschte niemand. Drei tote Karten, direkt unter der Kopfzeile der
  // Startseite: Ein Schueler klickt, nichts passiert, und er lernt
  // daraus, dass die Seite nicht funktioniert.
  grid.innerHTML = jobs.map(job => jobKarteHtml(job, { klickbar: true })).join('')
  verdrahteKarten(grid)
}

// Von der Karte in die Anzeige. Auf der Startseite gibt es kein
// Detail-Fenster wie in der Boerse - also die eigene Seite oeffnen.
// Dieselbe Verdrahtung wie in js/firma.js.
function verdrahteKarten(grid) {
  grid.querySelectorAll('[data-detail]').forEach(karte => {
    const auf = () => { location.href = `job.html?id=${encodeURIComponent(karte.dataset.detail)}` }
    karte.addEventListener('click', auf)
    karte.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      auf()
    })
  })
}

ladeVorschauJobs()
