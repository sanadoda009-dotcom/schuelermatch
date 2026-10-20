# SchülerMatch – Offene Punkte

> **Stand 20. Oktober 2026.**
> Alles ist committet und gepusht, Live-Stand deployed.
> Wie viele Tests es gerade sind, sagt `npm test` — eine Zahl an dieser Stelle
> stimmt nach der nächsten Runde nicht mehr. Hier stand bis heute „795“ vom
> 26. August; es sind inzwischen gut tausend.
> Vollständiger Verlauf: `PROJEKT-STATUS.md` (neueste Einträge oben).
> Aktueller Stand der Zugriffsregeln: `SICHERHEIT-STAND.md`.
>
> **Teststart:** `npm test` im Projektordner. Node liegt portable unter
> `AppData/Local/Programs/nodejs-portable` → PATH ergänzen.
> Läuft die Vorschau (`preview_start`), vor einem vollen Testlauf stoppen – beide teilen Port 5500.
> Und **nie zwei Testläufe gleichzeitig**: Sie teilen sich denselben Server, und
> dann fallen Tests um, die einzeln grün sind.
>
> **Laufender Dauerauftrag:** Sanad hat per `/loop` erteilt, die Seite fortlaufend
> in allen Bereichen zu verbessern. Die Schleife endet mit der Sitzung – zum
> Fortsetzen `/loop` mit demselben Text neu starten. Was in den einzelnen Runden
> gefunden und behoben wurde, steht in `PROJEKT-STATUS.md`; jede Runde
> hinterlässt außerdem ihren Befund als Kommentar im jeweiligen Test.

## ✅ Am 20.10.2026 ausgerollt: die beiden E-Mail-Funktionen

`mail-ereignis` (jetzt Version 7) und `mail-digest` (Version 4) laufen auf
dem Stand des Repositorys – vorher waren sie vom 28.7. bzw. 20.7. Damit
sind live: Zusage-Knopf ohne Weiß-auf-Weiß, Verifizierungs-Mail ohne „alle
Jobs", Links direkt in Chat und Bewerbungen, Absage ohne erfundenen Grund,
maskierte Titel in der Tagesmail, Tagesmail auch ohne gespeicherte
Einstellung. Neu dazu: Ist die Anzeige gelöscht, nennt die Mail den
gespeicherten Titel (`job_titel`) statt „einen Job".

Nachgeprüft: Der ausgerollte Quelltext stimmt mit
`supabase/functions/…/index.ts` überein. `mail-job-alarm` und
`konto-loeschen` waren schon aktuell.

**Merksatz:** Edge Functions gehen nicht mit `git push` live. Nach jeder
Änderung in `supabase/functions/` einzeln ausrollen.

## ✅ Eingespielt am 20.10.2026: sechzehn SQL-Dateien

Sanad hat am 20.10. gesagt „mach alles selber". Jede Datei wurde **vorher
gegen die laufende Datenbank geprüft** (stimmen die Namen, die sie
ersetzt? gibt es Daten, an denen sie scheitert?) und **nachher abgefragt**,
nicht dem „success" geglaubt.

| Datei | Was jetzt gilt |
|---|---|
| `supabase/bewerbung-bleibt.sql` | Löscht eine Firma ihre Anzeige, bleiben Bewerbungen und Chats stehen (`job_id` → SET NULL, Titel als Kopie in `job_titel`) |
| `supabase/zeugnis-nur-eigene-anzeige.sql` | Firma A sieht nur Zeugnisse/Lebensläufe zu IHREN Anzeigen; Schüler darf sein Zeugnis löschen |
| `supabase/chat-erst-nach-zusage.sql` | Schreiben im Chat nur bei `status = 'angenommen'` – auch über die API |
| `supabase/firma-gesperrt-kein-kontakt.sql` | Gesperrte Firma: keine Nachrichten, keine Bewerbungen, keine fremden Profile, keine Zeugnisse |
| `supabase/bewerben-nur-alt-genug.sql` | Bewerben nur, wer das Mindestalter der Anzeige erreicht |
| `supabase/profil-email-festnageln.sql` | `profiles.email` ist eingefroren wie Rolle und Status |
| `supabase/bewerbung-grenzen.sql` | Eine Bewerbung je Anzeige, nur drei Stände, Längengrenzen für Freitext |
| `supabase/meldungen-bleiben.sql` | Meldungen überleben das Löschen von Anzeige oder Nachricht |
| `supabase/mindestalter-pflicht.sql` | Keine Anzeige ohne Mindestalter |
| `supabase/alter-pflicht.sql` | Kein Schülerkonto ohne Alter |
| `supabase/bewerbung-stand.sql` | `angesehen_am`, `entschieden_am`, `absage_grund` |
| `supabase/firma-oeffentlich.sql` | Sicht `firmen_oeffentlich` (sechs Spalten, keine E-Mail) |
| `supabase/ausweis-weg-bei-freigabe.sql` | Keine Freigabe, solange noch ein Ausweisdokument in der Ablage liegt |
| `supabase/bewerbung-titel-festnageln.sql` | **Am selben Tag nachgeschoben:** Die Firma konnte die Titel-Kopie (`job_titel`) umschreiben – der Schutz-Trigger war älter als die Spalte. Jetzt eingefroren, `angesehen_am` nur einmal setzbar. `tests/spalten-schutz.spec.js` verlangt künftig für jede neue Spalte eine Entscheidung. |
| `supabase/alter-nach-verifizierung-fest.sql` | **Ebenfalls nachgeschoben:** Ein verifizierter Schüler konnte sein Alter im Profil frei ändern – genau die Zahl, nach der die Datenbank das Bewerben erlaubt. Jetzt nach der Verifizierung eingefroren (Formular gesperrt, mit Hinweis); Dokumentpfade nur im eigenen Ordner. **Folge:** Nach einem Geburtstag trägt der Betreiber das neue Alter ein. Sauberer wäre ein Geburtsdatum statt eines Alters – größere Umstellung, nicht begonnen. |
| `supabase/firmenname-fest.sql` | **Ebenfalls nachgeschoben:** Eine freigegebene Firma konnte ihren geprüften Namen ändern, und auf eine Anzeige ließ sich über die API **jeder** Name schreiben (der Browser kopierte ihn nur). Jetzt: Name nach der Freigabe fest (Formular gesperrt, mit Hinweis), Anzeigen bekommen ihn immer aus dem Profil. Vier alte Test-Anzeigen ohne Namen bleiben unangetastet. |

