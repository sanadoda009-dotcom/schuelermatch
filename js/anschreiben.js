// Der Anschreiben-Coach.
//
// WARUM ES IHN GIBT (27.8.2026)
// `fuer-firmen.html` verspricht den Arbeitgebern: „Bewerbungen mit
// Substanz. Zu jeder Bewerbung gehören ein Lebenslauf und ein kurzes
// Motivationsschreiben – auch von Fünfzehnjährigen, die so etwas zum
// ersten Mal schreiben. **Die Plattform hilft ihnen dabei.**"
//
// Geholfen hat sie mit einem Knopf, der einen von drei fertigen
// Beispieltexten ins Feld warf. Bewerben sich fünf Schüler, bekommt der
// Arbeitgeber fünfmal denselben Text. Das ist keine Hilfe, das ist eine
// Schablone — und sie macht die Bewerbung schlechter, nicht besser: Ein
// Anschreiben, das nichts über den Absender verrät, ist wertlos.
//
// DER ANSATZ HIER IST UMGEKEHRT:
// Das Gerüst kommt von uns, **der Inhalt kommt vom Schüler**. Wir
// stellen drei kurze, konkrete Fragen — die mittlere je nach Job-Art
// eine andere — und bauen daraus ein Anschreiben aus seinen eigenen
// Worten. Wer nichts beantwortet, bekommt auch keinen Text; ein leeres
// Gerüst wäre wieder nur eine Schablone.
//
// Dazu eine Rückmeldung, die sagt, was noch fehlt. Freundlich und nie
// blockierend: Absenden darf man immer, es ist die eigene Bewerbung.
//
// Eigenes Modul ohne Abhängigkeit zu Supabase, damit es prüfbar ist.

import { warnungFuer } from './chat-warnung.js'

// Die mittlere Frage. Sie macht den Unterschied zwischen „erzähl was
// über dich" (worauf niemand antworten kann) und einer Frage, auf die
// ein 14-Jähriger sofort eine Antwort weiß.
//
// `hinweis` steht klein unter dem Feld und nennt ein Beispiel — ohne
// Beispiel starren die meisten auf ein leeres Feld.
const NACH_KATEGORIE = {
  'Nachhilfe': {
    frage: 'In welchen Fächern bist du gut?',
    hinweis: 'z.B. „In Mathe stehe ich auf 2 und erkläre gern."'
  },
  'Babysitten': {
    frage: 'Hast du schon auf jüngere Kinder aufgepasst?',
    hinweis: 'z.B. „Ich passe oft auf meine kleine Schwester auf." Auch „noch nicht, aber…" ist eine gute Antwort.'
  },
  'Tierbetreuung': {
    frage: 'Welche Erfahrung hast du mit Tieren?',
    hinweis: 'z.B. „Wir haben selbst einen Hund, ich gehe jeden Tag mit ihm raus."'
  },
  'Gastronomie': {
    frage: 'Was fällt dir im Umgang mit Menschen leicht?',
    hinweis: 'z.B. „Ich bin freundlich, auch wenn viel los ist."'
  },
  'Verkauf': {
    frage: 'Was fällt dir im Umgang mit Menschen leicht?',
    hinweis: 'z.B. „Ich helfe gern und kann gut auf Leute zugehen."'
  },
  'Lieferung & Kurier': {
    frage: 'Wie bist du unterwegs, und kennst du dich in der Gegend aus?',
    hinweis: 'z.B. „Mit dem Fahrrad, ich wohne hier und kenne die Straßen."'
  },
  'Haushalt & Garten': {
    frage: 'Wobei hast du zu Hause schon geholfen?',
    hinweis: 'z.B. „Rasen mähen und Laub rechen mache ich bei uns regelmäßig."'
  },
  'Büro & Organisation': {
    frage: 'Womit kennst du dich am Computer aus?',
    hinweis: 'z.B. „Mit Word und Excel, ich schreibe damit meine Referate."'
  },
  'Technik & Computer': {
    frage: 'Womit kennst du dich technisch aus?',
    hinweis: 'z.B. „Ich baue PCs zusammen und helfe meinen Großeltern mit dem Handy."'
  }
}

const STANDARD_KOENNEN = {
  frage: 'Was kannst du gut, das hier hilft?',
  hinweis: 'Muss nichts Großes sein — „ich bin pünktlich und packe mit an" zählt auch.'
}

// Die drei Fragen zu einem Job. Bewusst nur drei: Wer sieben Felder
// sieht, bricht ab.
export function fragenFuer(job = {}) {
  const kat = NACH_KATEGORIE[job.kategorie] || STANDARD_KOENNEN

  return [
    {
      id: 'warum',
      frage: 'Warum interessiert dich gerade dieser Job?',
      hinweis: 'Ein ehrlicher Satz reicht. „Ich will mein erstes eigenes Geld verdienen" ist völlig in Ordnung.'
    },
    { id: 'koennen', frage: kat.frage, hinweis: kat.hinweis },
    {
      id: 'zeit',
      frage: 'Wann könntest du?',
      hinweis: job.verfuegbarkeit
        ? `In der Anzeige steht: „${job.verfuegbarkeit}". Passt das bei dir?`
        : 'z.B. „nachmittags ab 15 Uhr und samstags"'
    }
  ]
}

