// Was der Betreiber über eine neue Firma erkennen kann, bevor er sie
// freigibt.
//
// WARUM ES DIESES MODUL GIBT (26.8.2026)
// `fuer-firmen.html` verspricht: „Wir prüfen von Hand, dass ein echtes
// Unternehmen dahintersteckt." Die Firmenkarte im Betreiber-Bereich
// zeigte dafür nur Name, Ort und E-Mail — mehr stand nicht zur
// Verfügung. Damit lässt sich kaum etwas prüfen; die Zusage war stärker
// als das, was der Betreiber in der Hand hatte.
//
// Dieses Modul zieht aus den vorhandenen Angaben die Anhaltspunkte
// heraus, die tatsächlich etwas aussagen. Es entscheidet NICHTS und
// blockiert NICHTS — die Freigabe bleibt Handarbeit. Es sagt nur, worauf
// zu schauen wäre.
//
// GRUNDHALTUNG: Ein Freemail-Konto ist kein Betrugsverdacht. Ein
// Nachhilfe-Elternteil oder ein kleiner Laden hat oft nichts anderes.
// Deshalb sind die Hinweise als „schau hier genauer hin" formuliert und
// nicht als Urteil — ein Betreiber, der lauter rote Warnungen sieht,
// klickt sie nach drei Tagen weg.

// Anbieter, hinter denen kein Unternehmen steht. Bewusst kurz gehalten:
// Es geht um die verbreiteten deutschen und internationalen Dienste,
// nicht um Vollständigkeit.
const FREEMAIL = [
  'gmail.com', 'googlemail.com', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch',
  'web.de', 'freenet.de', 't-online.de', 'online.de', 'arcor.de',
  'yahoo.com', 'yahoo.de', 'outlook.com', 'outlook.de', 'hotmail.com',
  'hotmail.de', 'live.de', 'live.com', 'icloud.com', 'me.com',
  'aol.com', 'mail.de', 'posteo.de', 'protonmail.com', 'proton.me'
]

// Wegwerf-Adressen. Hier ist der Hinweis deutlicher: Wer eine Adresse
// benutzt, die in zehn Minuten nicht mehr existiert, will nicht
// erreichbar sein.
const WEGWERF = [
  'mailinator.com', 'guerrillamail.com', 'trashmail.com', 'trashmail.de',
  'wegwerfmail.de', '10minutemail.com', 'tempmail.com', 'yopmail.com',
  'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc'
]

export function domainVon(email) {
  const s = String(email || '').trim().toLowerCase()
  const i = s.lastIndexOf('@')
  if (i === -1 || i === s.length - 1) return null
  const d = s.slice(i + 1)
  return d.includes('.') ? d : null
}

export function istFreemail(email) {
  const d = domainVon(email)
  return d ? FREEMAIL.includes(d) : false
}

export function istWegwerf(email) {
  const d = domainVon(email)
  return d ? WEGWERF.includes(d) : false
}

// Sieht der Firmenname aus wie eine eingetragene Gesellschaft?
// Nur ein Anhaltspunkt: Ein Einzelunternehmen führt keine Rechtsform,
// ist deshalb aber nicht unseriös.
const RECHTSFORM = /\b(gmbh|ug|ag|kg|ohg|gbr|e\.?\s?k\.?|e\.?\s?v\.?|mbh|se|ltd|inc)\b/i

export function hatRechtsform(name) {
  return RECHTSFORM.test(String(name || ''))
}

// Die Anhaltspunkte zu einer Firma, als Liste.
// Jeder Eintrag: { art: 'hinweis' | 'achtung' | 'gut', text: '…' }
//
// Reihenfolge: das Dringendste zuerst.
export function hinweiseZu(firma) {
  const f = firma || {}
  const hinweise = []

  if (istWegwerf(f.email))
    hinweise.push({
      art: 'achtung',
      text: 'Wegwerf-Adresse – diese Postfächer existieren nach kurzer Zeit nicht mehr.'
    })
  else if (istFreemail(f.email))
    hinweise.push({
      art: 'hinweis',
      text: 'Freemail-Adresse statt eigener Domain. Bei kleinen Anbietern normal – frag im Zweifel nach der Firmenanschrift.'
    })
  else if (domainVon(f.email))
    hinweise.push({
      art: 'gut',
      text: `Eigene Domain: ${domainVon(f.email)} – dort sollte auch eine Webseite mit Impressum liegen.`
    })

  if (!f.ort || !String(f.ort).trim())
    hinweise.push({ art: 'hinweis', text: 'Kein Ort angegeben.' })

  if (f.name && hatRechtsform(f.name))
    hinweise.push({ art: 'gut', text: 'Rechtsform im Namen – im Handelsregister nachschlagbar.' })

  return hinweise
}