### Zwei Fallen, die erst beim Einspielen auffielen

- **`ausweis-weg-bei-freigabe.sql` hätte jede Freigabe zerstört.** Supabase
  hat inzwischen den Trigger `protect_objects_delete` auf `storage.objects`
  – direktes Löschen per SQL wirft einen Fehler, auch wenn nichts zu
  löschen ist. Die erste Fassung löschte dort. **Umgebaut:** Sie lehnt eine
  Freigabe ab, solange noch ein Dokument daliegt; der Admin-Knopf löscht es
  vorher ohnehin über die Storage-Schnittstelle.
- **`meldungen-bleiben.sql` wäre an einer eigenen Regel gescheitert.**
  `meldung_ziel` verlangte bei jeder Meldung ein Ziel. Mit SET NULL wäre
  das Löschen einer gemeldeten Anzeige und jedes Konto-Löschen mit
  gemeldeter Nachricht abgebrochen. Die Regel erlaubt jetzt ein leeres
  Ziel (der Wortlaut steht in `zitat`).

Dazu nach der Supabase-Sicherheitsprüfung: `ist_alt_genug` antwortet nur
noch für das eigene Konto (sonst ließe sich mit fremder Id das Alter eines
Minderjährigen eingrenzen), die beiden neuen Trigger-Funktionen sind von
außen nicht aufrufbar. Die Meldung „Security Definer View" für
`firmen_oeffentlich` ist **Absicht** – genau so zeigt die Sicht nur sechs
Spalten, ohne `profiles` öffentlich zu machen.

**Noch offen bei dir:** In den Supabase-Einstellungen unter *Auth →
Passwörter* den Schutz gegen geleakte Passwörter einschalten (Prüfung
gegen HaveIBeenPwned). Ein Schalter, kein Code.

### 🔴 Zwei Ausweisdokumente liegen noch da — deine Entscheidung

Am 5.9.2026 in der Ablage `verifizierung` gefunden: **zwei Dateien, beide
bei bereits verifizierten Schülern**, hochgeladen am 1. und 5. Juli. Bei
beiden steht der Pfad noch im Profil.

Die Freischalt-Mail sagt diesen Schülern wörtlich: „Übrigens: Dein
hochgeladenes Dokument haben wir nach der Prüfung direkt wieder
gelöscht.“ Das stimmt bei ihnen nicht.

Der Betreiber-Bereich ist nicht schuld — der Knopf dort löscht die Datei
zuerst und bricht ab, wenn das misslingt. Aber die **Mail verschickt ein
Trigger**, kein Knopf: Wird `verifiziert` im SQL-Editor oder im
Supabase-Dashboard gesetzt, geht die Zusage trotzdem raus. Genau so sind
die beiden Fälle entstanden — der Admin-Knopf hätte die Pfade auf NULL
gesetzt, sie stehen aber noch da.

**Ich habe die Dateien nicht angefasst.** Es sind Ausweisdokumente von
Minderjährigen, das Löschen ist endgültig, und es ist deine Entscheidung.
Die Abfrage zum Ansehen steht in `supabase/ausweis-weg-bei-freigabe.sql`.
**Per SQL löschen geht seit dem Supabase-Update nicht mehr** – nur über
das Dashboard (*Storage → verifizierung*) oder im Betreiber-Bereich: Konto
zurückziehen und neu freischalten.

Der Betreiber-Bereich zeigt so einen Fall jetzt an — als eigene Zahl
(„Ausweis liegt noch da“) und mit einem Hinweis darunter.

### 📅 Zwei Angaben, die von selbst veralten

Beides kein Fehler heute — aber beides läuft ab, ohne dass jemand etwas
merkt. Deshalb hier notiert statt nur im Quelltext.

