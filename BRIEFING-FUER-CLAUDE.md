# SchülerMatch – Briefing (Stand: 13. Juli 2026)

## Was ist das Projekt?
SchülerMatch (https://schuelermatch.de) ist eine kostenlose deutsche Plattform, die Schüler (ab 13, Klasse 5–13) mit Minijobs in ihrer Nähe verbindet. Firmen/Privatleute posten Jobs kostenlos; Schüler registrieren sich, bauen einen Lebenslauf und bewerben sich mit einem Klick. Betreiber: Sanad (Programmier-Anfänger, arbeitet mit Claude Code als Entwicklungsteam).

## Technik (bewusst einfach gehalten)
- **Reines HTML/CSS/JS** – kein Framework, kein Build-Tool. 13 HTML-Seiten, ~20 JS-Module (ES-Module via `<script type="module">`).
- **Supabase** (Projekt blufrvuskqiloslyxjkx): Postgres + Auth + Storage, Zugriff direkt aus dem Browser mit anon key. **Alle Tabellen haben RLS-Policies** (Sicherheit geprüft: Schüler sehen keine fremden Daten).
- **Vercel**: Auto-Deploy bei jedem Push auf `main` (GitHub). Domain schuelermatch.de + www verbunden (A @ → 216.198.79.1, CNAME www → bf647d4442e8521a.vercel-dns-017.com, DNS bei Namecheap).
- Tabellen: `profiles` (Schüler+Firmen, CV als jsonb `lebenslauf_bloecke`), `jobs`, `bewerbungen`, `gemerkte_jobs`, `nachrichten`, `bewertungen`.

## Aktueller Zustand
- **Live, aber privat**: Passwort-Gate auf allen Seiten (js/gate.js, Passwort `schuelermatch2026`, `GATE_AKTIV = true`). Zum Launch auf `false` setzen.
- **Feature-komplett für den Start**: Registrierung mit Elterneinwilligung (unter 16), Job-Börse mit Filtern (Ort, Lohn, Alter, Arbeitszeit, Kategorie, Umkreis-km, Synonym-Suche, teilbare Filter-URLs), Block-basierter Lebenslauf-Editor mit Vorlagen + PDF-Export (3 Layouts × 4 Farben), Bewerbungen mit Status-Timeline, Chat nach Zusage, Benachrichtigungs-Glocke, Firmen-Dashboard (Anzeigen-Vorlagen, Duplizieren, Bewerber-Ampel + Filter), Firmen-Bewertungen (nur angenommene Schüler), Verifizierung per Schülerausweis, Onboarding-Checkliste, Dark Mode, Gamification-Abzeichen, eigene Job-Seiten (job.html?id=) mit Google-Jobs-Markup (JSON-LD), sitemap.xml + robots.txt, 404-Seite, 11 Job-Kategorien.
- **Design**: eigenes Logo (Grün→Blau-Monogramm „SM" + Wortmarke), Farbwelt Grün (#00c896) / Indigo (#2b2f8f), Fonts Space Grotesk + Inter.

## Launch-Checkliste (wartet auf Startschuss)
1. Impressum/Datenschutz anwaltlich prüfen lassen (Minderjährige!)
2. `GATE_AKTIV = false` + push
3. Google Search Console einrichten + Sitemap einreichen (bewusst erst zum Launch)

## Offene Punkte (brauchen Freigabe/Entscheidung von Sanad)
- DB-Migration `profiles.cv_design` (damit Firmen PDF-Design des Schülers sehen)
- E-Mail-Benachrichtigungen (Supabase Edge Function)
- Website-Farben feiner ans Logo anpassen (will Sanad vorher sehen)
- Admin-Panel, Premium-Listings, Analytics (Roadmap Block 5)

## Arbeitsregeln (wichtig!)
- Beispiel-Jobs in der DB (Preise/Kategorien) NICHT ändern – die sind absichtlich so zum Testen.
- Antworten auf Deutsch, einfach erklärt (Anfänger-Niveau), keine unnötigen Fachbegriffe.
- Dokumentations-Datei im Repo: PROJEKT-STATUS.md (volles Protokoll aller Sessions).
