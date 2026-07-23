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

## 📌 Gut zu wissen
- Admin-Bereich: `schuelermatch.de/admin.html` (Konten: s.weisioda@ + halawaisi3@)
- Gate-Passwort: `schuelermatch2026`
- Neue Firmen müssen im Admin freigegeben werden, bevor ihre Jobs sichtbar sind
- Verifizierungs-Dokumente werden nach der Prüfung automatisch gelöscht
- Details zu allem: PROJEKT-STATUS.md
