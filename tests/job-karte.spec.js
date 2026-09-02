// Die Jobkarte – eine Quelle statt vier (2.9.2026).
//
// ANLASS: Sanads Auftrag, das Jobs- und Bewerbungssystem aufs Maximum zu
// bringen. Der erste Befund war keine Frage des Aussehens, sondern eine
// Zählung: Dieselbe Karte wurde an VIER Stellen einzeln gebaut –
// js/jobs.js, js/dashboard-schueler.js, js/jobs-preview.js und (in eigener
// Form) js/dashboard-firma.js.
//
// Was das kostet, hatte sich einen Tag vorher gezeigt: Die Korrektur
// „ab null J." musste in FÜNF Dateien einzeln nachgezogen werden. Wer eine
// vergisst, hat einen Fehler, den niemand bemerkt.
//
// Neu dabei, aus dem Vergleich mit Indeed und StepStone: an jeder Karte
// steht, wie alt die Anzeige ist. Ob sie von gestern oder von vor drei
// Monaten ist, entscheidet, ob sich das Bewerben überhaupt lohnt.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

// Das Modul kommt ohne Supabase aus – ein Test kann es also direkt laden.
async function modul(page) {
  await page.goto('/index.html')
  return page.evaluateHandle(() => import('/js/job-karte.js'))
}

const JOB = {
  id: 'j1', titel: 'Eisverkäufer/in', firma_name: 'Eiscafé Sonne', ort: 'München',
  stundenlohn: 12, mindestalter: 15, kategorie: 'Verkauf', arbeitszeit: 'Wochenende',
  beschreibung: 'Eis verkaufen und kassieren.', verfuegbarkeit: 'Sa & So',
  erstellt_am: '2026-08-30T10:00:00Z',
}

test.describe('wie alt ist die Anzeige', () => {
  test('sagt es in Worten, nicht als Datum', async ({ page }) => {
    const m = await modul(page)
    const faelle = await page.evaluate(async ({ mod, job }) => {
      const jetzt = new Date('2026-09-02T10:00:00Z').getTime()
      const tag = 24 * 3600 * 1000
      const bei = ms => mod.alterText({ ...job, erstellt_am: new Date(jetzt - ms).toISOString() }, jetzt)
      return {
        heute: bei(2 * 3600 * 1000),
        gestern: bei(1.2 * tag),
        dreiTage: bei(3 * tag),
        woche: bei(8 * tag),
        wochen: bei(20 * tag),
        monat: bei(40 * tag),
        monate: bei(100 * tag),
        ohne: mod.alterText({ ...job, erstellt_am: null }, jetzt),
        unfug: mod.alterText({ ...job, erstellt_am: 'kein Datum' }, jetzt),
      }
    }, { mod: m, job: JOB })

    expect(faelle.heute).toBe('heute eingestellt')
    expect(faelle.gestern).toBe('gestern eingestellt')
    expect(faelle.dreiTage).toBe('vor 3 Tagen eingestellt')
    expect(faelle.woche).toBe('vor einer Woche eingestellt')
    expect(faelle.wochen).toBe('vor 2 Wochen eingestellt')
    expect(faelle.monat).toBe('vor einem Monat eingestellt')
    expect(faelle.monate).toBe('vor 3 Monaten eingestellt')
    // Fehlt das Datum oder ist es Unfug, steht lieber nichts da als "NaN".
    expect(faelle.ohne).toBe('')
    expect(faelle.unfug).toBe('')
  })

  test('„NEU" gilt genau 72 Stunden', async ({ page }) => {
    const m = await modul(page)
    const r = await page.evaluate(async ({ mod }) => {
      const jetzt = Date.now()
      const std = 3600 * 1000
      const bei = h => mod.istNeu({ erstellt_am: new Date(jetzt - h * std).toISOString() }, jetzt)
      return { frisch: bei(1), knappDrin: bei(71), knappDraussen: bei(73), ohne: mod.istNeu({}, jetzt) }
    }, { mod: m })
    expect(r.frisch).toBe(true)
    expect(r.knappDrin).toBe(true)
    expect(r.knappDraussen).toBe(false)
    expect(r.ohne).toBe(false)
  })
})

test.describe('das Mindestalter steht nur noch an einer Stelle', () => {
  test('ohne Angabe steht „Alter auf Anfrage", nie „null"', async ({ page }) => {
    const m = await modul(page)
    const r = await page.evaluate(async ({ mod }) => ({
      mit: mod.altersText({ mindestalter: 15 }),
      ohne: mod.altersText({ mindestalter: null }),
      leer: mod.altersText({}),
    }), { mod: m })
    expect(r.mit).toBe('ab 15 J.')
    expect(r.ohne).toBe('Alter auf Anfrage')
    expect(r.leer).toBe('Alter auf Anfrage')
  })

  test('keine Ansicht baut die Karte noch selbst', async () => {
    // Der eigentliche Gewinn dieser Runde. Wer wieder eine eigene Karte
    // baut, hat beim nächsten Fehler wieder fünf Stellen zu ändern.
    const ordner = path.join(__dirname, '..', 'js')
    const eigenbau = []
    for (const datei of ['jobs.js', 'dashboard-schueler.js', 'jobs-preview.js']) {
      const inhalt = fs.readFileSync(path.join(ordner, datei), 'utf8')
      if (/class="job-card/.test(inhalt)) eigenbau.push(`js/${datei}`)
      if (!inhalt.includes("from './job-karte.js'")) eigenbau.push(`js/${datei} (kein Import)`)
    }
    expect(eigenbau, 'Ansicht baut die Jobkarte selbst').toEqual([])
  })
})

test.describe('die Karte im Einsatz', () => {
  test('fremder Text wird nicht als HTML eingesetzt', async ({ page }) => {
    // Titel, Firmenname und Beschreibung kommen von der Firma.
    const m = await modul(page)
    const html = await page.evaluate(async ({ mod }) => mod.jobKarteHtml({
      id: 'x', titel: '<img src=x onerror="window.__aua=1">', firma_name: '<b>fett</b>',
      ort: 'M<script>', beschreibung: '<i>schräg</i>', mindestalter: 15,
    }), { mod: m })

    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<b>fett</b>')
    expect(html).toContain('&lt;')
  })

  test('was die Ansicht nicht kann, steht auch nicht drin', async ({ page }) => {
    const m = await modul(page)
    const r = await page.evaluate(async ({ mod, job }) => ({
      schlicht: mod.jobKarteHtml(job),
      voll: mod.jobKarteHtml(job, { merkbar: true, gemerkt: true, titelAlsKnopf: true,
        distanz: 4, fussHtml: '<button class="btn">Jetzt bewerben</button>' }),
    }), { mod: m, job: JOB })

    // Die Startseite kann nicht merken – also kein Herz.
    expect(r.schlicht).not.toContain('merken-btn')
    expect(r.schlicht).not.toContain('job-titel-btn')
    expect(r.voll).toContain('merken-btn gemerkt')
    expect(r.voll).toContain('job-titel-btn')
    expect(r.voll).toContain('4 km')
    expect(r.voll).toContain('Jetzt bewerben')
  })

  test('auf der Jobbörse steht an jeder Karte, wie alt sie ist', async ({ page }) => {
    await page.goto('/jobs.html')
    await expect(page.locator('#jobs-grid .job-card').first()).toBeVisible({ timeout: 20_000 })
    const ohneFrische = await page.locator('#jobs-grid .job-card').evaluateAll(
      els => els.filter(e => !e.querySelector('.job-frische')).length)
    expect(ohneFrische, 'Karte ohne Angabe, wie alt die Anzeige ist').toBe(0)
  })
})
