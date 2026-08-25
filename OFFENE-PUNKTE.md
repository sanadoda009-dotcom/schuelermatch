# SchülerMatch – Offene Punkte

> **Stand 26. August 2026.**
> Alles ist committet und gepusht, **390 E2E-Tests grün**, Live-Stand deployed.
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

## 🚀 Vor dem Launch (Pflicht)
1. **Rechtliche Prüfung** – der einzige echte Blocker:
   - Elterneinwilligung (Art. 8 DSGVO): reicht das Häkchen oder braucht es eine Eltern-Bestätigung per E-Mail? → Anwalt/eRecht24
   - Falls Betreiber unter 18: Eltern müssen als Verantwortliche ins Impressum
   - Impressum + Datenschutz einmal absegnen lassen (Texte sind fertig vorbereitet)
2. **Gate abschalten**: in `js/gate.js` → `GATE_AKTIV = false` setzen + pushen
3. **Google Search Console** einrichten + `sitemap.xml` einreichen (→ Jobs erscheinen in Google Jobs)

## 🔜 Nächste Features (nach Priorität)
1. ~~**Melden-Funktion**~~ ✅ **ERLEDIGT am 22.8.** — Melde-Button im Job-Detail und an fremden Chat-Nachrichten, 5 Melde-Gründe + Freitext, neuer Admin-Reiter „Meldungen“ mit Filter und Status. 9 E2E-Tests.
2. ~~**Deutsche E-Mail-Vorlagen**~~ ✅ **ERLEDIGT am 28.7.** — alle 3 Auth-Mails (Bestätigung, Passwort-Reset, E-Mail-Änderung) sind auf Deutsch und im SchülerMatch-Design. In Supabase eingetragen und nach Neuladen verifiziert. Quelltexte: `supabase/mail-vorlagen-deutsch.md`.
3. **„Verifiziertes Unternehmen"-Abzeichen** (Stufe 2): optionaler Gewerbeschein-Upload für echte Firmen, Privatpersonen bleiben ohne
4. **Job-Alarm per E-Mail**: „Neuer Job in deiner Nähe" (stärkster Wachstums-Hebel)
5. ~~**Betreiber-Statistik im Admin**~~ ✅ **ERLEDIGT am 22.8.** — neuer Reiter „Statistik“: Nutzer- und Aktivitätszahlen, Quoten, offene Aufgaben und ein 8-Wochen-Verlauf mit Balken. 5 E2E-Tests.
6. ~~**Sicherheits-Hinweise im Chat**~~ ✅ **ERLEDIGT am 22.8.** — aufklappbare Regel-Leiste in jedem Chat + automatische Warnung bei Nachrichten mit Handynummer/Messenger, Vorkasse oder Einladung zum Alleintreffen. 6 E2E-Tests.

## ✅ Neu erledigt (23. Juli)
- **Playwright-E2E-Test-Suite**: **60 Tests, alle grün**. `npm test` im Projektordner. Supabase komplett gemockt (keine echten Accounts/Mails/DB). Deckt jetzt auch die **eingeloggten Dashboards** ab (Schüler + Firma, inkl. Bewerbungs-Flow und Job-Posten – landet in einer Fake-DB). Noch offen: Chat, Admin-Panel, echte Uploads.

## 🔔 Monitoring (eingebaut, teils noch zu aktivieren)
- **Uptime-Monitor**: LÄUFT automatisch über GitHub Actions (`.github/workflows/uptime.yml`) – prüft schuelermatch.de alle 10 Min, mailt dir bei Ausfall. Kein Fremdanbieter. Nur sicherstellen: GitHub-Benachrichtigungen für fehlgeschlagene Actions an (Settings → Notifications). Manuell testen: Repo → Actions → „Uptime-Check" → „Run workflow".
- **Sentry (Fehler-Tracking)**: EINGEBAUT auf allen 15 Seiten (`js/monitoring.js`), aber INAKTIV bis du deinen DSN einträgst:
  1. Kostenloses Konto auf sentry.io → neues Projekt „Browser/JavaScript" → **EU-Region wählen** (DSGVO!)
  2. DSN kopieren, in `js/monitoring.js` bei `SENTRY_DSN = ''` einfügen, pushen
  3. **Vor echtem Launch**: Sentry als Auftragsverarbeiter in die Datenschutzerklärung aufnehmen (neuer Empfänger, wie Resend/Open-Meteo)

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

## 📌 Gut zu wissen
- Admin-Bereich: `schuelermatch.de/admin.html` (Konten: s.weisioda@ + halawaisi3@)
- Gate-Passwort: `schuelermatch2026`
- Neue Firmen müssen im Admin freigegeben werden, bevor ihre Jobs sichtbar sind
- Verifizierungs-Dokumente werden nach der Prüfung automatisch gelöscht
- Details zu allem: PROJEKT-STATUS.md
