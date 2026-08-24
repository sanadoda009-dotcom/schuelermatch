// Sind alle Datenbank-Regeln im Repo gesichert?
//
// Anlass (25.8.): Beim Durchsehen des Firmen-Freigabe-Ablaufs fiel auf,
// dass die Oberfläche eine E-Mail verspricht ("Du bekommst dann eine
// E-Mail"). Die Prüfung, ob dieser Versand wirklich ausgelöst wird,
// führte zu einem größeren Fund: In der Datenbank waren **acht**
// Trigger aktiv, aber nur **zwei** davon standen im Repo.
//
// Nicht gesichert waren unter anderem die sechs Schutz-Trigger – darunter
// `trg_schuetze_profil`, der die kritischste Lücke des Security-Audits
// vom 26.7. schließt (jeder konnte sich selbst zum Administrator machen).
// Bei einem Wiederaufbau der Datenbank wären sie ersatzlos verschwunden,
// und niemand hätte es gemerkt.
//
// Dieser Test liest keine Datenbank – er prüft die Textdateien im Repo.
// Damit schlägt er an, sobald jemand einen Trigger anlegt, ohne ihn hier
// zu hinterlegen (vorausgesetzt, der Name taucht in dieser Liste auf).
const { test, expect } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const WURZEL = path.join(__dirname, '..')

function sqlDateien() {
  const ordner = path.join(WURZEL, 'supabase')
  return fs.readdirSync(ordner)
    .filter(f => f.endsWith('.sql'))
    .map(f => fs.readFileSync(path.join(ordner, f), 'utf8'))
    .join('\n')
}

// Diese Trigger sind in der Produktions-Datenbank aktiv (abgefragt am
// 25.8.2026). Kommt ein neuer dazu, gehört er hier UND in eine .sql-Datei.
const ERWARTETE_TRIGGER = [
  // Schutz-Regeln (supabase/schutz-trigger.sql)
  'trg_schuetze_profil',
  'trg_schuetze_bewerbung',
  'trg_schuetze_bewertung',
  'trg_schuetze_nachricht',
  'trg_schuetze_meldung',
  'trg_zitat_meldung',
  // E-Mail-Auslöser (supabase/mail-webhooks-einrichten.sql)
  'bewerbung_mail_insert',
  'bewerbung_mail_update',
  'firma_freigabe_mail',
  'profil_verifiziert_mail',
]

test('jeder Datenbank-Trigger ist im Repo hinterlegt', () => {
  const sql = sqlDateien()
  const fehlend = ERWARTETE_TRIGGER.filter(t => !sql.includes(t))
  expect(fehlend, 'Trigger ohne Sicherung im Repo').toEqual([])
})

test('die Schutz-Funktionen sind mitgesichert', () => {
  // Ein Trigger ohne seine Funktion lässt sich nicht wiederherstellen.
  const sql = sqlDateien()
  const funktionen = [
    'schuetze_profil_felder',
    'schuetze_bewerbung_felder',
    'schuetze_bewertung_felder',
    'schuetze_nachricht_felder',
    'schuetze_meldung_felder',
    'meldung_zitat_setzen',
    'ist_admin',
    'mail_ereignis_webhook',
  ]
  expect(funktionen.filter(f => !sql.includes(f)), 'Funktionen ohne Sicherung').toEqual([])
})

test('die wichtigste Regel schützt genau die richtigen Felder', () => {
  // Der Audit-Befund war: `update profiles set ist_admin = true` machte
  // jeden zum Administrator. Diese vier Felder müssen eingefroren sein.
  const datei = fs.readFileSync(path.join(WURZEL, 'supabase', 'schutz-trigger.sql'), 'utf8')
  const abschnitt = datei.slice(
    datei.indexOf('schuetze_profil_felder'),
    datei.indexOf('trg_schuetze_bewerbung'))
  for (const feld of ['ist_admin', 'verifiziert', 'firma_status', 'role']) {
    expect(abschnitt, `${feld} wird eingefroren`).toContain(`new.${feld}`)
  }
})

test('das Versprechen der Freischalt-Mail ist gedeckt', () => {
  // Das Prüfbanner sagt der Firma "Du bekommst dann eine E-Mail".
  // Damit das stimmt, braucht es den Trigger auf firma_status UND den
  // passenden Zweig in der Edge Function.
  const banner = fs.readFileSync(path.join(WURZEL, 'js', 'dashboard-firma.js'), 'utf8')
  expect(banner, 'Banner verspricht eine E-Mail').toContain('eine E-Mail')

  const sql = sqlDateien()
  expect(sql, 'Trigger auf firma_status vorhanden').toContain('after update of firma_status')

  const funktion = fs.readFileSync(
    path.join(WURZEL, 'supabase', 'functions', 'mail-ereignis', 'index.ts'), 'utf8')
  expect(funktion, 'Edge Function behandelt die Freigabe').toContain('firma_status')
})
