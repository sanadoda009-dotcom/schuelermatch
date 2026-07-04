// Wandelt einen Ort/eine PLZ in Koordinaten um (Open-Meteo Geocoding, kostenlos, kein API-Key).
export async function geocode(ort) {
  if (!ort || !ort.trim()) return null
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ort.trim())}&count=1&language=de&country=DE&format=json`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const treffer = data.results && data.results[0]
    if (!treffer) return null
    return { lat: treffer.latitude, lon: treffer.longitude }
  } catch {
    return null
  }
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
