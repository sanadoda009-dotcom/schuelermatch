# SchülerMatch – Offene Punkte (Stand: 23. Juli 2026)

## 🚀 Vor dem Launch (Pflicht)
1. **Rechtliche Prüfung** – der einzige echte Blocker:
   - Elterneinwilligung (Art. 8 DSGVO): reicht das Häkchen oder braucht es eine Eltern-Bestätigung per E-Mail? → Anwalt/eRecht24
   - Falls Betreiber unter 18: Eltern müssen als Verantwortliche ins Impressum
   - Impressum + Datenschutz einmal absegnen lassen (Texte sind fertig vorbereitet)
2. **Gate abschalten**: in `js/gate.js` → `GATE_AKTIV = false` setzen + pushen
3. **Google Search Console** einrichten + `sitemap.xml` einreichen (→ Jobs erscheinen in Google Jobs)

## 🔜 Nächste Features (nach Priorität)
1. **Melden-Funktion**: Schüler meldet fragwürdigen Job oder Chat-Nachricht → landet im Admin-Bereich
2. **Deutsche E-Mail-Vorlagen** für Supabase-Mails (Bestätigung/Passwort sind noch englisch):
   Supabase → Authentication → Emails → Templates (Claude schreibt die Texte vor)
3. **„Verifiziertes Unternehmen"-Abzeichen** (Stufe 2): optionaler Gewerbeschein-Upload für echte Firmen, Privatpersonen bleiben ohne
4. **Job-Alarm per E-Mail**: „Neuer Job in deiner Nähe" (stärkster Wachstums-Hebel)
5. **Betreiber-Statistik im Admin**: Anmeldungen/Jobs/Bewerbungen pro Woche
6. **Sicherheits-Hinweise im Chat** („Triff dich nie allein…")

## ✅ Neu erledigt (23. Juli)
- **Playwright-E2E-Test-Suite**: **60 Tests, alle grün**. `npm test` im Projektordner. Supabase komplett gemockt (keine echten Accounts/Mails/DB). Deckt jetzt auch die **eingeloggten Dashboards** ab (Schüler + Firma, inkl. Bewerbungs-Flow und Job-Posten – landet in einer Fake-DB). Noch offen: Chat, Admin-Panel, echte Uploads.

## 🔔 Monitoring (eingebaut, teils noch zu aktivieren)
- **Uptime-Monitor**: LÄUFT automatisch über GitHub Actions (`.github/workflows/uptime.yml`) – prüft schuelermatch.de alle 10 Min, mailt dir bei Ausfall. Kein Fremdanbieter. Nur sicherstellen: GitHub-Benachrichtigungen für fehlgeschlagene Actions an (Settings → Notifications). Manuell testen: Repo → Actions → „Uptime-Check" → „Run workflow".
- **Sentry (Fehler-Tracking)**: EINGEBAUT auf allen 15 Seiten (`js/monitoring.js`), aber INAKTIV bis du deinen DSN einträgst:
  1. Kostenloses Konto auf sentry.io → neues Projekt „Browser/JavaScript" → **EU-Region wählen** (DSGVO!)
  2. DSN kopieren, in `js/monitoring.js` bei `SENTRY_DSN = ''` einfügen, pushen
  3. **Vor echtem Launch**: Sentry als Auftragsverarbeiter in die Datenschutzerklärung aufnehmen (neuer Empfänger, wie Resend/Open-Meteo)

## 📌 Gut zu wissen
- Admin-Bereich: `schuelermatch.de/admin.html` (Konten: s.weisioda@ + halawaisi3@)
- Gate-Passwort: `schuelermatch2026`
- Neue Firmen müssen im Admin freigegeben werden, bevor ihre Jobs sichtbar sind
- Verifizierungs-Dokumente werden nach der Prüfung automatisch gelöscht
- Details zu allem: PROJEKT-STATUS.md
