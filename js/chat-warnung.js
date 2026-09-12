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

  // Nach DEINER Nummer oder Adresse fragen, ohne selbst eine zu nennen.
  //
  // eltern.html verspricht wörtlich eine Warnung, wenn „jemand im Chat
  // nach der Handynummer fragt". Erkannt wurde bis zum 12.9.2026 aber
  // nur, wer selbst eine Nummer oder Adresse hinschreibt – „Gib mir mal
  // deine Handynummer" blieb stumm. Das Wort allein reicht nicht („meine
  // Nummer steht im Profil" ist harmlos); gewarnt wird, wenn nach der
  // Nummer des Gegenübers gefragt wird.
  if (/(deine|ihre|eure)\s+(handy|telefon)?-?(nummer|nr\b)/.test(t)) return 'kontakt'
  if (/(deine|ihre|eure)\s+(private[n]?\s+)?(e-?mail|mailadresse|adresse|anschrift)/.test(t)) return 'kontakt'

  // --- Geld --------------------------------------------------------
  // Wortgrenzen kennen in JavaScript nur ASCII und greifen vor ü/ä/ö
  // nicht, darum hier bewusst ohne. Die Begriffe sind eindeutig genug.
  //
  // „Vorauszahlung" selbst stand bis zum 12.9.2026 nicht in der Liste –
  // ausgerechnet das Wort, mit dem eltern.html die Warnung verspricht.
  // Ebenso fehlten „im Voraus zahlen" und „vorab bezahlen", obwohl die
  // Warnung selbst genau so formuliert ist („nie im Voraus zahlen").
  // Nicht jedes „zahlen" ist gemeint – Lohn wird auch bezahlt. Gewarnt
  // wird nur, wenn die Zahlung VOR dem Job liegen soll.
  if (/(vorkasse|anzahlung|vorauszahlung|kaution|gebühr|überweis|paypal|gutschein|amazon-?karte)/.test(t)) return 'geld'
  //
  // Die Beruhigung „Vorab musst du nichts zahlen" soll dabei nichts
  // auslösen – das ist der natürlichste Satz eines seriösen
  // Arbeitgebers zu genau diesem Thema. Deshalb zählt die Stelle nur,
  // wenn zwischen „vorab" und „zahlen" keine Verneinung steht.
  const vorab = t.match(/(im voraus|vorab)\s+((?:\S+\s+){0,3})(zahl|bezahl|schick)/)
    || t.match(/(zahl|bezahl)\S*\s+((?:\S+\s+){0,3})(im voraus|vorab)/)
  if (vorab && !/\b(nicht|nichts|kein|keine|nie)\b/.test(vorab[2])) return 'geld'

  // --- Treffen unter vier Augen ------------------------------------
  //
  // eltern.html sagt „Treffen allein". Erkannt wurden bis zum 12.9.2026
  // nur feste Wendungen wie „komm allein"; „wir können uns auch allein
  // treffen" und „unter vier Augen" blieben stumm. Ein Treffen im Laden
  // mit Kolleginnen soll dagegen nichts auslösen – deshalb braucht es
  // beides: das Treffen UND das Alleinsein.
  if (/(zu mir nach haus|bei mir zuhause|bei mir zu haus|meine wohnung|komm allein|ganz allein|unter vier augen)/.test(t))
    return 'treffen'
  // „Du musst nicht allein arbeiten" ist das Gegenteil einer Gefahr.
  if (/allein/.test(t) && !/nicht\s+allein/.test(t)
      && /(treffen|triff|vorbeikomm|abhol|hol\S*\s+dich)/.test(t)) return 'treffen'

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
