// Deterministische Test-Jobs für die gemockte Supabase-Antwort.
// Reihenfolge = „neueste zuerst“ (so liefert es die echte DB via order erstellt_am desc).
//
// Jede Filterdimension ist gezielt abgedeckt:
// - Kategorie: Gastronomie / Nachhilfe / Verkauf / Tierbetreuung
// - Synonym-Suche: „kellner“ → Gastronomie, „gassi“ → Tierbetreuung
// - NEU-Badge: Job 1 ist frisch (< 72h), die anderen sind alt
// - Lohn-Sortierung: 16 > 14 > 12 > 9
// - Mindestalter: 13–16, Arbeitszeit + Ort variieren

const vorTagen = t => new Date(Date.now() - t * 24 * 3600 * 1000).toISOString()

const JOBS = [
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    titel: 'Service-Aushilfe im Café Sonnenschein',
    beschreibung: 'Getränke servieren, Tische abräumen, freundlich lächeln. Restaurant-Erfahrung nicht nötig.',
    ort: 'München',
    stundenlohn: 14,
    mindestalter: 16,
    verfuegbarkeit: 'Sa + So',
    kategorie: 'Gastronomie',
    arbeitszeit: 'Wochenende',
    aktiv: true,
    aufrufe: 42,
    erstellt_am: vorTagen(1), // < 72h -> NEU-Badge
    firma_id: 'ffffffff-0000-4000-8000-000000000001',
    lat: 48.137, lon: 11.575,
  },
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000002',
    titel: 'Mathe-Nachhilfe für 7. Klasse',
    beschreibung: 'Einmal pro Woche einer Schülerin bei Mathe helfen. Geduld wichtiger als Einser-Zeugnis.',
    ort: 'München',
    stundenlohn: 16,
    mindestalter: 15,
    verfuegbarkeit: 'flexibel',
    kategorie: 'Nachhilfe',
    arbeitszeit: 'Nachmittags',
    aktiv: true,
    aufrufe: 17,
    erstellt_am: vorTagen(10),
    firma_id: 'ffffffff-0000-4000-8000-000000000002',
    lat: 48.14, lon: 11.58,
  },
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000003',
    titel: 'Regale einräumen im Getränkemarkt',
    beschreibung: 'Samstags Regale auffüllen und Leergut sortieren im Laden.',
    ort: 'Augsburg',
    stundenlohn: 12,
    mindestalter: 14,
    verfuegbarkeit: 'Sa vormittags',
    kategorie: 'Verkauf',
    arbeitszeit: 'Wochenende',
    aktiv: true,
    aufrufe: 8,
    erstellt_am: vorTagen(20),
    firma_id: 'ffffffff-0000-4000-8000-000000000003',
    lat: 48.366, lon: 10.894,
  },
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000004',
    titel: 'Hunde ausführen am Nachmittag',
    beschreibung: 'Zwei liebe Hunde brauchen nachmittags eine Gassi-Runde im Westpark.',
    ort: 'München',
    stundenlohn: 9,
    mindestalter: 13,
    verfuegbarkeit: 'Mo–Fr ab 15 Uhr',
    kategorie: 'Tierbetreuung',
    arbeitszeit: 'Nachmittags',
    aktiv: true,
    aufrufe: 3,
    erstellt_am: vorTagen(30),
    firma_id: 'ffffffff-0000-4000-8000-000000000004',
    lat: 48.12, lon: 11.51,
  },
]

module.exports = { JOBS, vorTagen }