function saubere(text) {
  return String(text || '').trim().replace(/\s+/g, ' ')
}

// Hängt einen Punkt an, wenn der Satz ohne Satzzeichen endet — sonst
// klebt im fertigen Text alles aneinander.
function alsSatz(text) {
  const t = saubere(text)
  if (!t) return ''
  return /[.!?…]$/.test(t) ? t : t + '.'
}

// Baut das Anschreiben. Das Gerüst ist von uns, die Sätze dazwischen
// sind seine.
//
// Gibt '' zurück, wenn nichts beantwortet wurde — ein leeres Gerüst
// wäre wieder nur eine Schablone.
export function baueAnschreiben({ antworten = {}, job = {}, name = '' } = {}) {
  const warum = alsSatz(antworten.warum)
  const koennen = alsSatz(antworten.koennen)
  const zeit = alsSatz(antworten.zeit)

  if (!warum && !koennen && !zeit) return ''

  const firma = saubere(job.firma_name)
  const titel = saubere(job.titel)

  const teile = []
  teile.push(firma ? `Hallo ${firma},` : 'Hallo,')
  teile.push('')

  teile.push(titel
    ? `ich habe eure Anzeige „${titel}" auf SchülerMatch gesehen und möchte mich gern bewerben.`
    : 'ich habe eure Anzeige auf SchülerMatch gesehen und möchte mich gern bewerben.')

  if (warum) { teile.push(''); teile.push(warum) }
  if (koennen) { teile.push(''); teile.push(koennen) }
  if (zeit) { teile.push(''); teile.push(zeit) }

  teile.push('')
  teile.push('Über eine Antwort würde ich mich freuen.')
  teile.push('')
  teile.push('Viele Grüße')
  if (saubere(name)) teile.push(saubere(name))

  return teile.join('\n')
}

// Was noch fehlt. Nie blockierend — es ist seine Bewerbung, absenden
// darf er immer.
//
// `art`: 'fehlt' (freundlicher Hinweis) · 'achtung' (ernst) · 'gut'
export function pruefeAnschreiben(text, job = {}) {
  const t = saubere(text)
  const rueck = []

  if (!t) return [{ art: 'fehlt', text: 'Noch nichts geschrieben. Beantworte oben die drei Fragen – daraus wird ein Anschreiben.' }]

  // KONTAKTDATEN. Dieselbe Erkennung wie im Chat (js/chat-warnung.js),
  // damit es dafür nur eine Quelle gibt. Hier wiegt es sogar schwerer:
  // Die Handynummer eines Minderjährigen steht dann dauerhaft in einer
  // Bewerbung, die der Arbeitgeber behält.
  if (warnungFuer(t) === 'kontakt') {
    rueck.push({
      art: 'achtung',
      text: 'Sieht so aus, als stünde da eine Handynummer oder E-Mail. Lass sie lieber weg – ihr schreibt hier im Chat, und der ist geschützt.'
    })
  }

  const woerter = t.split(' ').filter(Boolean).length

  if (woerter < 25) {
    rueck.push({ art: 'fehlt', text: 'Noch sehr kurz. Drei, vier Sätze wirken schon deutlich überzeugender.' })
  } else if (woerter > 220) {
    rueck.push({ art: 'fehlt', text: 'Ganz schön lang. Kürzer wird es oft stärker – das Wichtigste zuerst.' })
  }

  // Bezug auf DIESEN Job. Ein Anschreiben, das überall passen würde,
  // sagt nichts aus.
  const titelWorte = saubere(job.titel).toLowerCase().split(/[^a-zäöüß]+/i).filter(w => w.length > 4)
  const nenntJob = titelWorte.some(w => t.toLowerCase().includes(w))
  if (titelWorte.length && !nenntJob) {
    rueck.push({ art: 'fehlt', text: 'Schreib noch dazu, um welchen Job es geht – dann merkt man, dass er nicht an alle ging.' })
  }

  if (!/\b(ich|mir|mich|mein)\b/i.test(t)) {
    rueck.push({ art: 'fehlt', text: 'Es geht um dich – schreib ruhig, was du kannst und willst.' })
  }

  if (!/(grüß|gruss|freundlich|freuen|danke)/i.test(t)) {
    rueck.push({ art: 'fehlt', text: 'Ein Schlusssatz fehlt noch, zum Beispiel „Über eine Antwort würde ich mich freuen. Viele Grüße".' })
  }

  if (!rueck.length) {
    rueck.push({ art: 'gut', text: 'Das liest sich gut. Damit kannst du es abschicken.' })
  }

  return rueck
}
