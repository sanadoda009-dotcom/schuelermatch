// Eine gesperrte Firma erreicht keine Schüler mehr (13.9.2026).
//
// DER BEFUND, aus der laufenden Datenbank ausgelesen: Im Betreiber-Bereich
// meldet „Sperren": „gesperrt – Jobs nicht mehr sichtbar". Genau das – und
// nur das – bewirkt es. Keine einzige Zugriffsregel fragt nach
// `firma_status = 'gesperrt'`. Eine gesperrte Firma kann weiter Schülern
// schreiben, deren Bewerbungen und Profile lesen (mit E-Mail-Adresse) und
// ihre Zeugnisse laden.
//
// Die Abhilfe ist supabase/firma-gesperrt-kein-kontakt.sql. Sie wartet auf
// Sanad; die Datenbank ändere ich nicht selbst. Dieser Test prüft, dass die
// Datei hält, was sie verspricht – vor allem, dass sie über ZUSÄTZLICHE,
// EINSCHRÄNKENDE Regeln wirkt und keine bestehende anfasst. Sonst hinge es
// von der Reihenfolge beim Einspielen ab, ob chat-erst-nach-zusage.sql oder
// zeugnis-nur-eigene-anzeige.sql ihre Fassung behalten.

const { test, expect } = require('./helpers/basis')
const fs = require('fs')
const path = require('path')

const SQL = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'firma-gesperrt-kein-kontakt.sql'), 'utf8')
// Nur der ausführbare Teil, ohne Kommentare.
const CODE = SQL.split('\n').filter(z => !z.trim().startsWith('--')).join('\n')

test('alle vier Zugänge sind abgedeckt: Nachrichten, Bewerbungen, Profile, Zeugnisse', async () => {
  for (const tabelle of ['public.nachrichten', 'public.bewerbungen', 'public.profiles', 'storage.objects']) {
    expect(CODE, `keine Regel auf ${tabelle}`).toMatch(new RegExp(`create policy "Gesperrte Firma:[^"]*" on ${tabelle.replace('.', '\.')}`))
  }
})

test('jede neue Regel ist einschränkend – nie erlaubend', async () => {
  const regeln = [...CODE.matchAll(/create policy "([^"]+)"[\s\S]*?;/g)]
  expect(regeln.length).toBe(4)
  for (const [block, name] of regeln) {
    expect(block, `„${name}" ist nicht restrictive – dann ERWEITERT sie Rechte statt sie zu begrenzen`)
      .toMatch(/as restrictive/)
  }
})

test('keine bestehende Regel wird entfernt oder ersetzt', async () => {
  const entfernt = [...CODE.matchAll(/drop policy if exists "([^"]+)"/g)].map(m => m[1])
  expect(entfernt.filter(n => !n.startsWith('Gesperrte Firma:')),
    'diese Datei darf nur ihre eigenen Regeln anfassen').toEqual([])
})

test('die eigene Profilzeile bleibt lesbar – sonst käme die Firma nicht einmal an den Sperr-Hinweis', async () => {
  const start = CODE.indexOf('create policy "Gesperrte Firma: nur eigenes Profil"')
  expect(start, 'Regel nicht gefunden').toBeGreaterThan(-1)
  const profil = CODE.slice(start, CODE.indexOf(';', start))
  expect(profil).toMatch(/id = auth\.uid\(\) or not public\.ist_gesperrte_firma/)
})

test('nur gesperrte FIRMEN sind gemeint', async () => {
  const fn = CODE.slice(CODE.indexOf('create or replace function public.ist_gesperrte_firma'), CODE.indexOf('$$;'))
  expect(fn).toMatch(/role = 'firma' and firma_status = 'gesperrt'/)
  expect(fn, 'eine fehlende Zeile darf niemanden sperren').toMatch(/coalesce\(/)
})

test('die Firmen-Seite sagt einer gesperrten Firma Bescheid', async () => {
  // Der Hinweis existiert schon; er darf beim Umbau nicht verloren gehen.
  const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'dashboard-firma.js'), 'utf8')
  expect(js).toContain('Dein Konto ist gesperrt.')
})
