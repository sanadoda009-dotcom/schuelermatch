// Wandelt einen Ort/eine PLZ in Koordinaten um (Open-Meteo Geocoding,
// kostenlos, kein Schluessel noetig).
//
// WICHTIG - drei verschiedene Ergebnisse, nicht zwei:
//   { status: 'ok', lat, lon }   Ort gefunden
//   { status: 'unbekannt' }      Ort gibt es nicht (Tippfehler o.ae.)
//   { status: 'gestoert' }       Dienst antwortet nicht / kein Netz
//
// Der Unterschied zwischen den letzten beiden ist entscheidend: Frueher
// lieferte diese Funktion in beiden Faellen `null`, und die Aufrufer
// schrieben daraufhin `lat = null` in die Datenbank. Wer also nur seinen
// Namen aenderte, waehrend der Geo-Dienst gerade klemmte, verlor seine
// bereits gespeicherten Koordinaten - und tauchte in der Umkreissuche
// nicht mehr auf, ohne es zu merken.
const ZEITLIMIT_MS = 8000

export async function geocode(ort) {
  if (!ort || !ort.trim()) return { status: 'unbekannt' }

  // Ohne Zeitlimit haengt der Aufruf unbegrenzt, wenn der Dienst nicht
  // antwortet - und mit ihm das Speichern des Profils.
  const abbruch = new AbortController()
  const uhr = setTimeout(() => abbruch.abort(), ZEITLIMIT_MS)

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ort.trim())}&count=1&language=de&country=DE&format=json`
    const res = await fetch(url, { signal: abbruch.signal })
    if (!res.ok) return { status: 'gestoert' }
    const data = await res.json()
    const treffer = data.results && data.results[0]
    if (!treffer) return { status: 'unbekannt' }
    return { status: 'ok', lat: treffer.latitude, lon: treffer.longitude }
  } catch {
    return { status: 'gestoert' }
  } finally {
    clearTimeout(uhr)
  }
}

// Traegt die Koordinaten in ein zu speicherndes Objekt ein - und zwar nur
// dann, wenn wir etwas Verlaessliches wissen. Bei einer Stoerung bleiben
// die Felder unangetastet, damit vorhandene Werte erhalten bleiben.
// Gibt zurueck, ob der Ort nicht gefunden wurde (fuer einen Hinweis).
export function uebernehmeKoordinaten(ziel, geo) {
  if (geo.status === 'ok') {
    ziel.lat = geo.lat
    ziel.lon = geo.lon
  } else if (geo.status === 'unbekannt') {
    ziel.lat = null
    ziel.lon = null
  }
  return geo.status === 'unbekannt'
}

// Entfernung zwischen zwei Koordinaten in Kilometern (Haversine).
export function distanzKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v == null)) return null
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}
