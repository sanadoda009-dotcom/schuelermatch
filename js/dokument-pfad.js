// Wohin eine hochgeladene Datei im Storage gehört — und ob sie
// überhaupt angenommen wird.
//
// Eigenes Modul, damit es prüfbar ist. Bisher stand das an fünf Stellen
// verstreut hinter dem Supabase-Import und lief in keinem Test —
// dieselbe Lage wie zuvor bei der Trefferlogik des Job-Alarms und den
// Chat-Warnungen.
//
// DER FEHLER, DER HIER STECKTE: Der Pfad wurde aus der Endung des
// hochgeladenen Dateinamens gebaut (`file.name.split('.').pop()`).
// Lädt jemand erst „ausweis.jpg" hoch und ersetzt ihn später durch
// „ausweis.pdf", entstehen ZWEI Pfade. In der Datenbank steht nur der
// neue — die alte Datei bleibt für immer im Storage liegen und wird von
// keinem Löschweg je erfasst. Genau dieselbe Falle bei „Foto.JPG"
// gegenüber „foto.jpg": andere Schreibweise, anderer Pfad.
//
// Betroffen waren: Schülerausweis und Schulbestätigung, das Zeugnis zur
// Bewerbung, das Profilfoto und die Bilder im Lebenslauf. Bei den Fotos
// wiegt es schwerer, denn `avatars` und `lebenslauf-bilder` sind
// ÖFFENTLICHE Ablagen: Eine zurückgebliebene Datei bleibt unter ihrer
// alten Adresse für jeden abrufbar — auch wenn der Schüler sein Foto
// längst ausgetauscht hat.
//
// Deshalb entscheidet jetzt der MIME-Typ über die Endung, nicht der
// Dateiname. Der ist vom Browser gesetzt, immer klein geschrieben und
// pro Dateiart eindeutig — damit ist der Pfad eindeutig und `upsert`
// überschreibt wirklich.

// Genau die Typen und Grenzen, die die Ablagen zulassen (in
// `storage.buckets` hinterlegt, siehe supabase/rls-stand.sql).
// Hier vorab geprüft, damit ein 14-Jähriger einen deutschen Satz sieht
// statt einer englischen Storage-Fehlermeldung.
//
// Weicht diese Tabelle vom Bucket ab, meldet die Seite „passt" und der
// Storage lehnt danach trotzdem ab. tests/dokument-pfad.spec.js hält
// die Übereinstimmung fest.
const NUR_BILD = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
const BILD_UND_PDF = [...NUR_BILD, 'application/pdf']

export const BUCKETS = {
  'verifizierung':     { maxBytes: 6291456, typen: BILD_UND_PDF, oeffentlich: false },
  'zeugnisse':         { maxBytes: 6291456, typen: BILD_UND_PDF, oeffentlich: false },
  'avatars':           { maxBytes: 3145728, typen: NUR_BILD,     oeffentlich: true },
  'lebenslauf-bilder': { maxBytes: 3145728, typen: NUR_BILD,     oeffentlich: true }
}

// Welche Endung ein MIME-Typ bekommt. Alles, was hier nicht steht, wird
// gar nicht erst hochgeladen.
export const ERLAUBTE_TYPEN = {
  'image/png':       'png',
  'image/jpeg':      'jpg',
  'image/jpg':       'jpg',
  'image/webp':      'webp',
  'image/gif':       'gif',
  'application/pdf': 'pdf'
}

// 6 MB — die Grenze der Verifizierung, für den häufigsten Aufruf.
export const MAX_BYTES = BUCKETS.verifizierung.maxBytes

export function endungFuer(mimeTyp) {
  return ERLAUBTE_TYPEN[String(mimeTyp || '').toLowerCase().trim()] || null
}

// Prüft eine Datei gegen die Grenzen ihrer Ablage.
// Gibt `{ ok: true }` oder `{ ok: false, fehler: '…' }` zurück.
export function pruefeFuerBucket(datei, bucket) {
  const regel = BUCKETS[bucket]
  if (!regel) return { ok: false, fehler: 'Unbekannte Ablage.' }
  if (!datei) return { ok: false, fehler: 'Es wurde keine Datei ausgewählt.' }

  const typ = String(datei.type || '').toLowerCase().trim()
  if (!regel.typen.includes(typ))
    return {
      ok: false,
      fehler: regel.typen.includes('application/pdf')
        ? 'Bitte ein Bild (JPG, PNG, WebP, GIF) oder eine PDF-Datei auswählen.'
        : 'Bitte ein Bild auswählen (JPG, PNG, WebP oder GIF).'
    }

  if (datei.size > regel.maxBytes)
    return {
      ok: false,
      fehler: `Die Datei ist zu groß (${(datei.size / 1024 / 1024).toFixed(1)} MB). Erlaubt sind ${regel.maxBytes / 1024 / 1024} MB.`
    }

  return { ok: true }
}

// Kurzform für die Verifizierung.
export function pruefeDatei(datei) {
  return pruefeFuerBucket(datei, 'verifizierung')
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

// Bei den öffentlichen Ablagen steht in der Datenbank keine Pfadangabe,
// sondern die fertige Adresse — mit angehängtem `?t=…` gegen den
// Zwischenspeicher. Um die Vorgängerdatei zu löschen, braucht es daraus
// wieder den Pfad.
export function pfadAusUrl(url, bucket) {
  if (!url || !bucket) return null
  const marke = `/storage/v1/object/public/${bucket}/`
  const i = String(url).indexOf(marke)
  if (i === -1) return null
  const rest = String(url).slice(i + marke.length).split('?')[0].split('#')[0]
  try { return decodeURIComponent(rest) || null } catch { return rest || null }
}

// Wie das Dokument angezeigt wird. PDFs brauchen einen Rahmen, Bilder
// eine Bildmarke. Steht hier, damit Betreiber-Bereich und Upload
// dieselbe Vorstellung davon haben, was ein Pfad bedeutet.
export function istPdf(pfad) {
  return /\.pdf$/i.test(String(pfad || ''))
}
