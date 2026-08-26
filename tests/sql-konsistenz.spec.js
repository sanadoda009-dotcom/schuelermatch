// Die SQL-Dateien dürfen einander nicht widersprechen (27.8.).
//
// WARUM ES DIESEN TEST GIBT
// `supabase/rls-stand.sql` ist als Wiederherstellungs-Skript gedacht:
// „alle Zugriffsregeln auf einmal". Am 27.8. wurde die Bewerbungs-Regel
// verschärft — sie verlangt jetzt eine abgeschlossene Verifizierung.
// `rls-stand.sql` erklärte aber weiter die ALTE, großzügige Regel.
//
// Wer die Datei eingespielt hätte, um „den Stand wiederherzustellen",
// hätte die Lücke wieder aufgerissen — und zwar unbemerkt, denn
// PostgreSQL verknüpft mehrere erlaubende Regeln mit ODER. Die
// großzügigere gewinnt.
//
// Genau das ist beim Einspielen schon einmal passiert: Die alte Regel
// hieß „Bewerben", meine Datei löschte aber „Schueler bewirbt sich" —
// einen Namen, den es gar nicht gab. `drop policy if exists` schweigt
// eben auch dann, wenn der Name falsch ist. Aufgefallen ist es nur durch
// die Kontrollabfrage NACH dem Einspielen.
//
// Diese Prüfungen lesen die Dateien direkt von der Festplatte —
// `supabase/` steht in `.vercelignore` und wird nicht ausgeliefert.
const { test, expect } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const ORDNER = path.join(__dirname, '..', 'supabase')
const lies = datei => fs.readFileSync(path.join(ORDNER, datei), 'utf8')

test.describe('rls-stand.sql nimmt keine Sicherheitsentscheidung zurück', () => {
  test('die Bewerbungs-Regel verlangt die Verifizierung', async () => {
    const sql = lies('rls-stand.sql')
    const block = sql.slice(sql.indexOf('on public.bewerbungen'))
    const regel = block.slice(0, block.indexOf('for insert') + 400)
    expect(regel, 'die INSERT-Regel muss ist_verifiziert prüfen')
      .toMatch(/ist_verifiziert\(auth\.uid\(\)\)/)
  })

  test('die alte großzügige Regel wird nicht neu angelegt', async () => {
    // `create policy "Bewerben"` war der Fehler. Ein `drop` desselben
    // Namens ist dagegen richtig und muss dableiben.
    const sql = lies('rls-stand.sql')
    expect(sql, 'die alte Regel darf nicht wieder erzeugt werden')
      .not.toMatch(/create policy "Bewerben"/)
    expect(sql, 'sie muss aber ausdrücklich entfernt werden')
      .toMatch(/drop policy if exists "Bewerben"/)
  })

  test('die Hilfsfunktion ist mit dabei', async () => {
    // Ohne sie schlägt die Regel beim Wiedereinspielen fehl.
    const sql = lies('rls-stand.sql')
    expect(sql).toMatch(/create or replace function public\.ist_verifiziert/)
  })

  test('jede benutzte Hilfsfunktion ist irgendwo im Ordner definiert', async () => {
    // Nicht zwingend in derselben Datei: `ist_admin()` steht bewusst nur
    // in schutz-trigger.sql, damit es dafür eine einzige Quelle gibt.
    // Diese Abhängigkeit ist dort im Kopf vermerkt — und genau deshalb
    // steht in OFFENE-PUNKTE, dass die Dateien zusammengehören.
    //
    // Was NICHT passieren darf: eine Funktion, die nirgends definiert
    // ist. Dann scheitert das Wiedereinspielen mitten drin, und man
    // steht mit halb angelegten Regeln da.
    const alleSql = fs.readdirSync(ORDNER)
      .filter(f => f.endsWith('.sql'))
      .map(lies).join('\n')

    const sql = lies('rls-stand.sql')
    const benutzt = new Set([...sql.matchAll(/public\.(\w+)\(/g)].map(m => m[1]))
    const definiert = new Set([...alleSql.matchAll(/create or replace function public\.(\w+)/g)].map(m => m[1]))

    // Tabellennamen sind keine Funktionen — die stehen hinter `on` oder
    // `from`, nicht vor einer Klammer. Der Filter oben verlangt die
    // Klammer, deshalb bleibt nur echtes Aufrufen übrig.
    const fehlend = [...benutzt].filter(f => !definiert.has(f))
    expect(fehlend, 'benutzt, aber in keiner SQL-Datei definiert').toEqual([])
  })

  test('die Abhängigkeit zu schutz-trigger.sql ist vermerkt', async () => {
    // Sie ist der Grund, warum die Dateien zusammen eingespielt werden
    // müssen. Ohne den Hinweis läuft jemand hinein.
    const sql = lies('rls-stand.sql')
    expect(sql).toMatch(/ist_admin\(\).{0,80}schutz-trigger\.sql/s)
  })
})

test.describe('jede Regeländerung entfernt ihren Vorgänger', () => {
  // Der Kern der Falle: `drop policy if exists` mit dem falschen Namen
  // schweigt. Wer eine Regel ersetzt, muss ALLE Namen kennen, unter
  // denen sie je lief.
  const DATEIEN = ['bewerbung-verifiziert.sql', 'rls-stand.sql']

  for (const datei of DATEIEN) {
    test(`${datei}: vor jedem create policy steht ein passendes drop`, async () => {
      const sql = lies(datei)
      const ohneDrop = []

      for (const m of sql.matchAll(/create policy "([^"]+)" on ([\w.]+)/g)) {
        const [, name, tabelle] = m
        const davor = sql.slice(0, m.index)
        const musterA = new RegExp(`drop policy if exists "${name}" on ${tabelle.replace('.', '\\.')}`)
        if (!musterA.test(davor)) ohneDrop.push(`${tabelle}: "${name}"`)
      }

      expect(ohneDrop, 'ohne vorheriges drop ist die Datei nicht wiederholbar').toEqual([])
    })
  }
})

