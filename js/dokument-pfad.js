// Wohin ein hochgeladenes Dokument im Storage gehört — und ob die Datei
// überhaupt angenommen wird.
//
// Eigenes Modul, damit es prüfbar ist. Bisher stand das mitten in
// `js/dashboard-schueler.js` hinter dem Supabase-Import und lief in
// keinem Test — dieselbe Lage wie zuvor bei der Trefferlogik des
// Job-Alarms und den Chat-Warnungen. Hier geht es um Ausweisdokumente
// Minderjähriger, das gehört geprüft.
//
// DER FEHLER, DER HIER STECKTE: Der Pfad wurde aus der Endung des
// hochgeladenen Dateinamens gebaut (`file.name.split('.').pop()`).
// Lädt jemand erst „ausweis.jpg" hoch und ersetzt ihn später durch
// „ausweis.pdf", entstehen ZWEI Pfade. In der Datenbank steht nur der
// neue — die alte Datei bleibt für immer im Storage liegen und wird von
// keinem der beiden Löschwege je erfasst, weder vom Schüler noch vom
// Betreiber nach der Prüfung. Genau dieselbe Falle bei „Foto.JPG"
// gegenüber „foto.jpg": andere Groß-/Kleinschreibung, anderer Pfad.
//
// Deshalb entscheidet jetzt der MIME-Typ über die Endung, nicht der
// Dateiname. Der ist vom Browser gesetzt, immer klein geschrieben und
// pro Dateiart eindeutig — damit ist der Pfad je Nutzer und Dokumentart
// eindeutig und `upsert` überschreibt wirklich.

// Genau die Typen, die der Storage-Bucket zulässt (dort in
// `allowed_mime_types` hinterlegt, siehe supabase/rls-stand.sql).
// Hier vorab geprüft, damit der Schüler einen deutschen Satz sieht statt
// einer englischen Storage-Fehlermeldung.
export const ERLAUBTE_TYPEN = {
  'image/png':       'png',
  'image/jpeg':      'jpg',
  'image/jpg':       'jpg',
  'image/webp':      'webp',
  'image/gif':       'gif',
  'application/pdf': 'pdf'
}

// 6 MB — derselbe Wert wie `file_size_limit` am Bucket.
export const MAX_BYTES = 6 * 1024 * 1024

export function endungFuer(mimeTyp) {
  return ERLAUBTE_TYPEN[String(mimeTyp || '').toLowerCase().trim()] || null
}

// Prüft eine Datei, bevor sie überhaupt losgeschickt wird.
// Gibt `{ ok: true }` oder `{ ok: false, fehler: '…' }` zurück.
export function pruefeDatei(datei) {
  if (!datei) return { ok: false, fehler: 'Es wurde keine Datei ausgewählt.' }

  if (!endungFuer(datei.type))
    return {
      ok: false,
      fehler: 'Bitte ein Bild (JPG, PNG, WebP, GIF) oder eine PDF-Datei auswählen.'
    }

  if (datei.size > MAX_BYTES)
    return {
      ok: false,
      fehler: `Die Datei ist zu groß (${(datei.size / 1024 / 1024).toFixed(1)} MB). Erlaubt sind ${MAX_BYTES / 1024 / 1024} MB.`
    }

  return { ok: true }
}

// Der Speicherort: <Nutzer-Id>/<Dokumentart>.<Endung>.
// Der erste Ordner MUSS die Nutzer-Id sein — daran hängen die
// Storage-Regeln (`storage.foldername(name))[1] = auth.uid()`).
export function dokumentPfad(nutzerId, art, mimeTyp) {
  const endung = endungFuer(mimeTyp)
  if (!nutzerId || !art || !endung) return null
  return `${nutzerId}/${art}.${endung}`
}

// Bleibt beim Ersetzen eine alte Datei zurück? Dann steht hier ihr Pfad.
// Wird nur dann etwas, wenn der neue Pfad ein anderer ist — bei gleichem
// Pfad überschreibt `upsert` die Datei ohnehin.
export function verwaisterPfad(alterPfad, neuerPfad) {
  if (!alterPfad || !neuerPfad) return null
  return alterPfad !== neuerPfad ? alterPfad : null
}

// Wie das Dokument angezeigt wird. PDFs brauchen einen Rahmen, Bilder
// ein <img>. Steht hier, damit Betreiber-Bereich und Upload dieselbe
// Vorstellung davon haben, was ein Pfad bedeutet.
export function istPdf(pfad) {
  return /\.pdf$/i.test(String(pfad || ''))
}
