// In-Memory-Fake für Supabase (REST + Auth + Storage), damit die eingeloggten
// Bereiche (Dashboards) getestet werden können, OHNE die echte Produktions-DB
// anzufassen. Es entstehen keine echten Accounts, Bewerbungen oder Uploads.
//
// Der Fake emuliert genau so viel PostgREST, wie die App tatsächlich nutzt:
// Filter (eq/neq/in/is), .single(), Embeds (job:job_id(...) etc.), INSERT/
// UPDATE/DELETE, count/head sowie generische Auth- und Storage-Antworten.
const base = require('@playwright/test')
const { JOBS } = require('./fixtures')

const SUPABASE_REF = 'blufrvuskqiloslyxjkx'
const SUPABASE_HOST = `${SUPABASE_REF}.supabase.co`
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`

// Fremdschlüssel -> Zieltabelle (für Embed-Auflösung wie job:job_id(...))
const FK_ZIEL = {
  job_id: 'jobs',
  schueler_id: 'profiles',
  firma_id: 'profiles',
  bewerbung_id: 'bewerbungen',
  absender_id: 'profiles',
}

// ---------- Test-Nutzer -----------------------------------------------------

const SCHUELER = {
  id: 'user-schueler-0000-0000-000000000001',
  email: 'schueler@test.de',
  name: 'Lena',
  role: 'schueler',
}
const FIRMA = {
  id: 'user-firma-0000-0000-0000-00000000f1',
  email: 'firma@test.de',
  name: 'Eiscafé Dolce',
  role: 'firma',
}

// Vollständige profiles-Zeile für einen Test-Nutzer.
function profilZeile(user, extra = {}) {
  const basis = user.role === 'firma'
    ? { firma_status: 'freigegeben', benachrichtigung: 'taeglich' }
    : { alter_jahre: 16, ort: 'München', schule: 'Gymnasium Nord', klasse: '10. Klasse', verifiziert: false, lebenslauf_bloecke: [] }
  return {
    id: user.id, role: user.role, name: user.name, email: user.email,
    foto_url: null, ist_admin: false, lat: null, lon: null, cv_design: null,
    ...basis, ...extra,
  }
}

// ---------- Standard-Datenbestand ------------------------------------------

function defaultDb(overrides = {}) {
  return {
    profiles: [profilZeile(SCHUELER), profilZeile(FIRMA)],
    jobs: JOBS.map(j => ({ ...j })),
    bewerbungen: [],
    gemerkte_jobs: [],
    nachrichten: [],
    bewertungen: [],
    ...overrides,
  }
}

// ---------- PostgREST-Emulation --------------------------------------------

const RESERVIERT = new Set(['select', 'order', 'limit', 'offset', 'on_conflict'])

function passtFilter(row, key, ausdruck) {
  const punkt = ausdruck.indexOf('.')
  const op = ausdruck.slice(0, punkt)
  let val = ausdruck.slice(punkt + 1)
  const feld = row[key]
  switch (op) {
    case 'eq': return String(feld) === coerce(val)
    case 'neq': return String(feld) !== coerce(val)
    case 'gt': return Number(feld) > Number(val)
    case 'gte': return Number(feld) >= Number(val)
    case 'lt': return Number(feld) < Number(val)
    case 'lte': return Number(feld) <= Number(val)
    case 'is': return val === 'null' ? (feld == null) : String(feld) === val
    case 'in': {
      const liste = val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''))
      return liste.map(String).includes(String(feld))
    }
    default: return true
  }
}
function coerce(val) {
  // eq.true / eq.false vergleichen wir als String gegen String(feld)
  return val.replace(/^"|"$/g, '')
}

// Select-String in Felder + Embeds zerlegen (kommasepariert, Klammern beachten)
function parseSelect(sel) {
  if (!sel || sel === '*') return { felder: ['*'], embeds: [] }
  const teile = []
  let tiefe = 0, akt = ''
  for (const ch of sel) {
    if (ch === '(') tiefe++
    if (ch === ')') tiefe--
    if (ch === ',' && tiefe === 0) { teile.push(akt); akt = '' } else akt += ch
  }
  if (akt) teile.push(akt)
  const embeds = []
  const felder = []
  teile.map(t => t.trim()).forEach(t => {
    const m = t.match(/^(\w+):(\w+)\((.*)\)$/s)
    if (m) embeds.push({ alias: m[1], fk: m[2], sub: m[3] })
    else felder.push(t)
  })
  return { felder, embeds }
}

// Embeds an eine Zeile hängen (rekursiv, für job:job_id(...) etc.)
function loeseEmbeds(row, embeds, db) {
  const kopie = { ...row }
  for (const e of embeds) {
    const zielTabelle = FK_ZIEL[e.fk]
    const zielRows = db[zielTabelle] || []
    const treffer = zielRows.find(r => String(r.id) === String(row[e.fk]))
    if (!treffer) { kopie[e.alias] = null; continue }
    const unter = parseSelect(e.sub)
    kopie[e.alias] = loeseEmbeds(treffer, unter.embeds, db)
  }
  return kopie
}

function sortiere(rows, orderParam) {
  if (!orderParam) return rows
  const [col, richtung] = orderParam.split('.')
  const desc = richtung === 'desc'
  return [...rows].sort((a, b) => {
    const va = a[col], vb = b[col]
    if (va === vb) return 0
    if (va == null) return 1
    if (vb == null) return -1
    return (va < vb ? -1 : 1) * (desc ? -1 : 1)
  })
}

function behandleRest(db, method, tabelle, url, headers, body) {
  const rows = db[tabelle] || (db[tabelle] = [])
  const params = url.searchParams
  const filter = []
  for (const [k, v] of params) {
    if (!RESERVIERT.has(k)) filter.push([k, v])
  }
  const gefiltert = () => rows.filter(r => filter.every(([k, v]) => passtFilter(r, k, v)))

  // count / head (z.B. zaehleUngelesen)
  const prefersCount = (headers['prefer'] || '').includes('count=')
  if (method === 'HEAD' || (method === 'GET' && prefersCount && headers['range-unit'])) {
    const n = gefiltert().length
    return { status: 200, headers: { 'content-range': `*/${n}` }, body: '' }
  }

  if (method === 'GET') {
    const { embeds } = parseSelect(params.get('select'))
    let ergebnis = sortiere(gefiltert(), params.get('order'))
    ergebnis = ergebnis.map(r => loeseEmbeds(r, embeds, db))
    const einzeln = (headers['accept'] || '').includes('vnd.pgrst.object')
    if (einzeln) {
      if (!ergebnis.length) return { status: 406, body: JSON.stringify({ code: 'PGRST116', message: 'no rows' }) }
      return { status: 200, body: JSON.stringify(ergebnis[0]) }
    }
    return { status: 200, body: JSON.stringify(ergebnis) }
  }

  if (method === 'POST') {
    const eingaben = Array.isArray(body) ? body : [body]
    const neu = eingaben.map(e => ({ id: e.id || cryptoId(), erstellt_am: new Date().toISOString(), ...e }))
    rows.push(...neu)
    return { status: 201, body: JSON.stringify(neu) }
  }

  if (method === 'PATCH') {
    const treffer = gefiltert()
    treffer.forEach(r => Object.assign(r, body))
    return { status: 200, body: JSON.stringify(treffer) }
  }

  if (method === 'DELETE') {
    const behalten = rows.filter(r => !filter.every(([k, v]) => passtFilter(r, k, v)))
    db[tabelle] = behalten
    return { status: 204, body: '' }
  }

  return { status: 200, body: '[]' }
}

function cryptoId() {
  return 'gen-' + Math.random().toString(36).slice(2, 12)
}

// ---------- Route-Installer -------------------------------------------------

async function installFakeSupabase(context, db) {
  await context.route(`https://${SUPABASE_HOST}/**`, async route => {
    const req = route.request()
    const url = new URL(req.url())
    const pfad = url.pathname
    const headers = req.headers()
    let body = null
    try { body = req.postDataJSON() } catch {}

    // REST
    if (pfad.startsWith('/rest/v1/rpc/')) {
      // ist_admin -> false, alles andere (z.B. job_aufruf_zaehlen) -> ok
      const fn = pfad.split('/').pop()
      const wert = fn === 'ist_admin' ? 'false' : 'null'
      return route.fulfill({ status: 200, contentType: 'application/json', body: wert })
    }
    if (pfad.startsWith('/rest/v1/')) {
      const tabelle = pfad.replace('/rest/v1/', '')
      const res = behandleRest(db, req.method(), tabelle, url, headers, body)
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        headers: res.headers || {},
        body: res.body,
      })
    }

    // Auth: signOut/logout/refresh usw. -> harmlos bestätigen
    if (pfad.startsWith('/auth/v1/')) {
      return route.fulfill({ status: 204, contentType: 'application/json', body: '' })
    }

    // Storage: Uploads/Signierte URLs -> Erfolg vortäuschen (kein echter Upload)
    if (pfad.startsWith('/storage/v1/')) {
      if (pfad.includes('/object/sign/')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedURL: '/mock-signed-url' }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'mock/key' }) })
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

