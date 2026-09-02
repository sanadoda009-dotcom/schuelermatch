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

  grid.innerHTML = jobs.map(job => jobKarteHtml(job)).join('')
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

ladeVorschauJobs()
