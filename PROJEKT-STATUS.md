# SchülerMatch – Projektstatus

## Was es ist
Kostenlose Matching-Plattform für Minijobs: Schüler (5.–13. Klasse, ~10–20 Jahre) bewerben sich bei lokalen Firmen. Firmen posten Jobs kostenlos.

## Tech-Stack
- Reines HTML/CSS/JS, **kein** Build-Tool, kein Framework (bewusst, da Anfänger-Projekt)
- **Supabase**: Datenbank (Postgres) + Auth + Storage
- **Vercel**: Hosting, automatisches Deployment bei jedem `git push` auf `main`
- **GitHub**: github.com/sanadoda009-dotcom/schuelermatch
- Lokaler Projektordner: `C:\Users\sanad\OneDrive\Desktop\schuelermatch`
- Domain `schuelermatch.de` ist **noch nicht gekauft** (PayPal-Problem sollte inzwischen gelöst sein)

## Seitenstruktur
- `index.html` – Landingpage (Hero, Beispiel-Jobs, So funktioniert's, FAQ, Schüler/Firmen-Kacheln, Abschluss-CTA)
- `jobs.html` – öffentliche Jobbörse mit Filter (Suche, Ort, Alter, Gehalt)
- `login.html`, `register.html`, `forgot-password.html`, `reset-password.html`
- `dashboard-schueler.html` – Sidebar-Navigation: Jobs / Lebenslauf / Verifizierung / Profil
- `dashboard-firma.html` – Sidebar-Navigation: Jobs verwalten / Firmenprofil
- `impressum.html`, `datenschutz.html`

## Datenbank (Supabase Postgres)
**Tabellen:**
- `profiles` (id, role, name, email, ort, alter_jahre, schule, klasse, foto_url, `lebenslauf_bloecke` jsonb, verifiziert bool, schuelerausweis_url, schulbestaetigung_url) — einige alte ungenutzte Spalten (erfahrung, ueber_mich, faehigkeiten, motivationsschreiben, zeugnis_url) sind noch da, werden aber nicht mehr verwendet (durch `lebenslauf_bloecke` + Bewerbungs-Felder ersetzt)
- `jobs` (titel, beschreibung, ort, stundenlohn, mindestalter, verfuegbarkeit, aktiv, firma_id)
- `bewerbungen` (job_id, schueler_id, status, **motivationsschreiben**, **zeugnis_url** — pro Bewerbung, nicht pro Profil!)

**Storage-Buckets:**
- `avatars` (public) – Profilbilder
- `lebenslauf-bilder` (public) – Bild-Bausteine im Lebenslauf
- `zeugnisse` (privat) – Zeugnisse, Firma sieht nur bei eigenen Bewerbern
- `verifizierung` (privat) – Schülerausweis/Schulbestätigung, nur Besitzer sieht es

## Funktionsumfang (fertig gebaut)
1. Registrierung/Login, Rollen Schüler/Firma, Elterneinwilligung Pflicht unter 16
2. Jobs posten/bearbeiten/löschen, Filter nach Suche/Ort/Alter/Gehalt
3. **Flexibler Baustein-Lebenslauf**: Foto, Schule/Klasse, frei hinzufügbare Abschnitte (Text/Fähigkeiten/Sprachen/Interessen/Bild), Live-Vorschau, Fortschritts-Checkliste, PDF-Export
4. **Bewerbungs-Popup**: Motivationsschreiben + optionales Zeugnis pro Bewerbung
5. **Schüler-Verifizierung**: Upload Schülerausweis ODER Schulbestätigung → **manuelle Freischaltung nötig** (siehe unten)
6. Firma sieht Bewerber nur als kompakte Karte + muss Lebenslauf als PDF herunterladen (kein Inline-Anzeigen mehr)
7. Sidebar-Navigation (Hamburger-Menü) in beiden Dashboards
8. Design: Scroll-Reveal-Animationen, Skeleton-Loader, Favicon, konsistente Typografie
9. Impressum & Datenschutzerklärung (Sanad Weisi Oda, Weitlstraße 141, 80995 München) — **KI-generiert, noch nicht anwaltlich geprüft**

## Wie man Schüler manuell verifiziert
1. Supabase → **Storage → verifizierung** → Dokument im User-Ordner anschauen
2. Supabase → **Table Editor → profiles** → richtige Zeile finden → Spalte `verifiziert` auf `true` setzen

## Bekannte offene Punkte
- Domain noch nicht gekauft
- Rechtstexte brauchen echte anwaltliche Prüfung vor Live-Gang mit echten Minderjährigen
- Verifizierung ist rein manuell (kein Auto-Check) — bewusste Entscheidung wegen Kosten/Sicherheit
- Vercel "Require Log In" (Deployment Protection) ist aktuell **ausgeschaltet** zum einfacheren Testen — vor echtem Launch wieder überdenken
- Alte ungenutzte Profil-Spalten könnten aufgeräumt werden (nicht dringend)
- Zwei doppelte Test-Profile "Sanad" in der DB von früherem Testen
- Footer-Link "Jugendarbeitsschutz" auf der Startseite zeigt noch auf "#" (nie gebaut)
- Kein automatisiertes Testing

## Zuletzt behobene Bugs
- Bewerber-Kontakt nicht sichtbar für Firma (RLS-Policy gefehlt)
- Alter/Ort wurden bei Registrierung nicht gespeichert
- PDF-Export leer (Positionierungs-Problem mit html2canvas)
- PDF-Export bei Firma-Ansicht leer (Feldname-Mismatch `lebenslauf_bloecke` vs `bloecke`)
- Storage-Bucket-Policy erlaubte Auflisten aller Dateien (Sicherheitslücke, behoben)

## Update (2. Juli 2026, autonomer Arbeitsblock)
Neu dazugekommen — Claude hat jetzt direkten MCP-Zugriff auf Supabase (SQL/Migrationen selbst ausführbar) und Vercel (Deployments prüfbar):
- **Job-Kategorien**: 8 Kategorien (Verkauf, Nachhilfe, Gastronomie, Lieferung & Kurier, Babysitten, Haushalt & Garten, Büro & Organisation, Sonstiges). Firma wählt beim Posten, Chip auf Job-Karten, Filter auf jobs.html + Schüler-Dashboard.
- **Sortierung**: Neueste / Höchster Lohn / Niedrigstes Mindestalter.
- **Merkliste**: Herz-Button auf Job-Karten im Schüler-Dashboard, "♡ Gemerkte"-Toggle im Filter. Tabelle `gemerkte_jobs` mit RLS.
- **Bewerbungs-Status**: Firma kann Bewerbungen annehmen/ablehnen (Buttons + Badge), Schüler sieht Status direkt auf der Job-Karte ("Beworben – Antwort ausstehend" / "🎉 Angenommen" / "Leider abgelehnt"). UPDATE-Policy für Firmen auf `bewerbungen`.
- **SEO**: Meta-Description + OpenGraph-Tags auf index.html und jobs.html.
- **Sicherheit**: `handle_new_user` gehärtet (fester search_path, EXECUTE für anon/authenticated/public entzogen). Supabase-Advisor ist sauber bis auf "Leaked Password Protection" (nur im Pro-Plan verfügbar).

## Ideen für später (noch nicht gebaut)
- Job aktiv/inaktiv statt nur löschen
- Job-Detailseite/-Modal mit vollständiger Beschreibung
- Firmen-Logo-Upload (statt Anfangsbuchstabe)
- Automatisierte/schnellere Verifizierung (würde bezahlte KI-API + eigene Backend-Funktion brauchen)
- E-Mail-Benachrichtigung an Schüler bei Statusänderung der Bewerbung