// Setzt eine gültige Supabase-Session in localStorage, BEVOR die Seite lädt.
// supabase.auth.getSession() liest diese und hält den Nutzer für eingeloggt.
function sessionInitScript({ key, user, ablaufTs }) {
  const session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600 * 24 * 365,
    expires_at: ablaufTs,
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { name: user.name, role: user.role },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  }
  localStorage.setItem(key, JSON.stringify(session))
}

// ---------- Bausteine für die Specs ----------------------------------------

// Gate-Overlay überspringen (wie in der öffentlichen Basis).
async function bypassGate(context) {
  await context.addInitScript(() => {
    try { sessionStorage.setItem('sm-zugang-ok', '1') } catch {}
  })
}

// Nutzer eingeloggt machen (Session in localStorage vor dem ersten Paint).
async function seedSession(context, user) {
  const ablaufTs = Math.floor(Date.now() / 1000) + 3600 * 24 * 365
  await context.addInitScript(sessionInitScript, { key: STORAGE_KEY, user, ablaufTs })
}

// Open-Meteo-Geocoding (beim Job-Posten) abfangen -> feste Koordinate, hermetisch.
async function installGeocodeMock(context) {
  await context.route('https://geocoding-api.open-meteo.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [{ latitude: 48.137, longitude: 11.575 }] }) })
  )
}

// Komfort: Gate weg + Fake-DB + Geocode-Mock + optional eingeloggt. Vor page.goto() aufrufen.
async function setupDashboard(context, { db, user } = {}) {
  const datenbank = db || defaultDb()
  await bypassGate(context)
  if (user) await seedSession(context, user)
  await installFakeSupabase(context, datenbank)
  await installGeocodeMock(context)
  return datenbank
}

module.exports = {
  test: base.test, expect: base.expect,
  installFakeSupabase, bypassGate, seedSession, setupDashboard,
  defaultDb, profilZeile, SCHUELER, FIRMA, SUPABASE_REF,
}
