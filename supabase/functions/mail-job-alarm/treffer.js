// Entscheidet, welche Anzeigen ein Schüler per Job-Alarm bekommt.
//
// Bewusst als eigenes Modul und in reinem JavaScript, ohne Deno- oder
// Supabase-Abhängigkeiten: So kann die Edge Function es importieren UND
// die Testsuite es laden. Vorher steckte diese Logik mitten in der
// Funktion und war damit überhaupt nicht prüfbar — obwohl sie das Herz
// des Job-Alarms ist.
//
// Der heikelste Teil ist die Altersprüfung. Wer sie falsch herum
// schreibt, schickt einem 13-Jährigen Anzeigen ab 16. Auf einer
// Plattform für Minderjährige ist das kein Schönheitsfehler.

// Entfernung zweier Punkte in km (Haversine). Dieselbe Rechnung wie in
// js/geo.js im Frontend, damit Umkreissuche und Alarm gleich messen.
export function entfernungKm(aLat, aLon, bLat, bLon) {
  const R = 6371
  const rad = g => (g * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLon = rad(bLon - aLon)
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function normOrt(s) {
  return String(s ?? '').trim().toLowerCase()
}

/**
 * Passt eine Anzeige zu einem Alarm?
 *
 * @param {object} job     Zeile aus `jobs`
 * @param {object} alarm   Zeile aus `job_alarme`
 * @param {object} profil  Profil des Schülers (nur `alter_jahre` wird gelesen)
 * @returns {boolean}
 */
export function passtZumAlarm(job, alarm, profil) {
  // Nur, was seit der letzten Mail dazugekommen ist. Ohne diese Zeile
  // bekäme jemand denselben Job jeden Tag erneut.
  if (alarm.zuletzt_gesendet && job.erstellt_am <= alarm.zuletzt_gesendet) return false

  // Leere Angaben im Alarm heißen „egal", nicht „muss leer sein".
  if (alarm.kategorie && job.kategorie !== alarm.kategorie) return false
  if (alarm.arbeitszeit && job.arbeitszeit !== alarm.arbeitszeit) return false
  if (alarm.min_lohn != null && (job.stundenlohn ?? 0) < alarm.min_lohn) return false

  // Jugendschutz: Was der Schüler noch nicht darf, wird ihm auch nicht
  // vorgeschlagen. Kennt die Anzeige kein Mindestalter oder das Profil
  // kein Alter, wird nicht ausgeschlossen — lieber einmal zu viel
  // zeigen als jemanden grundlos aussperren; auf der Seite selbst steht
  // das Mindestalter ohnehin an jeder Anzeige.
  if (profil?.alter_jahre != null && job.mindestalter != null &&
      job.mindestalter > profil.alter_jahre) return false

  // Ort: mit Koordinaten über den Umkreis, sonst über den Namen.
  // Hat der Alarm gar keinen Ort, zählt der Ort nicht.
  const koordinatenDa = alarm.lat != null && alarm.lon != null &&
                        job.lat != null && job.lon != null
  if (koordinatenDa) {
    return entfernungKm(alarm.lat, alarm.lon, job.lat, job.lon) <= alarm.umkreis_km
  }
  if (alarm.ort) return normOrt(job.ort) === normOrt(alarm.ort)
  return true
}

/**
 * Alle passenden Anzeigen zu einem Alarm, neueste zuerst.
 */
export function trefferFuer(jobs, alarm, profil) {
  return (jobs || []).filter(j => passtZumAlarm(j, alarm, profil))
}
