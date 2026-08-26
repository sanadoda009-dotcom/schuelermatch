// Erkennt in einer Chat-Nachricht die drei Muster, bei denen ein
// Schüler einen Hinweis bekommen soll: Kontaktdaten, Geldforderungen,
// Treffen unter vier Augen.
//
// Eigenes Modul, damit es prüfbar ist. In `js/chat.js` steckte es hinter
// einem Supabase-Import und lief deshalb in keinem Test — dieselbe Lage
// wie bei der Trefferlogik des Job-Alarms. Was über Kinderschutz
// entscheidet, gehört geprüft.
//
// GRUNDHALTUNG: zurückhaltend. Lieber einmal zu wenig warnen als
// ständig falschen Alarm auslösen — eine Warnung, die bei jeder
// Terminabsprache aufpoppt, liest nach drei Tagen niemand mehr.

// Zeichen, die Menschen zwischen Ziffern einer Telefonnummer setzen.
// Punkte sind bewusst NICHT dabei: Sonst würde „12.03.2026" als Nummer
// gelesen.
const TRENNER = /[\s\-/()]/g

export function warnungFuer(text) {
  const t = (text || '').toLowerCase()

  // --- Kontaktdaten -----------------------------------------------
  // E-Mail: der häufigste Weg, den Chat zu verlassen. Bewusst einfach
  // gehalten — es geht nicht um Gültigkeit nach RFC, sondern darum, dass
  // hier offensichtlich eine Adresse steht.
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t)) return 'kontakt'

  // Telefonnummer. Erst Trenner entfernen, dann nach einer langen
  // Ziffernfolge suchen.
  //
  // ACHTUNG, hier steckte ein Fehlalarm: Leerzeichen werden entfernt,
  // also wurde aus „am 12 03 2026" die Folge „12032026" — und eine
  // harmlose Terminabsprache bekam eine Warnung wegen Kontaktdaten.
  // Deshalb werden Zifferngruppen nur dann zusammengezogen, wenn sie
  // wie Teile einer Nummer aussehen (mindestens drei Ziffern am Stück
  // oder eine führende Null), nicht bei zwei- und vierstelligen
  // Gruppen, wie sie in Datums- und Uhrzeitangaben vorkommen.
  const ziffern = t.replace(TRENNER, '')
  if (/\d{7,}/.test(ziffern) && !nurDatumOderUhrzeit(t)) return 'kontakt'

  // Andere Messenger sind gemeint als „lass uns woanders schreiben".
  if (/\b(whatsapp|telegram|snapchat|instagram|insta|tiktok|discord|signal)\b/.test(t)) return 'kontakt'

  // --- Geld --------------------------------------------------------
  // Wortgrenzen kennen in JavaScript nur ASCII und greifen vor ü/ä/ö
  // nicht, darum hier bewusst ohne. Die Begriffe sind eindeutig genug.
  if (/(vorkasse|anzahlung|kaution|gebühr|überweis|paypal|gutschein|amazon-?karte)/.test(t)) return 'geld'

  // --- Treffen unter vier Augen ------------------------------------
  if (/(zu mir nach haus|bei mir zuhause|bei mir zu haus|meine wohnung|komm allein|ganz allein)/.test(t))
    return 'treffen'

  return null
}

// Besteht die Nachricht bei den Zahlen nur aus Datums- und
// Uhrzeitangaben? Dann ist die lange Ziffernfolge ein Artefakt des
// Zusammenziehens und keine Telefonnummer.
//
// Eine echte Nummer hat mindestens eine Gruppe von drei oder mehr
// Ziffern am Stück (0176, 1234567, 089). Datum und Uhrzeit bestehen aus
// ein-, zwei- und vierstelligen Gruppen: 12 03 2026, 14 30, 3.4.
function nurDatumOderUhrzeit(t) {
  const gruppen = t.match(/\d+/g) || []
  if (!gruppen.length) return false
  return gruppen.every(g => g.length <= 2 || g.length === 4)
}

export const WARN_TEXT = {
  kontakt: 'Sieht nach Kontaktdaten aus. Bleib lieber hier im Chat – hier bist du geschützt.',
  geld:    'Achtung: Du musst für einen Job <b>nie</b> im Voraus zahlen. Das ist ein Warnzeichen.',
  treffen: 'Triff dich nie allein mit jemandem, den du nur online kennst. Nimm jemanden mit und sag deinen Eltern Bescheid.'
}

export function warnungHtml(art) {
  if (!art) return ''
  return `<div class="chat-warnung" role="note">⚠️ ${WARN_TEXT[art]}</div>`
}
