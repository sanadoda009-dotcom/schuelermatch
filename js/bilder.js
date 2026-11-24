// Bilder von Schülern liegen in PRIVATEN Ablagen (24.11.2026).
//
// ANLASS: Profilfotos lagen in `avatars`, Lebenslauf-Bilder in
// `lebenslauf-bilder` - beides öffentliche Ablagen. Wer die Adresse
// kannte, sah das Foto eines Minderjährigen ohne Anmeldung, und zwar für
// immer: Eine Firma, die eine Bewerbung bekam, behielt die Adresse auch
// nach einer Absage. Die Startseite verspricht dagegen, dass Firmen den
// Lebenslauf erst nach einer Bewerbung sehen.
//
// JETZT: Schülerbilder liegen in `profilfotos` und `lebenslauf-bilder`,
// beide privat. In der Datenbank steht statt einer Adresse ein VERWEIS:
//
//     speicher:profilfotos/<nutzer-id>/avatar.jpg?v=1764000000000
//
// Erst beim Anzeigen wird daraus eine signierte Adresse, die nach einer
// Stunde verfällt. Wer sie sehen darf, entscheiden die Speicherregeln
// (supabase/schuelerbilder-privat.sql): der Schüler selbst, eine Firma,
// bei der er sich beworben hat, und der Betreiber.
//
// Firmenlogos bleiben öffentlich in `avatars` - die sollen ja gesehen
// werden, auch ohne Anmeldung.
//
// Bewusst OHNE Supabase-Import: Die Seiten geben ihren Client mit
// initBilder() herein. So bleibt das Modul (und js/pdf.js, das es nutzt)
// prüfbar, ohne dass ein Test eine Verbindung aufbauen muss.

import { sichereMediaUrl } from './sicher.js'

export const PRIVATE_BILDABLAGEN = ['profilfotos', 'lebenslauf-bilder']
const PRAEFIX = 'speicher:'
const GUELTIG_SEKUNDEN = 3600

let client = null
const cache = new Map()   // Verweis -> { url, bis }

export function initBilder(supabaseClient) { client = supabaseClient }

// Für Tests: vergessene Adressen erzwingen.
export function leereBildCache() { cache.clear() }

export function speicherVerweis(ablage, pfad, version = Date.now()) {
  return `${PRAEFIX}${ablage}/${pfad}?v=${version}`
}

// Zerlegt einen Verweis. Alles, was nicht genau so aussieht, ist keiner -
// insbesondere keine Ablage ausserhalb der Liste und kein "..".
export function zerlegeVerweis(wert) {
  if (typeof wert !== 'string' || !wert.startsWith(PRAEFIX)) return null
  const rest = wert.slice(PRAEFIX.length).split('?')[0]
  const i = rest.indexOf('/')
  if (i <= 0) return null
  const ablage = rest.slice(0, i)
  const pfad = rest.slice(i + 1)
  if (!PRIVATE_BILDABLAGEN.includes(ablage)) return null
  if (!pfad || pfad.includes('..') || pfad.startsWith('/')) return null
  return { ablage, pfad }
}

export const istVerweis = wert => zerlegeVerweis(wert) != null

// Pfad in einer bestimmten Ablage - fuer das Aufraeumen der Vorgaengerdatei.
export function pfadAusVerweis(wert, ablage) {
  const v = zerlegeVerweis(wert)
  return v && v.ablage === ablage ? v.pfad : null
}

// Die Adresse, unter der der Browser das Bild laden kann.
// Alte Werte (eine https-Adresse) gehen unverändert durch sichereMediaUrl.
export async function bildAdresse(wert) {
  const v = zerlegeVerweis(wert)
  if (!v) return sichereMediaUrl(wert)
  const treffer = cache.get(wert)
  if (treffer && treffer.bis > Date.now() + 60_000) return treffer.url
  if (!client) return ''
  try {
    const { data, error } = await client.storage.from(v.ablage).createSignedUrl(v.pfad, GUELTIG_SEKUNDEN)
    if (error || !data?.signedUrl) return ''
    const url = sichereMediaUrl(data.signedUrl)
    cache.set(wert, { url, bis: Date.now() + GUELTIG_SEKUNDEN * 1000 })
    return url
  } catch {
    return ''
  }
}

// Vor dem Zeichnen alle Verweise auf einmal auflösen.
export async function bilderVorbereiten(werte) {
  const verweise = [...new Set((werte || []).filter(istVerweis))]
  await Promise.all(verweise.map(bildAdresse))
}

// Synchron fürs Zeichnen: aufgelöste Adresse aus dem Zwischenspeicher.
// Vorher bilderVorbereiten() aufrufen.
export function anzeigeUrl(wert) {
  if (!istVerweis(wert)) return sichereMediaUrl(wert)
  return cache.get(wert)?.url || ''
}