| Was | Stand | Läuft aus |
|---|---|---|
| **Mindestlohn** in `ferienjob.html` (13,90 €) | September 2026 | Bei der nächsten Anpassung. Die aktuelle Höhe steht beim [Bundesministerium für Arbeit](https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/mindestlohn.html). |
| **Ferientermine** in `js/ferien.js` (`STAND`) | August 2026 | Nach den Sommerferien 2027. Danach zeigt `ferienjob.html` ehrlich an, dass keine Termine hinterlegt sind — das ist getestet, aber die Seite ist dann eben leer. |

Die Zahl im Ratgeber trägt jetzt Datum und Quelle direkt daneben, und
`tests/zahlen-mit-stand.spec.js` verlangt beides für jeden Geldbetrag,
der als geltendes Recht dasteht — samt der Prüfung, dass alle Seiten
denselben Betrag nennen.

### ✅ Am 11.9. behoben: Anzeigen wären ab dem 30.9. aus Google gefallen

Ein dritter Fall derselben Art, nur mit einem Datum daran. `job.html`
meldete Google für jede Anzeige „gültig bis“ — gerechnet als
**Einstelltag + 90 Tage**. Danach fällt die Anzeige aus Google für Jobs
heraus; auf der Seite steht sie weiter und ist weiter bewerbbar. Nichts
wäre passiert, nichts geloggt worden.

In der Datenbank nachgesehen: fünf aktive Anzeigen, die älteste vom
2.7.2026. **Sie wäre am 30.9. die erste gewesen, der das still
passiert.**

Ein Enddatum, das eine Firma setzen könnte, gibt es in der Tabelle
`jobs` nicht — die einzige Wahrheit über eine Anzeige ist `aktiv`, und
die erfährt Google längst richtig: Eine zurückgezogene Anzeige liefert
„nicht verfügbar“ und gar keine strukturierten Daten mehr. Die Frist
läuft deshalb jetzt ab heute statt ab dem Einstelltag; die 30 Tage sind
nur noch das Netz für Seiten, die Google nicht mehr besucht.
`tests/google-jobs.spec.js` hält beides fest — auch den Wächter, dass
zwei Anzeigen ein halbes Jahr auseinander denselben Tag melden müssen.

### 📝 Zwei kleine Funde vom 11.9. – einer davon am 13.9. behoben

~~**`forgot-password.html` ist in `robots.txt` gesperrt, hat aber kein
`noindex`.**~~ **Am 13.9. behoben:** Die vier Seiten (beide Dashboards,
beide Passwort-Seiten) tragen jetzt `noindex` und stehen nicht mehr in
`robots.txt` – genau wie `admin.html`. `tests/statisch.spec.js` prüft
seitdem jede Seite: Sitemap, `noindex` oder bewusst dynamisch.

**Einzelne Anzeigen stehen in keiner Sitemap.** Google findet
`job.html?id=…` nur, indem es das JavaScript auf `jobs.html` ausführt.
Für Google für Jobs ist eine Sitemap ausdrücklich empfohlen. Das wäre
aber eine erzeugte Datei (eine Vercel-Funktion), kein Handgriff — und
`tests/job-titel-link.spec.js` verbietet aus gutem Grund einen Eintrag
`/job.html` **ohne** `?id=`, weil die Seite ohne Id leer ist. Wer das
angeht, muss diesen Test mitnehmen.

### Datenstand am 20.10.2026

| geprüft | gefunden |
|---|---|
| Aktive Anzeigen · Firmen · Schüler · Bewerbungen | 5 · 1 · 4 · 3 |
| Letzte Registrierung | 23.7.2026 |
| Doppelbewerbungen · Texte über der Grenze | 0 · 0 |
| Bewerbungen, für die der Schüler zu jung ist | 0 |
| Schüler ohne Alter · Anzeigen ohne Mindestalter | 0 · 0 |

