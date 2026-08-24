// Gemeinsame Test-Basis für alle SchülerMatch-E2E-Tests.
//
// Wichtigste Regeln:
// 1. Das Zugangs-Gate (js/gate.js) wird per sessionStorage-Flag umgangen,
//    damit nicht jeder Test erst das Passwort eintippen muss.
// 2. ALLE Requests an Supabase werden abgefangen und gemockt.
//    Kein Test spricht jemals mit der echten Produktions-Datenbank —
//    keine echten Accounts, keine echten E-Mails, keine echten Zähler.
const base = require('@playwright/test')
const { JOBS } = require('./fixtures')

const SUPABASE_HOST = 'blufrvuskqiloslyxjkx.supabase.co'

// Standard-Antworten; einzelne Tests können sie per mockSupabase() überschreiben.
function standardAntworten() {
  return {
    jobs: JOBS,
    bewertungen: [],
    // Auth-Endpunkte: standardmäßig „nicht erreichbar“ — Tests, die Auth
    // brauchen, setzen gezielt eigene Antworten (siehe auth.spec.js).
    token: { status: 400, body: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials', message: 'Invalid login credentials' } },
    signup: { status: 200, body: null },
  }
}

async function installiereSupabaseMock(context, antworten) {
  await context.route(`https://${SUPABASE_HOST}/**`, async route => {
    const req = route.request()
    const url = new URL(req.url())
    const pfad = url.pathname

    // --- REST: Tabellen ---------------------------------------------------
    if (pfad === '/rest/v1/jobs' && req.method() === 'GET') {
      const einzeln = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
      let daten = antworten.jobs
      // .eq('id', x) serverseitig nachbilden, damit job.html?id= funktioniert
      const idFilter = url.searchParams.get('id')
      if (idFilter && idFilter.startsWith('eq.')) {
        daten = daten.filter(j => j.id === idFilter.slice(3))
      }
      if (einzeln) {
        if (!daten.length) {
          return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }) })
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(daten[0]) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(daten) })
    }
    if (pfad === '/rest/v1/bewertungen' && req.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(antworten.bewertungen) })
    }
    if (pfad.startsWith('/rest/v1/rpc/')) {
      // z.B. job_aufruf_zaehlen — einfach „ok“ sagen, nichts zählen
      return route.fulfill({ status: 204, contentType: 'application/json', body: '' })
    }

    // --- Auth -------------------------------------------------------------
    if (pfad === '/auth/v1/token') {
      const a = antworten.token
      return route.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) })
    }
    if (pfad === '/auth/v1/signup') {
      const a = antworten.signup
      const body = a.body || neuerUnbestaetigterUser(req)
      return route.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(body) })
    }

    // Alles andere Richtung Supabase: leere, harmlose Antwort.
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

// GoTrue-Antwort für ein SignUp MIT E-Mail-Bestätigung: User ohne Session.
function neuerUnbestaetigterUser(req) {
  let email = 'test@example.com'
  try { email = JSON.parse(req.postData() || '{}').email || email } catch {}
  const jetzt = new Date().toISOString()
  return {
    id: '00000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email,
    phone: '',
    confirmation_sent_at: jetzt,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: jetzt,
    updated_at: jetzt,
  }
}

// Google Fonts werden in Tests nicht gebraucht - der Browser wartet sonst
// bei jedem Seitenaufruf auf einen echten Netzabruf.
async function blockiereSchriften(context) {
  await context.route(/(fonts\.googleapis\.com|fonts\.gstatic\.com)/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }))
}

// supabase-js kommt von jsdelivr und wird zwingend gebraucht. Deshalb pro
// Worker-Prozess EINMAL holen und danach aus dem Speicher ausliefern.
const cdnCache = new Map()
async function cacheJsdelivr(context) {
  await context.route(/cdn\.jsdelivr\.net/, async route => {
    const url = route.request().url()
    if (!cdnCache.has(url)) {
      try {
        const res = await route.fetch()
        const headers = { ...res.headers() }
        delete headers['content-encoding']
        delete headers['content-length']
        cdnCache.set(url, { status: res.status(), headers, body: await res.body() })
      } catch {
        return route.abort()
      }
    }
    const t = cdnCache.get(url)
    await route.fulfill({ status: t.status, headers: t.headers, body: t.body })
  })
}

// Erweiterte test-Funktion: Gate-Bypass + Supabase-Mock sind immer aktiv.
const test = base.test.extend({
  // Von Tests überschreibbare Mock-Antworten (per test.use({ antworten: ... }))
  antworten: [standardAntworten(), { option: true }],

  context: async ({ context, antworten }, use) => {
    // Nur das Gate umgehen — das Theme NICHT anfassen (Playwright emuliert
    // ohnehin prefers-color-scheme: light, und ein erzwungener Wert würde
    // die Dark-Mode-Persistenz-Tests kaputt machen).
    await context.addInitScript(() => {
      try { sessionStorage.setItem('sm-zugang-ok', '1') } catch {}
    })
    await installiereSupabaseMock(context, antworten)
    // Externe Ressourcen abklemmen bzw. zwischenspeichern. Ohne das holte
    // JEDER Test Google Fonts und supabase-js frisch aus dem Netz - der
    // langsamste Test brauchte dadurch 53 Sekunden statt weniger als einer.
    // (Die Schwester-Datei supabase-fake.js macht das laengst; basis.js
    //  war dabei uebersehen worden.)
    await blockiereSchriften(context)
    await cacheJsdelivr(context)
    await use(context)
  },
})

module.exports = { test, expect: base.expect, standardAntworten, installiereSupabaseMock, SUPABASE_HOST }
