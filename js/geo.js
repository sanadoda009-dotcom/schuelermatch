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

// DER PARAMETER `country=DE` HAT NIE ETWAS BEWIRKT (gemessen 8.9.2026)
//
// Er stand in der Adresse, der Dienst kennt ihn aber nicht - und lieferte
// ungeruehrt Orte aus aller Welt. Zehn deutsche Postleitzahlen probiert:
//
//   80331 -> Muenchen (DE)      als einzige richtig
//   10115 -> New York City (US)
//   51103 -> Sioux City (US)
//   04109 -> Portland (US)
//   90402 -> Santa Monica (US)
//   66111 -> Kansas City (US)
//   28195 -> Serrada de la Fuente (ES)
//   20095, 70173, 99084 -> gar nichts
//
// Diese Koordinaten landeten ungeprueft im Profil. Ein Schueler aus
// Berlin, der 10115 eintippt, stand danach in New York - und fand in der
// Umkreissuche fuer immer nichts, ohne je zu erfahren, warum. Ein
// falscher Ort ist schlimmer als kein Ort: Kein Ort sagt wenigstens die
// Wahrheit.
//
// Deshalb wird das Land jetzt an der ANTWORT geprueft (`country_code`),
// nicht an der Anfrage.
const LAND = 'DE'

// UMLAUTE OHNE UMLAUTE
// Auf dem Handy tippt man "muenchen", "koeln", "wuerzburg". Der Dienst
// faltet das nicht - "muenchen" ergab Muenchendorf in OESTERREICH, 350 km
// daneben. Ein zweiter Versuch mit zurueckgesetzten Umlauten holt das auf:
// koeln, tuebingen, osnabrueck, wuerzburg, saarbruecken - alle gefunden.
//
// Die Regel "ss wird zum scharfen s" bleibt bewusst DRAUSSEN: Aus
// "duesseldorf" wuerde damit ein Wort mit scharfem s in der Mitte, und
// das findet nichts. Gemessen, nicht vermutet.
function mitUmlauten(ort) {
  return ort.replace(/ue/g, 'ü').replace(/oe/g, 'ö').replace(/ae/g, 'ä')
}

// Sieht die Eingabe nach einer deutschen Postleitzahl aus?
export function istPlz(ort) {
  return /^\s*\d{5}\s*$/.test(String(ort || ''))
}

async function frage(ort, abbruch) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ort)}&count=10&language=de&format=json`
  const res = await fetch(url, { signal: abbruch.signal })
  if (!res.ok) return { gestoert: true }
  const data = await res.json()
  const treffer = (data.results || []).find(t => t.country_code === LAND)
  return { treffer }
}

export async function geocode(ort) {
  if (!ort || !ort.trim()) return { status: 'unbekannt' }
  const eingabe = ort.trim()

  // Ohne Zeitlimit haengt der Aufruf unbegrenzt, wenn der Dienst nicht
  // antwortet - und mit ihm das Speichern des Profils.
  const abbruch = new AbortController()
  const uhr = setTimeout(() => abbruch.abort(), ZEITLIMIT_MS)

  try {
    let { treffer, gestoert } = await frage(eingabe, abbruch)
    if (gestoert) return { status: 'gestoert' }

    // Zweiter Versuch mit Umlauten - aber nur, wenn er etwas aendern kann.
    const zweite = mitUmlauten(eingabe)
    if (!treffer && zweite !== eingabe) {
      const b = await frage(zweite, abbruch)
      if (b.gestoert) return { status: 'gestoert' }
      treffer = b.treffer
    }

    if (!treffer) return { status: 'unbekannt', plz: istPlz(eingabe) }
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