test.describe('die Altersgrenze steht überall gleich', () => {
  // Drei Stellen erklären dieselbe Regel: das Modul im Browser und zwei
  // SQL-Dateien. Genau an solchem Auseinanderlaufen ist das
  // Anzeigenformular gescheitert.
  test('13 in beiden SQL-Dateien', async () => {
    for (const datei of ['mindestalter-grenze.sql', 'alter-grenze.sql']) {
      const sql = lies(datei)
      expect(sql, `${datei}: untere Grenze`).toMatch(/>= 13/)
      expect(sql, `${datei}: obere Grenze`).toMatch(/<= 20/)
    }
  })

  test('und im Modul, das der Browser benutzt', async () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'jugendschutz.js'), 'utf8')
    expect(js).toMatch(/MIN_ALTER = 13/)
    expect(js).toMatch(/MAX_ALTER = 20/)
  })
})

test('jede SQL-Datei sagt, was sie tut und was der Stand war', async () => {
  // Diese Dateien liest Sanad Wochen später wieder, ohne den Zusammenhang
  // im Kopf zu haben. Ohne Begründung und ohne Prüfabfrage traut man sich
  // nicht, sie auszuführen.
  const DATEIEN = [
    'meldungen-fk.sql', 'mindestalter-grenze.sql',
    'alter-grenze.sql', 'bewerbung-verifiziert.sql', 'konto-loeschen.sql',
  ]
  for (const datei of DATEIEN) {
    const sql = lies(datei)
    expect(sql.length, `${datei} ist verdächtig kurz`).toBeGreaterThan(500)
    expect(sql, `${datei}: keine Erklärung, warum`).toMatch(/BEFUND|WARUM|GRUND/i)
    expect(sql, `${datei}: keine Prüfabfrage`).toMatch(/select/i)
  }
})