**Seit Juli kommt niemand neu dazu – und das ist erwartbar:** Die Seite
steht noch hinter der Zugangssperre (`js/gate.js`, `GATE_AKTIV = true`,
„Diese Seite ist gerade im Aufbau"). Ohne Passwort sieht sie niemand,
auch Google nicht. Eine Sitemap für die einzelnen Anzeigen oder andere
Arbeit an der Auffindbarkeit lohnt sich deshalb erst, wenn die Sperre
fällt. (Am 20.10. zuerst falsch eingeschätzt als „Engpass ist das
Angebot" – nachgesehen statt geraten.)

### Richtigstellung: `bewerbung-inhalt-schuetzen.sql` brauchst du nicht

Am 2.9. habe ich gemeldet, eine Firma könne den Text einer fremden
Bewerbung ändern, weil die UPDATE-Regel keine Spalten einschränkt. Die
Regel tut das tatsächlich nicht — **aber ein Trigger fängt es längst ab.**
In der laufenden Datenbank steht:

```
trg_schuetze_bewerbung  BEFORE UPDATE ON bewerbungen
  -> schuetze_bewerbung_felder()
     new.motivationsschreiben := old.motivationsschreiben;
     new.zeugnis_url          := old.zeugnis_url;
     new.lebenslauf_url       := old.lebenslauf_url;
     ...
```

Der Versuch wird still auf den alten Wert zurückgesetzt. **Die Lücke gibt
es nicht.** Ich hatte damals nur die Regel gelesen, nicht die Trigger.

Die Datei bleibt liegen, sie schadet nicht — sie würde denselben Schutz
mit einer *lauten* Fehlermeldung statt stillem Zurücksetzen bewirken. Das
ist Geschmackssache, kein offener Punkt. Deshalb steht sie nicht mehr in
der Tabelle oben.

**Merksatz für mich:** Nach einer RLS-Regel immer auch die Trigger der
Tabelle lesen. `pg_policies` allein sagt nicht, was wirklich passiert.

## ⏳ Wartet auf dich: eine Regel in der Datenbank

**`supabase/mindestalter-pflicht.sql` im Supabase-SQL-Editor ausführen.**

`jobs.mindestalter` darf zurzeit leer sein. Die bestehende Regel
`mindestalter >= 13` fängt das nicht ab: In SQL ist `NULL >= 13` weder wahr
noch falsch, und eine CHECK-Regel gilt als erfüllt, solange sie nicht falsch
ist. Über die Schnittstelle lässt sich also eine Anzeige ganz ohne
Altersangabe anlegen.

Was das anrichtete, ist **im Code bereits behoben** (die Seiten schrieben
„ab null J.", und `null > alter` ist in JavaScript falsch — die Anzeige
rutschte durch jeden Altersfilter). Die SQL-Datei schließt die Lücke da, wo
sie herkommt.

Vorher prüfen — muss `0` sein:
```sql
select count(*) from public.jobs where mindestalter is null;
```
Stand 1.9.2026: 0 von 4 Zeilen. Ich habe die Änderung bewusst nicht selbst
eingespielt; Schemaänderungen an der Live-Datenbank machst du.

## ✅ Am 27.8. eingespielt: vier Regeln in der Datenbank

Alle vier sind **angewendet und nachgeprüft**. Was vorher nur im Browser galt,
gilt jetzt in der Datenbank.

| Regel | Was sie schließt | Nachgeprüft |
|---|---|---|
| `meldungen.melder_id` → SET NULL | Meldung verschwand mit dem Konto des Melders | `delete_rule = SET NULL`, Spalte nullbar |
| `jobs_mindestalter_jarbschg` | Anzeigen „ab 10 Jahren" waren möglich | `>= 13 and <= 20` |
| `chk_alter_jahre` | Registrierung nahm Zehnjährige an | `>= 13 and <= 20` |
| Regel „Schueler bewirbt sich" | Bewerben ohne Verifizierung per Schnittstelle | enthält `ist_verifiziert(auth.uid())` |

Vorher geprüft: alle vier Zählungen 0, keine Regel traf eine bestehende Zeile.

**Eine Falle ist dabei aufgefallen** und wäre um ein Haar unbemerkt geblieben:
Die alte Bewerbungs-Regel hieß schlicht **„Bewerben"**, nicht wie in meiner
SQL-Datei angenommen. Sie wurde also nicht ersetzt, sondern stand *daneben* —
und PostgreSQL verknüpft mehrere erlaubende Regeln mit **ODER**. Die
großzügigere gewinnt, die neue Prüfung war wirkungslos. Erst die
Kontrollabfrage *nach* dem Einspielen hat es gezeigt. Alte Regel entfernt, jetzt
steht dort genau eine.

Danach habe ich die **ganze Datenbank** auf dasselbe Muster abgesucht: Vier
Tabellen haben mehrere erlaubende Regeln, alle vier gewollt (Admin *oder*
Eigentümer *oder* Öffentlichkeit). Kein weiterer Altbestand.

### Noch offen: der Job-Alarm
`supabase/job-alarm.sql` ist **nicht** eingespielt. Die Tabelle allein nützt
nichts – dazu gehören die Edge Function `mail-job-alarm` (**beide** Dateien,
`index.ts` UND `treffer.js`) und der Cron `0 16 * * *`. Das Deployment der
Function kann ich nicht übernehmen, deshalb bleibt es bei dir.

### Die Gegenprobe zur Bewerbungs-Regel
Die Regel ist nachgeprüft, aber nicht *durchgespielt* – dafür bräuchte es ein
eingeloggtes, unverifiziertes Konto. Die Anleitung dazu steht am Ende von
`supabase/bewerbung-verifiziert.sql`. Testkonten danach mit
`supabase/konto-loeschen.sql` wieder entfernen.

### Dazu im Einzelnen: keine Anzeige unter 13

**`supabase/mindestalter-grenze.sql` im Supabase-SQL-Editor ausführen.**

Das Anzeigenformular bot als Mindestalter **10, 11 und 12** an, und geprüft wurde
der Wert an keiner Stelle. Eine freigegebene Firma konnte eine Anzeige „ab 10
Jahren" schalten – und sie ging **sofort live**, denn einzelne Anzeigen werden
nirgends geprüft (du gibst Firmen frei, nicht Anzeigen).

Nach § 5 Abs. 1 JArbSchG ist die Beschäftigung von Kindern verboten. Deine eigene
Seite `jugendarbeitsschutz.html` sagt es auch: *„Unter 13 Jahren: Arbeiten ist
grundsätzlich nicht erlaubt."* Nur das Formular wusste nichts davon.

Auswahlliste und Prüfung im Browser sind repariert. Verbindlich wird die Grenze
aber erst mit dieser Regel in der Datenbank – wer die Schnittstelle direkt
anspricht, umgeht alles andere. Niedrigstes Mindestalter aktuell: **15**, es ist
also nichts Rechtswidriges live und die Regel trifft keine bestehende Zeile.


### Dazu im Einzelnen: Meldungen überleben den Melder

**`supabase/meldungen-fk.sql` im Supabase-SQL-Editor ausführen.** Dauert eine Minute.

`meldungen.melder_id` zeigt mit **ON DELETE CASCADE** auf `profiles`. Im Klartext:
Wird ein Konto gelöscht, **verschwinden alle Meldungen, die diese Person gestellt hat**.

Ein Schüler meldet einen Erwachsenen wegen Belästigung im Chat. Danach löscht er aus
Scham sein Konto – oder die Eltern verlangen die Löschung. In dem Moment ist die
Meldung weg. Du verlierst genau den Vorgang, gegen den du ermitteln müsstest.

Bei der *gemeldeten* Person steht der Fremdschlüssel schon richtig auf `SET NULL` –
der Vorgang bleibt. Die Asymmetrie ist die Lücke.

Stand heute: `select count(*) from meldungen` = **0**. Es ist also noch nichts
verloren gegangen, und die Umstellung trifft keine einzige Zeile. Ich habe sie
**nicht selbst eingespielt** – Schema-Änderungen an der Produktionsdatenbank gibst du
einzeln frei.

Der Betreiber-Bereich ist schon darauf vorbereitet: Fehlt ein Konto, steht dort
„Konto gelöscht" statt eines leeren Feldes (5 neue Tests).

## 📋 Für die rechtliche Prüfung: Einwilligung ist jetzt nachweisbar

Bei der Registrierung wurde das Häkchen *„Ich habe die Erlaubnis meiner Eltern"*
abgefragt, geprüft – und dann **weggeworfen**. Es landete nirgends.

Art. 7 Abs. 1 DSGVO verlangt, dass du *nachweisen kannst*, dass eingewilligt
wurde. Genau danach wird die rechtliche Prüfung fragen.

Seit dem 26.8. wandert die Einwilligung samt Zeitpunkt in die Anmeldedaten
(`auth.users.raw_user_meta_data`) – dafür war **keine** Schema-Änderung nötig.
Die Abfrage zum Einsehen steht am Ende von `supabase/alter-grenze.sql`.

Für Konten, die vor dem 26.8. angelegt wurden, gibt es keinen Nachweis. Das sind
derzeit vier Testkonten, also unkritisch – erwähne es aber bei der rechtlichen
Prüfung.

## ✅ Am 27.8. repariert: der Foto-Upload ging nie

Von dir gemeldet („keine Berechtigung"). Ursache: `avatars` und
`lebenslauf-bilder` hatten nur INSERT- und UPDATE-Regeln, aber **keine
SELECT-Regel** – und die braucht Supabase Storage beim Hochladen. Deshalb war
kein einziges Foto je gespeichert worden.

Vier Regeln angelegt (SELECT + DELETE für beide Ablagen). DELETE fehlte auch:
Seit dem 26.8. räumt der Upload die Vorgängerdatei weg, das wäre still
fehlgeschlagen und hätte in einer öffentlichen Ablage das alte Foto liegen
lassen.

`tests/sql-konsistenz.spec.js` prüft das jetzt je Ablage mit.

## ⏰ Job-Alarm: nur noch der Zeitplan fehlt

Tabelle und Edge Function sind **eingespielt und geprüft** (27.8.). Ein Schüler
kann sich unter **Einstellungen** einen Job-Alarm einrichten – Ort, Umkreis,
Bereich, Wann, Mindestlohn.

Was fehlt: der **tägliche Zeitplan**, der die Funktion aufruft. Ohne ihn wird
nie eine Mail verschickt. Ich habe ihn nicht gesetzt – das ist der Schalter,
der automatisch E-Mails an Minderjährige auslöst, und den gibst du frei.

Empfehlung: `0 16 * * *` (18 Uhr deutscher Sommerzeit, nach Schulschluss).
Solange es keine Alarme gibt, passiert ohnehin nichts.

**Eine Notiz von mir, die sich beim Nachsehen als falsch erwies:** Ich hatte
angemerkt, dass Firmen einstellen können wie oft sie E-Mails bekommen und
Schüler nicht. Stimmt – ist aber richtig so. Schüler bekommen nur Mails über
*ihre eigenen* Vorgänge (Verifizierung durch, Zusage, Absage). Die abzuschalten
hieße, dass jemand nie erfährt, dass er den Job hat. Firmen brauchen die
Einstellung, weil sie **pro Bewerbung** eine Mail bekommen können. Und der
Job-Alarm – das einzig Wiederkehrende – hat seinen eigenen Schalter und einen
Abmelde-Link in jeder Mail.

## 📚 Drei Ratgeber-Themen, die noch fehlen

Beim Blick auf schuelerjobs.de (27.8.) aufgefallen. Sie haben neun Artikel,
uns fehlen drei davon – und alle drei treffen echte Bewerber:

- ~~**Gesundheitszeugnis**~~ ✅ **erledigt am 27.8.** — `gesundheitszeugnis.html`
- **Arbeitsvertrag**: was drinstehen muss, warum schriftlich, was man
  unterschreiben sollte und was nicht.
- **Bewerbungsfoto**: darf nicht verlangt werden, hilft aber – und ein
  schlechtes schadet mehr als keins.

## 💡 Anzeigen-Assistent für Arbeitgeber (Idee)

Beim Anzeigen-Schalten bekommt ein Arbeitgeber heute **ein leeres Textfeld**.
schuelerjobs.de gliedert die Anzeigen in „Was dich erwartet" und „Was du
mitbringen solltest" – dadurch sind sie vergleichbar.

Das Gegenstück zum Anschreiben-Coach: drei feste Fragen statt eines leeren
Kastens (*Was macht der Schüler bei dir? Was sollte er mitbringen? Was bietest
du?*), daraus entsteht die Beschreibung.

## 📢 Werbeplatz (besprochen am 27.8., später)

Sanad möchte einen Werbeplatz an der Seite, wie ihn schuelerjobs.de hat.
Technisch einfach – `jobs.html` hat schon eine Seitenspalte.

Zu bedenken: Ein Anzeigennetz bringt einen **Einwilligungs-Banner** mit (die
Seite setzt aktuell keine Tracking-Cookies und braucht keinen). Die Nutzer sind
**minderjährig**, das heisst nicht-personalisierte Anzeigen und entsprechend
wenig Ertrag. Und ohne Besucher gibt es nichts zu verdienen.

**Vorschlag:** Denselben Platz zuerst für die **eigenen Seiten** nutzen –
Lebenslauf-Editor, Ferienjob-Countdown, Job-Finder, Ratgeber. Die meisten
Schüler finden die nie. Kostet nichts, braucht keine Einwilligung, und der
Platz kann später etwas anderes tragen. Fürs Geldverdienen ist die
**Arbeitgeberseite** der Hebel, nicht die Schülerseite.

## 🖼 Zu überdenken: Fotos liegen in öffentlichen Ablagen

`avatars` und `lebenslauf-bilder` sind **öffentliche** Buckets – wer die Adresse
kennt, sieht das Foto eines Schülers ohne Anmeldung. Die Startseite verspricht
dagegen: *„Firmen sehen deinen Lebenslauf erst, nachdem du dich beworben hast."*
Für den Lebenslauf-**Text** stimmt das (die Zugriffsregel erzwingt es sauber),
für das **Bild** nicht.

Beide Ablagen sind **derzeit leer** – es ist also nichts offen, und es eilt
nicht. Auf Dauer gehört es umgestellt: private Ablage plus signierte Adressen,
so wie es bei `verifizierung` und `zeugnisse` schon läuft. Das ist ein größerer
Umbau (jede Stelle, die ein Bild anzeigt, muss die Adresse anfordern), deshalb
hier notiert statt nebenbei gemacht.

## ✅ Konto löschen: geht jetzt in der Anwendung selbst

Seit dem 27.8. kann ein Schüler sein Konto unter **Einstellungen** selbst
löschen. Die Edge Function `konto-loeschen` räumt alles ab: Dateien aus allen
vier Ablagen, das Profil (der Rest kaskadiert) und das Anmeldekonto.

`supabase/konto-loeschen.sql` bleibt trotzdem — für den Fall, dass du es von
Hand machen musst (z.B. wenn Eltern anrufen und das Kind sich nicht mehr
anmelden kann).

## 🗑 Konto löschen von Hand (die alte Anleitung)

Die Datenschutzerklärung verspricht: *„Wir löschen den Account dann zeitnah."*
In der Anwendung **gibt es keine Konto-Löschung** – das musst du von Hand tun.

**`supabase/konto-loeschen.sql`** ist die Anleitung dafür: E-Mail eintragen,
Nutzer-Id ersetzen, Schritt für Schritt. Mit Probelauf (`rollback`) vor dem Ernstfall.

Die Falle, die dort dokumentiert ist: In der Datenbank kaskadiert fast alles vom
Profil aus – **der Storage nicht**. Das Profilfoto liegt in `avatars`, einer
**öffentlichen** Ablage. Löschst du nur die Datenbankzeile, bleibt das Foto des
Kindes unter seiner Adresse für jeden abrufbar. Deshalb: **erst die Dateien, dann
die Datenbank**, und zum Schluss das Anmeldekonto unter Authentication > Users
(sonst legt der nächste Login ein neues Profil an).

Langfristig gehört eine Konto-Löschung in die Anwendung selbst.

## 🚀 Vor dem Launch (Pflicht)
1. **Rechtliche Prüfung** – der einzige echte Blocker:
   - Elterneinwilligung (Art. 8 DSGVO): reicht das Häkchen oder braucht es eine Eltern-Bestätigung per E-Mail? → Anwalt/eRecht24
   - Falls Betreiber unter 18: Eltern müssen als Verantwortliche ins Impressum
   - Impressum + Datenschutz einmal absegnen lassen (Texte sind fertig vorbereitet)
2. **Gate abschalten**: in `js/gate.js` → `GATE_AKTIV = false` setzen + pushen
3. **Google Search Console** einrichten + `sitemap.xml` einreichen (→ Jobs erscheinen in Google Jobs)
   — *Die strukturierten Daten dafuer wurden am 26.8. geprueft und repariert: `jobLocation` fiel ohne Ort still weg, `validThrough` fehlte ganz. `tests/google-jobs.spec.js` haelt jetzt alle fünf Pflichtangaben fest.*

## 🔜 Nächste Features (nach Priorität)
1. ~~**Melden-Funktion**~~ ✅ **ERLEDIGT am 22.8.** — Melde-Button im Job-Detail und an fremden Chat-Nachrichten, 5 Melde-Gründe + Freitext, neuer Admin-Reiter „Meldungen“ mit Filter und Status. 9 E2E-Tests.
2. ~~**Deutsche E-Mail-Vorlagen**~~ ✅ **ERLEDIGT am 28.7.** — alle 3 Auth-Mails (Bestätigung, Passwort-Reset, E-Mail-Änderung) sind auf Deutsch und im SchülerMatch-Design. In Supabase eingetragen und nach Neuladen verifiziert. Quelltexte: `supabase/mail-vorlagen-deutsch.md`.
3. **„Verifiziertes Unternehmen"-Abzeichen** (Stufe 2): optionaler Gewerbeschein-Upload für echte Firmen, Privatpersonen bleiben ohne
4. **Job-Alarm per E-Mail** — **MOTOR GEBAUT am 26.8., DREI SCHRITTE OFFEN.**
   Fertig: Tabelle+Regeln (`supabase/job-alarm.sql`), tägliche Funktion
   (`supabase/functions/mail-job-alarm/`), Abmelde-Seite (`job-alarm-aus.html`, 6 Tests).
   **Du musst:**
   1. `supabase/job-alarm.sql` im Supabase-SQL-Editor ausführen — die automatische
      Freigabe hat die Änderung blockiert. Die Datei enthält keine Schlüssel,
      Einfügen ist also unproblematisch.
   2. Edge Function `mail-job-alarm` deployen — **beide Dateien** aus dem Ordner:
      `index.ts` UND `treffer.js` (die Trefferlogik liegt seit 26.8. separat,
      damit sie getestet werden kann — ohne sie startet die Funktion nicht)
   3. Zeitplan setzen, z.B. Cron `0 16 * * *`
   Die **Oberfläche ist seit 26.8. auch fertig** (`js/job-alarm.js`, Karte unter der
   Jobliste, 9 Tests). Sie bleibt verborgen, solange die Tabelle fehlt — sobald du
   die drei Schritte gemacht hast, ist der Job-Alarm vollständig da.
5. ~~**Betreiber-Statistik im Admin**~~ ✅ **ERLEDIGT am 22.8.** — neuer Reiter „Statistik“: Nutzer- und Aktivitätszahlen, Quoten, offene Aufgaben und ein 8-Wochen-Verlauf mit Balken. 5 E2E-Tests.
6. ~~**Sicherheits-Hinweise im Chat**~~ ✅ **ERLEDIGT am 22.8.** — aufklappbare Regel-Leiste in jedem Chat + automatische Warnung bei Nachrichten mit Handynummer/Messenger, Vorkasse oder Einladung zum Alleintreffen. 6 E2E-Tests.

## ✅ Neu erledigt (23. Juli)
- **Playwright-E2E-Test-Suite**: **60 Tests, alle grün**. `npm test` im Projektordner. Supabase komplett gemockt (keine echten Accounts/Mails/DB). Deckt jetzt auch die **eingeloggten Dashboards** ab (Schüler + Firma, inkl. Bewerbungs-Flow und Job-Posten – landet in einer Fake-DB). Noch offen: Chat, Admin-Panel, echte Uploads.

## 🔔 Monitoring (eingebaut, teils noch zu aktivieren)
- **Uptime-Monitor**: LÄUFT automatisch über GitHub Actions (`.github/workflows/uptime.yml`) – prüft schuelermatch.de alle 10 Min, mailt dir bei Ausfall. Kein Fremdanbieter. Nur sicherstellen: GitHub-Benachrichtigungen für fehlgeschlagene Actions an (Settings → Notifications). Manuell testen: Repo → Actions → „Uptime-Check" → „Run workflow".
- **Sentry (Fehler-Tracking)**: EINGEBAUT auf allen 15 Seiten (`js/monitoring.js`), aber INAKTIV bis du deinen DSN einträgst:
  1. Kostenloses Konto auf sentry.io → neues Projekt „Browser/JavaScript" → **EU-Region wählen** (DSGVO!)
  2. DSN kopieren, in `js/monitoring.js` bei `SENTRY_DSN = ''` einfügen, pushen
  3. **Vor echtem Launch**: Sentry als Auftragsverarbeiter in die Datenschutzerklärung aufnehmen (neuer Empfänger, wie Resend/Open-Meteo). — *Seit 26.8. abgesichert: `tests/speicher.spec.js` fällt um, sobald der DSN gesetzt ist und Sentry nicht in der Erklärung steht.*

## 🛡️ Security-Audit (umgesetzt am 26. Juli) — 3 Rest-Punkte für DICH
Ein umfassender Audit wurde durchgeführt; 8 von 11 Befunden sind bereits gefixt (Details in PROJEKT-STATUS.md). **Diese 3 kann nur der Eigentümer im Dashboard erledigen:**
1. ~~**Leaked-Password-Schutz an** (#7)~~ — TEILS ERLEDIGT: Mindest-Passwortlänge am 28.7. von 6 auf **10** erhöht ✓. Der „Prevent use of leaked passwords"-Schalter (HaveIBeenPwned) ist **nur im Pro-Plan** verfügbar → auf Free nicht aktivierbar, Advisor-Warnung bleibt bestehen (kein echtes Loch).
2. **MFA** (#9) — WICHTIGSTER TEIL ERLEDIGT: **2FA auf dem GitHub-Konto** (`sanadoda009-dotcom`) am 28.7. per Authenticator-App aktiviert ✓. Das schützt den Generalschlüssel, denn der Supabase-Dashboard-Login läuft über „Continue with GitHub" → Zugriff auf DB + alle Schülerdaten.
   - ⚠️ Recovery-Codes sicher aufbewahren! Nachträglich unter github.com/settings/auth/recovery-codes
   - NOCH OFFEN: MFA **innerhalb der App** für Admins (admin.html). Braucht Frontend-Ausbau (Einrichtungs-/Abfrage-Bildschirme + Supabase-TOTP-Anbindung) — eigenes kleines Projekt, kein Dashboard-Schalter.
3. **Gate vor Launch entfernen** (#11): `js/gate.js` → `GATE_AKTIV=false` (ist bewusst client-seitig, nur Bauphasen-Schild).

## 🗓 Wiedervorlage: Ferientermine
Der Ferienkalender auf `ferienjob.html` steht fest in `js/ferien.js`.
Hinterlegt sind Herbst 2026 bis **Sommer 2027**. Sobald die Sommerferien 2027
vorbei sind, zeigt die Seite fuer jedes Land "Keine Termine hinterlegt" -
dann die naechsten Zeitraeume aus dem KMK-Ferienkalender ergaenzen
(https://www.kmk.org/service/ferien.html). Der Test `tests/ferienjob.spec.js`
prueft die Plausibilitaet der Tabelle mit.

## 🔒 Zugriffsregeln der Datenbank
Seit 26.8. im Repo gesichert:
- `supabase/rls-stand.sql` – alle 42 Policies, Zeilenschutz, Hilfsfunktionen,
  Eimer-Einstellungen. Wiederholbar ausführbar; am Ende stehen die Abfragen zum
  Vergleichen mit dem Live-Stand.
- `supabase/schutz-trigger.sql` – die Spalten-Trigger für profiles,
  bewerbungen, nachrichten, bewertungen, meldungen.
- `supabase/schutz-trigger-jobs.sql` – der am 26.8. nachgezogene Trigger für
  `jobs` (war beim Audit vom 26.7. übersehen worden). **Angewendet und geprüft.**

Die drei gehören zusammen. Wer `rls-stand.sql` ohne die Trigger einspielt,
reißt die Lücke wieder auf, die der Trigger schließt.

**`rls-stand.sql` war am 27.8. eine Falle** – sie erklärte weiter die alte,
großzügige Bewerbungs-Regel. Wer sie eingespielt hätte, um „den Stand
wiederherzustellen", hätte die gerade geschlossene Lücke wieder aufgerissen.
Nachgezogen. `tests/sql-konsistenz.spec.js` hält es jetzt fest: Eine
Sicherungsdatei, die eine Sicherheitsentscheidung zurücknimmt, ist schlimmer als
keine.

**`supabase/` steht jetzt in `.vercelignore`** – die Dateien waren vorher
unter schuelermatch.de/supabase/... öffentlich abrufbar.

## 📌 Gut zu wissen
- Admin-Bereich: `schuelermatch.de/admin.html` (Konten: s.weisioda@ + halawaisi3@)
- Gate-Passwort: `schuelermatch2026`
- Neue Firmen müssen im Admin freigegeben werden, bevor ihre Jobs sichtbar sind
- Verifizierungs-Dokumente werden nach der Prüfung automatisch gelöscht
  *(am 26.8. repariert: der Speicherort hing an der Dateiendung, dadurch konnten
  bis zu 6 unerreichbare Ausweisdateien pro Schüler zurückbleiben – siehe
  `js/dokument-pfad.js`)*
- Details zu allem: PROJEKT-STATUS.md
