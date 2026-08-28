# SchülerMatch – Offene Punkte

> **Stand 26. August 2026.**
> Alles ist committet und gepusht, **765 E2E-Tests grün**, Live-Stand deployed.
> Vollständiger Verlauf: `PROJEKT-STATUS.md` (neueste Einträge oben in der Session-Liste).
>
> **Teststart:** `npm test` im Projektordner. Node liegt portable unter
> `AppData/Local/Programs/nodejs-portable` → PATH ergänzen.
> Läuft die Vorschau (`preview_start`), vor einem vollen Testlauf stoppen – beide teilen Port 5500.
>
> **Laufender Dauerauftrag:** Sanad hat per `/loop` erteilt, die Seite fortlaufend in allen
> Bereichen zu verbessern (60-Sekunden-Takt). Die Schleife wurde beim Sitzungswechsel gestoppt –
> zum Fortsetzen `/loop` mit demselben Text neu starten.
> Erledigt: Barrierefreiheit, Ladezeit/jsPDF, Schriftschnitte, Tastaturbedienung & Fokus-Sichtbarkeit,
> Fehler- und Leerzustände (dabei ein echter Bug gefunden: Weiterleitungsschleife bei Server-Störung).
> **Als Nächstes geplant: Formular-Fehlermeldungen** — versteht man beim Registrieren und Bewerben,
> was schiefging und was zu tun ist? Danach Bildgrößen gegen Layout-Sprünge.

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
