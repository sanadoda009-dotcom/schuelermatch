// Absagegründe (2.9.2026).
//
// ANLASS: In OFFENE-PUNKTE steht seit dem 26.8. „Kein Rückmeldeweg bei
// Ablehnung: Wird ein Schüler abgelehnt, erfährt er es nirgends". Das
// stimmte nicht ganz — er erfährt DASS, aber nie WARUM. Und für jemanden,
// der sich zum ersten Mal bewirbt, ist das der Unterschied zwischen
// „ich mache etwas falsch" und „es hat diesmal nicht gepasst".
//
// Die deutschen Leitfäden zu wertschätzenden Absagen sagen dasselbe: kurz,
// klar, und mit einem Grund, aus dem man etwas mitnehmen kann.
//
// BEWUSST KEIN FREITEXT. Eine Absage ist eine Nachricht von einem
// Erwachsenen an ein Kind. Ein offenes Feld wäre derselbe Kanal wie der
// Chat und bräuchte dieselbe Prüfung auf Kontaktdaten und Übergriffe
// (js/chat-warnung.js). Feste Gründe schließen das aus — und sie schließen
// auch den verletzenden Satz aus, den jemand im Ärger tippt.
//
// Ohne Supabase-Import, damit ein Test die Sätze direkt prüfen kann.

// Die Schlüssel stehen so auch in der CHECK-Regel der Datenbank
// (supabase/bewerbung-stand.sql). Wer hier einen hinzufügt, muss ihn dort
// ebenfalls eintragen — sonst weist die Datenbank die Absage ab.
export const ABSAGE_GRUENDE = [
  {
    schluessel: 'anderer',
    fuerFirma: 'Wir haben uns für jemand anderen entschieden',
    fuerSchueler: 'Die Firma hat sich für jemand anderen entschieden.',
    trost: 'Das sagt nichts über dich – bei einer Stelle kann nur eine Person genommen werden.',
  },
  {
    schluessel: 'zeit',
    fuerFirma: 'Die Zeiten passen nicht zusammen',
    fuerSchueler: 'Die Arbeitszeiten haben nicht zu deinem Stundenplan gepasst.',
    trost: 'Schreib in deinen Lebenslauf, wann du Zeit hast – dann sieht man es vorher.',
  },
  {
    schluessel: 'entfernung',
    fuerFirma: 'Der Weg ist zu weit',
    fuerSchueler: 'Der Weg war der Firma zu weit.',
    trost: 'Stell in der Jobsuche einen kleineren Umkreis ein – dann kommt das seltener vor.',
  },
  {
    schluessel: 'alter',
    fuerFirma: 'Wir brauchen jemanden, der älter ist',
    fuerSchueler: 'Für diese Aufgabe hat die Firma jemanden gesucht, der älter ist.',
    trost: 'Das ändert sich mit jedem Geburtstag – und viele Jobs gehen schon ab 13.',
  },
  {
    schluessel: 'vergeben',
    fuerFirma: 'Die Stelle ist inzwischen vergeben',
    fuerSchueler: 'Die Stelle war schon vergeben.',
    trost: 'Wer sich früh bewirbt, ist im Vorteil. Der Job-Alarm meldet dir neue Anzeigen sofort.',
  },
]

export function grundFuer(schluessel) {
  return ABSAGE_GRUENDE.find(g => g.schluessel === schluessel) || null
}

// Was der Schüler liest. Ohne Grund bleibt es beim allgemeinen Satz –
// eine Absage ohne Angabe ist immer noch besser als keine Nachricht.
export function absageTextFuerSchueler(schluessel) {
  const g = grundFuer(schluessel)
  if (!g) {
    return {
      satz: 'Diesmal hat es nicht geklappt.',
      trost: 'Kopf hoch – das gehört dazu. Firmen suchen oft sehr genau, und deine nächste Chance wartet schon.',
    }
  }
  return { satz: g.fuerSchueler, trost: g.trost }
}

// Ein Datum in Worten, wie es im Lebenslauf-Bereich und an der Jobkarte
// auch steht: kurz und ohne Rechnen.
export function kurzesDatum(wert) {
  if (!wert) return ''
  const d = new Date(wert)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}
