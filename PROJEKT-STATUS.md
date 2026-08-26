# SchülerMatch – Projektstatus

## Was es ist
Kostenlose Matching-Plattform für Minijobs: Schüler (5.–13. Klasse, ~10–20 Jahre) bewerben sich bei lokalen Firmen. Firmen posten Jobs kostenlos.

## Tech-Stack
- Reines HTML/CSS/JS, **kein** Build-Tool, kein Framework (bewusst, da Anfänger-Projekt)
- **Supabase**: Datenbank (Postgres) + Auth + Storage
- **Vercel**: Hosting, automatisches Deployment bei jedem `git push` auf `main`
- **GitHub**: github.com/sanadoda009-dotcom/schuelermatch
- Lokaler Projektordner: `C:\Users\sanad\OneDrive\Desktop\schuelermatch`
- **Domain `schuelermatch.de` ist GEKAUFT & LIVE** (bei Namecheap, mit Vercel verbunden, HTTPS aktiv). DNS: A `@`→`216.198.79.1`, CNAME `www`→`bf647d4442e8521a.vercel-dns-017.com`. Supabase Auth Site-URL + Redirect (`https://schuelermatch.de/**`) sind gesetzt.
- **Zugangssperre AKTIV**: `js/gate.js` blendet auf ALLEN Seiten ein Passwort-Overlay ein (Passwort `schuelermatch2026`, in gate.js Zeile 7 änderbar). Zum Live-Schalten für alle: in `js/gate.js` `GATE_AKTIV = false` setzen. Kein echter Schutz (Code öffentlich), nur "Zutritt verboten"-Schild während der Bauphase.
- Lokaler Vorschau-Server konfiguriert: `.claude/launch.json` (Python `http.server` Port 5500). Preview-Screenshots hängen bei diesem Setup – stattdessen `preview_eval` zum Prüfen nutzen. Browser cached lokal stark → Strg+Shift+R nötig.

## Teilen-Vorschaubild neu erzeugen
Quelle: `assets/og-vorlage.html` (nicht mitdeployed, steht in .vercelignore).
Ziel: `assets/og-bild.jpg`, 1200x630.

Eine Wegwerf-Spec unter `tests/_og.spec.js` anlegen:

```js
const { test } = require('@playwright/test')
test('Bild', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 630 })
  await page.goto('/assets/og-vorlage.html')
  await page.evaluate(() => document.fonts.ready)   // sonst Ersatzschrift
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'assets/og-bild.jpg', type: 'jpeg', quality: 92,
    clip: { x: 0, y: 0, width: 1200, height: 630 } })
})
```

Dann `npx playwright test _og --project=chromium`, danach die Spec loeschen.
JPEG, nicht PNG: Als PNG wiegt die Karte 374 KB, WhatsApp zeigt darueber
keine Vorschau mehr. `tests/teilen-vorschau.spec.js` prueft Masse und Groesse.

## Seitenstruktur
- `index.html` – Landingpage (Hero, Beispiel-Jobs, So funktioniert's, FAQ, Schüler/Firmen-Kacheln, Abschluss-CTA)
- `jobs.html` – öffentliche Jobbörse mit Filter (Suche, Ort, Alter, Gehalt)
- `login.html`, `register.html`, `forgot-password.html`, `reset-password.html`
- `dashboard-schueler.html` – Sidebar-Navigation: Jobs / Lebenslauf / Verifizierung / Profil
- `dashboard-firma.html` – Sidebar-Navigation: Jobs verwalten / Firmenprofil
- `taschengeld.html` - Taschengeldtabelle nach DJI-Empfehlung, Seite fuer Eltern
- `ferienjob.html` - Ferienjob-Ratgeber mit Ferienkalender (16 Bundeslaender, Countdown bis zu den naechsten Ferien)
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

## Update Block 2 (2. Juli 2026)
- **Job-Detail-Modal** auf jobs.html: Klick auf Karte öffnet Popup mit voller Beschreibung + Registrieren-CTA (auch per Tastatur/Enter erreichbar).
- **Job pausieren/aktivieren**: Firma kann Jobs offline nehmen ohne zu löschen (Badge "⏸ Pausiert", Karte ausgegraut). Pausierte Jobs verschwinden automatisch aus allen öffentlichen Listen (aktiv=true-Filter existierte schon).
- **Ergebnis-Zähler** ("X Jobs gefunden") auf jobs.html und im Schüler-Dashboard.
- **Jugendarbeitsschutz-Seite** (jugendarbeitsschutz.html): JArbSchG einfach erklärt nach Altersgruppen, im Footer verlinkt (Link zeigte vorher ins Leere).
- **Sticky Navigation** mit Blur-Effekt auf allen Seiten.
- **Mobile**: Filterleiste stapelt sich auf schmalen Screens sauber untereinander.
- Kategorie-Chip jetzt auch auf Firma-Jobkarten.

**Hinweis**: Firmenname/Logo auf öffentlichen Job-Karten wurde NICHT umgesetzt — die dafür nötige Änderung (Firmenprofile öffentlich lesbar ODER Firmenname am Job speichern) wurde vom Nutzer/Sicherheitssystem abgelehnt. Falls gewünscht, braucht es eine explizite Entscheidung: Variante A (RLS-Policy: Firmenprofile lesbar) oder Variante B (firma_name-Spalte an jobs, beim Posten befüllt).

## Update Block 3 (2. Juli 2026)
- **Job-Detail-Modal auch im Schüler-Dashboard**: Klick auf Karte (nicht auf Buttons) öffnet Details; Bewerben-Button im Modal führt direkt zum Bewerbungsformular bzw. zeigt den Status, falls schon beworben.
- **Passwort anzeigen/verbergen**-Toggle auf Login- und Registrierungs-Seite.
- **Kategorie-Chips** jetzt auch auf den Vorschau-Karten der Startseite.

## Update "Ultimate-Block" (2. Juli 2026, mit ui-ux-pro-max-Skill)
Skill installiert unter C:\Users\sanad\.claude\skills\ (7 Skills). Skill-DB-Empfehlung für Job-Boards (Flat+Minimalismus, Trust-Farben) bestätigt bestehende Marke.
- **Mobbin-Paket**: große Hero-Suche (Startseite → jobs.html?q=), Kategorie-Pills auf jobs.html (ersetzen Dropdown), 8 klickbare Kategorie-Kacheln auf Startseite, Deep-Links (?q=, ?kategorie=, ?job=)
- **CV-Builder Ultimate**: 3 Ein-Klick-Vorlagen (Erster Job / Nachhilfe-Profi / Praktisch), 💡-Formulierungshilfe pro Textblock, Fortschrittsbalken mit Prozent
- **Suche intelligent**: matcht jetzt Titel+Beschreibung+Kategorie+Ort (jobs.html & Dashboard)
- **NEU-Badge** auf Jobs < 72h, **"Link kopieren"**-Button im Job-Detail (teilbare ?job=-Links)
- **Passwort-Stärke-Meter** bei Registrierung + minlength=8
- **Premium-Politur**: Gradient auf Grün-CTAs mit Inner-Highlight, neue Komponenten-Styles
- PDF-Export auf jsPDF-Direktschreibung umgestellt (Test durch Nutzer noch offen, v2.1-Badge zeigt Codeversion)

## Update "Sidebar & Gamification" (2. Juli 2026)
- **Premium-Sidebar** (beide Dashboards): Icons pro Eintrag, aktiver Balken links, User-Karte oben (Avatar + Name + Status), Abschnitts-Labels, Live-Badges. Schüler: Badge = neue Jobs (<72h). Firma: Badge = offene Bewerbungen.
- **Gamification (Schüler)**: Neuer "Abzeichen"-Bereich mit 8 freischaltbaren Achievements (Willkommen, Gesicht zeigen, Verifiziert, Bereit, Erste Bewerbung, Fleißig, Sammler, Angenommen). Erreichte leuchten farbig, offene sind ausgegraut.
- **Bewerber-Ampel (Firma)**: Jeder Bewerber bekommt grün/gelb/rot je nach 3 Kriterien (verifiziert + Alter passt zum Job-Mindestalter + Lebenslauf ausgefüllt). "Top-Match" / "Passt teils" / "Prüfen".

## Update "CV-Builder Pro" (2. Juli 2026)
- **CEFR-Sprachen**: eigener Block-Typ, Auswahl Muttersprache/C2–A1 pro Sprache, Darstellung als Badges in Vorschau + PDF.
- **Skill-Regler**: eigener Block-Typ mit 0–100%-Slidern (z.B. Teamfähigkeit), gerendert als Fortschrittsbalken in Vorschau + PDF (jsPDF zeichnet echte Balken).
- **Auto-Save**: Lebenslauf-Entwurf wird bei jeder Eingabe in localStorage gespeichert (`cv-draft-<userid>`), beim Öffnen wiederhergestellt, nach echtem Speichern verworfen. "✓ Automatisch zwischengespeichert"-Hinweis.
- **Antwort-Mail-Vorlagen (Firma)**: Bei Annehmen/Ablehnen öffnet sich optional eine vorformulierte, höfliche mailto-Mail an den Bewerber (Zusage bzw. freundliche Absage).
- Block-Typen jetzt: text, skillbar (NEU), sprachen (NEU), skills (Tags), bild. Alt-Daten bleiben kompatibel.

## Dark Mode – bewusst zurückgestellt
Braucht zuerst eine Token-Umstrukturierung (semantische Farb-Ebene --bg/--surface/--text statt direkter --ink-Nutzung), weil --ink aktuell an vielen Stellen als dunkler HINTERGRUND dient (Footer, CTA, btn-dark). Einfaches Umdrehen würde diese brechen. Eigener sauberer Block nötig.

## Update "Sicherheit & Vertrauen" (Block 1 + 2 teilw., 2. Juli 2026)
- **Sicherheits-Audit** durchgeführt: RLS auf allen Tabellen aktiv & korrekt, keine service_role-Keys im Frontend, Ausweis-Buckets privat. Ergebnis dokumentiert.
- **CHECK-Constraints** (DB): alter_jahre 10–20, stundenlohn 0–100, mindestalter 10–20, Job-Titel nicht leer.
- **Ausweis-Löschfunktion**: Schüler können Verifizierungs-Dokument selbst löschen (Storage-Datei + DB-Pfad geleert, verifiziert-Status bleibt). Neue DELETE-Policy nur für eigene Datei. Funktion `loescheDokument()` in dashboard-schueler.js. HINWEIS: Auto-Löschen bei Admin-Freigabe geht NICHT per DB-Trigger (Supabase blockiert Storage-Delete aus SQL) → braucht später Edge Function + Admin-Panel (Block 5).
- **Toast-System** (js/toast.js): dezentes Erfolgs-Feedback oben rechts (Bewerbung, Lebenslauf gespeichert, Job gemerkt, Job gepostet, Status geändert, Dokument gelöscht).
- **"So schützen wir dich"-Sektion** auf Landingpage (Geprüfte Nutzer / Jugendarbeitsschutz / Datenschutz).
- **Inline-Feldvalidierung** bei Registrierung: rot umrandete Felder + Text darunter statt Browser-Popups (novalidate + feldFehler()).

## Block 3A – Nachrichten-System (fertig, 2. Juli 2026)
- Neue Tabelle `nachrichten` (bewerbung_id, absender_id, text, gelesen) mit RLS: nur Schüler der Bewerbung + Firma des Jobs dürfen lesen/senden.
- Chat entsteht, sobald eine Bewerbung **angenommen** ist. Schüler: neuer Sidebar-Bereich "Nachrichten" mit Konversationsliste + Chat. Firma: "💬 Nachricht schreiben"-Button beim angenommenen Bewerber → Chat-Modal.
- Gemeinsames Modul `js/chat.js` (Verlauf, Senden, als-gelesen-markieren, 8s-Polling). Ungelesen-Badge in der Sidebar (`zaehleUngelesen`).
- Sinn: sichere Kontaktaufnahme über die Plattform statt private Handynummern (Minderjährigenschutz).
- Chat-Label = Job-Titel (Firmen-/Schülernamen werden aus Datenschutzgründen nicht quer sichtbar gemacht).

## Block 3 – KOMPLETT (2. Juli 2026)
- **A) Nachrichten-System** ✅ (siehe oben)
- **B) Benachrichtigungs-Glocke** ✅ im Header beider Dashboards (neue Nachrichten, Statusentscheidungen, neue Bewerbungen), Dropdown + roter Badge, alle 20s aktualisiert. Gesehen-Status in localStorage. E-Mail via Resend bewusst NICHT gebaut (braucht Edge Function + Key).
- **C) Job-Detailseite** ✅ `job.html?id=` mit voller Beschreibung, dynamischen Meta-Tags fürs Teilen (WhatsApp/Google), Aufruf-Zähler, "Link kopieren". Jobs-Modal hat "Als eigene Seite öffnen".
- **D) Aufruf-Zähler** ✅ Spalte `jobs.aufrufe` + sichere RPC `job_aufruf_zaehlen` (anon darf zählen, by design). Firmen-Dashboard zeigt "👁 Aufrufe · 📨 Bewerbungen" pro Job.
- **E) Filter** ✅ Arbeitszeit-Filter (Wochenende/Nachmittags/Abends/Ferienjob/Flexibel) + echter **Umkreis-Filter** (Geocoding via Open-Meteo beim Job-Posten/Profil-Speichern → lat/lon; km-Slider + Haversine + Distanz-Chip). HINWEIS: Bestandsjobs/-profile brauchen ein erneutes Speichern, um Koordinaten zu bekommen.

Damit sind Block 1, 2 und 3 fertig. Nächste Blöcke: Block 4 (Dark Mode via Token-Refactor, Design-Feinschliff, A11y), Block 5 (Bewertungen, Premium-Listings, Admin-Panel, Analytics + Ausweis-Auto-Löschung via Edge Function).

## Update "Launch & Logo" (4. Juli 2026)
- **Domain live**: `schuelermatch.de` gekauft (Namecheap) und mit Vercel verbunden – HTTPS aktiv, DNS propagiert, Auth-URLs in Supabase auf die neue Domain gesetzt. Canonical/og:url auf index.html + jobs.html gesetzt.
- **Zugangssperre gebaut** (`js/gate.js`): Passwort-Overlay auf allen 12 Seiten während der Bauphase (Passwort `schuelermatch2026`). Zum Öffnen für alle: `GATE_AKTIV = false`. Bewusste "Zutritt verboten"-Lösung, kein echter Schutz (Repo/Code öffentlich).
- **Echtes Logo eingebaut**: In Canva designt (Konzept "Interlocking Shapes SM Monogramm", grün→blau + Wordmark). Als `assets/logo.png` gespeichert, Hintergrund per Python/Pillow transparent gemacht + zugeschnitten (1212×229). Ersetzt in der **Kopfzeile aller Seiten** das alte `.logo-mark`-SM-Kästchen (neue CSS-Klasse `.logo-img`, 30px Desktop / 25px Mobil). "v2.1"-Debug-Badge entfernt.
- **Noch OFFEN vom Logo-Einbau** (kleine Feinschliffe für nächstes Mal):
  1. **Footer-Logo** nutzt noch das alte `.logo-mark`-SM-Kästchen (Footer ist dunkel, das neue Logo hat dunkle Schrift → dort bräuchte es eine helle Logo-Variante).
  2. **Favicon** (Browser-Tab) ist noch das alte inline-SVG-SM-Symbol, nicht das neue Monogramm.
  3. Nutzer wünscht später **Design-Feintuning ans neue Logo** (Farben/Look angleichen).
- **Pillow** wurde per pip installiert (für Bildbearbeitung), **Node.js portable** liegt unter `C:\Users\sanad\AppData\Local\Programs\nodejs-portable`.
- **Canva-MCP** ist verbunden (Logo-Design lief darüber). **Magic-MCP** (21st.dev) ist als MCP für Claude Code eingerichtet.

## Block 2 – noch offen für nächstes Mal
Empty States final prüfen, Skeletons sind schon da. Danach Block 3 (Nachrichten, Benachrichtigungen/Glocke, Job-Detailseite mit eigener URL, Umkreis-Filter + Arbeitszeit-Filter), Block 4 (Dark Mode via Token-Refactor, Design-Feinschliff, A11y), Block 5 (Bewertungen, Premium-Listings, Admin-Panel, Analytics).

## Ideen für später (noch nicht gebaut)
- Firmenname/Logo auf Job-Karten (siehe Hinweis oben — braucht Entscheidung)
- Automatisierte/schnellere Verifizierung (würde bezahlte KI-API + eigene Backend-Funktion brauchen)
- E-Mail-Benachrichtigung an Schüler bei Statusänderung der Bewerbung

## Update "Dark Mode, Bewertungen & Logo-Feinschliff" (12. Juli 2026)

### Erledigt
- **Footer-Logo**: helle Variante `assets/logo-light.png` (weiße Wortmarke, aus logo.png per Pillow) ersetzt das alte SM-Kästchen in allen Seiten mit Footer. CSS `.footer-logo-img` (26px).
- **Favicon**: `assets/favicon.png` (Monogramm, quadratisch, aus logo.png per Pillow) ersetzt das alte inline-SVG-SM in allen 12 Seiten.
- **Design ↔ Logo**: Farb-Variablen (`--match-green #00c896`, `--indigo #2b2f8f`) entsprechen bereits exakt den Logo-Farben – Design ist farblich abgestimmt.
- **Dark Mode** (Block 4): Umschalter (🌙/☀️) im Header, via `:root[data-theme="dark"]` in style.css. Theme wird in `js/gate.js` VOR dem Paint gesetzt (kein Flackern), Default = System-Einstellung, Persistenz in `localStorage['sm-theme']`. Absichtlich dunkle Elemente (Footer, CTA, Login-Button, Toast, aktive Pille) bleiben gezielt dunkel (kein Invertier-Bruch). Header-Logo wird im Dark Mode automatisch auf die helle Variante getauscht. Verifiziert (Computed Styles).
- **Firmen-Bewertungen** (Block 5): neue Tabelle `bewertungen` (firma_id, schueler_id, schueler_name, sterne 1–5, kommentar, unique firma_id+schueler_id). **RLS: nur Schüler mit status='angenommen' bei der Firma dürfen 1× bewerten**; öffentlich lesbar; eigene Bewertung editier-/löschbar. RLS scharf getestet (angenommen erlaubt / fremd blockiert). Anzeige (Schnitt+Sterne+Liste) auf `job.html`; Abgabe-Formular im Job-Detail des Schüler-Dashboards für angenommene Schüler.

### Migration
- Supabase-Migration `bewertungen_tabelle_mit_rls` angewendet (Projekt blufrvuskqiloslyxjkx). Security-Advisors: keine neuen Warnungen für die Tabelle.

### Sonstiges
- **Wissensgraph** des Projekts gebaut (`/graphify`) → liegt lokal in `graphify-out/` (graph.html, GRAPH_REPORT.md); per `.gitignore` vom Deploy ausgeschlossen.

### Noch offen / Roadmap
- Zugangssperre (`gate.js`) ist weiterhin AKTIV – zum Launch `GATE_AKTIV = false`.
- ~~Cache: Stammbesucher bekommen neue CSS/JS erst nach Hard-Refresh~~ **BEHOBEN am 22.8.**: `vercel.json` setzt fuer HTML/CSS/JS `max-age=0, must-revalidate` (Browser fragt jedes Mal kurz nach, unveraendert = 304 ohne Daten) und fuer `/assets/` 30 Tage. Updates kommen damit sofort bei allen an.
- Block 5 Rest: Premium-Listings, Admin-Panel, Analytics, Ausweis-Auto-Löschung via Edge Function.
- Vor echten Nutzern: Impressum/Datenschutz juristisch prüfen (Minderjährige).
- A11y-Feinschliff (Block 4 Rest).

## Sprint 1 "Startup-Niveau" (12. Juli 2026, Master-Prompt aktiv)
Der Nutzer hat einen Master-Prompt gegeben: eigenständig als Produktteam arbeiten, Plattform auf Profi-Niveau bringen. Sprint-Format: Audit → priorisieren → umsetzen → verifizieren → committen.
- **Meine Bewerbungen** (Schüler-Dashboard): neue Sidebar-View mit Status-Timeline (Eingereicht → In Prüfung → Zusage/Absage), Kopf-Statistik (Gesamt/In Prüfung/Zusagen), Chat-Direktlink bei Zusage, Sidebar-Badge mit offenen Bewerbungen. CSS: `.bew-*`
- **Lebenslauf-Ausbau**: 7 Schnell-Abschnitte mit kontextuellen Ausfüllhilfen (`data-platzhalter` → `b.platzhalter` im Block-System), 12 statt 4 Formulierungshilfen, neue Vorlage „Der Komplette" (8 Abschnitte inkl. Verfügbarkeit/Mobilität).
- **Jobbörse**: kompletter Filter-Zustand in der URL (teilbare Such-Links, `history.replaceState`), „Filter zurücksetzen"-Button bei 0 Treffern.
- **SEO**: `robots.txt` (Dashboards disallow), `sitemap.xml`, JSON-LD `JobPosting` auf job.html (verifiziert valide) → Google-Jobs-fähig nach Launch.
- Verifiziert: Node-Syntax-Check aller geänderten Module, Browser-Tests (URL-Sync, Reset, JSON-LD), keine Konsolen-Fehler.
- **Nächste Sprints (Vorschlag)**: Firmen-Seite (Bewerber-Filter, Job-Vorlagen, Job duplizieren), CV-PDF-Designs (mehrere Layouts/Farben), Onboarding-Checkliste für neue Schüler, Admin-Panel, E-Mail-Benachrichtigungen (Edge Function), Barrierefreiheit-Audit.

## Sprint 2+3 (12. Juli 2026, autonome Weiterarbeit)
- **Sprint 2 – Firmen-Dashboard** (Commit ffac5e6):
  - 6 Anzeigen-Vorlagen (`JOB_VORLAGEN` in dashboard-firma.js): Ein-Klick-Vorbefüllung des Job-Formulars
  - Job duplizieren (`data-duplicate`): Kopie ins Formular, speichert als neuen Job
  - Bewerber-Status-Filter (Pills über der Jobliste, `bewerberFilter`), Anzeige „x von y Bewerbungen"
  - Bewerbungen nach Datum sortiert, „beworben am" sichtbar
  - Wichtig: PDF-/Zeugnis-Buttons von Listen-Index auf Bewerbungs-ID umgestellt (`data-pdf-id`/`data-zeugnis-id`) — Index wäre mit Filter falsch gewesen
- **Sprint 3 – Onboarding-Checkliste** (Schüler-Dashboard):
  - „🚀 Deine ersten Schritte (x/5)"-Karte oben in der Jobs-View: Profil → Foto → Lebenslauf → Verifizierung → erste Bewerbung
  - Fortschrittsbalken, Klick springt zur passenden View, ausblendbar (localStorage `onboarding-weg-<id>`), verschwindet automatisch bei 5/5
  - CSS: `.onboard-*`
- Verifiziert: Node-Syntax-Checks, keine Konsolen-Fehler. UI hinter Login → beim nächsten eigenen Login prüfen.

## Sprint 4 – CV-PDF-Designs (12. Juli 2026)
- **pdf.js komplett designfähig**: 3 Layouts (Klassisch = bisheriges, Modern = farbiges Kopfband volle Breite mit weißem Text, Minimal = bewusst farblos/grau) × 4 Akzentfarben (Grün, Blau, Coral, Grau). Stil via `daten.cv_design = {layout, farbe}`, Modul-Zustand `stil`.
- **Auswahl-UI** im CV-Builder über dem Download-Button (`#pdf-design-row`, CSS `.pdf-layout-chip`/`.pdf-farbe`), Speicherung in localStorage `cv-design-<profileId>`.
- **WICHTIG/OFFEN**: Migration `alter table profiles add column cv_design jsonb` wurde vom Permission-System geblockt (Produktions-DB, braucht explizite Freigabe des Nutzers). Aktuell: Design gilt nur für den eigenen Export des Schülers; Firmen-Export nutzt Standard. Nach Freigabe: Spalte anlegen, cv_design beim Speichern ins Profil schreiben, in dashboard-firma.js im bewerber-Select mitladen (wandert dann automatisch via Spread in ladeLebenslaufAlsPdf).
- focus-visible + prefers-reduced-motion waren bereits vorhanden (kein Doppelaufwand nötig).

## Sprint 5 – Performance & Polish (12. Juli 2026)
- **Bilder optimiert (in-place, keine Referenzänderungen)**: logo.png 53→29 KB, logo-light.png 36→18 KB, favicon.png 27→9 KB (Pillow, LANCZOS). Zusammen ~60 KB weniger pro Seitenaufruf.
- **404.html** gebrandet (Gradient-404, Jobs/Start-Buttons, noindex) — Vercel nutzt sie bei statischen Deployments automatisch.
- **Synonym-Suche** `js/suche.js` (export passtZurSuche): "kellner"→Gastronomie, "verkäufer/kasse"→Verkauf, "tutor"→Nachhilfe, "rasenmähen"→Garten u.v.m. Multi-Wort = UND-Logik. Eingebunden in jobs.js (alte lokale Funktion ersetzt) und dashboard-schueler.js (Inline-Match ersetzt). Browser-verifiziert.

## Sprint 6 – Kategorie-Ausbau (12. Juli 2026)
- **2 neue Kategorien: „Tierbetreuung" + „Technik & Computer"** an allen 4 Stellen: Firma-Formular-Select, Schüler-Filter-Select, jobs.html-Pills (jetzt 11), index.html-Kachel-Grid (jetzt 10, mit Pfoten-/Monitor-Icon).
- **Synonyme erweitert** (suche.js): gassi/hund/katze/tiere/haustier → Tierbetreuung; computer/pc/handy/internet/website → Technik.
- **Neue Firma-Vorlage „🐕 Gassi gehen"** (JOB_VORLAGEN.gassi).
- Bestehende Beispiel-Jobs unverändert (Vorgabe des Nutzers). Browser-verifiziert via Deep-Link ?kategorie=Tierbetreuung.

## Sprint 7+8 – Formular-Qualität & SEO-Feinschliff (12. Juli 2026)
- **Job-Beschreibung mehrzeilig**: Firma-Formular von `<input>` auf `<textarea rows=4>` (war vorher EINE Zeile!). Detailansichten hatten schon pre-wrap; Job-Karten clampen die Vorschau jetzt auf 3 Zeilen (`.job-description` line-clamp).
- **Motivations-Starthilfe** im Bewerbungsmodal: 💡-Button rotiert durch 3 personalisierte Beispieltexte (Job-Titel wird eingesetzt); eigener Text wird nie überschrieben (`MOTIVATIONS_STARTER`, `motivationsStarthilfe()`).
- **Firma-Formular-Validierung** (`pruefeJobFormular`): Titel ≥5 Zeichen, Lohn 0–100 €, Ort Pflicht — freundliche Toasts statt kryptischer DB-CHECK-Fehler.
- **Meta-Descriptions** ergänzt auf login, register, impressum, datenschutz, forgot-/reset-password (UTF-8 verifiziert im Browser).

## Domain-Reparatur (13. Juli 2026)
- Befund: schuelermatch.de war NICHT mehr verbunden (DNS-Eintraege bei Namecheap verschwunden, Domain fehlte im Vercel-Projekt). Ursache unklar - Domain war aber weiterhin registriert.
- Fix: Domain + www neu im Vercel-Projekt eingetragen (Redirect-auf-www bewusst AUS, weil Supabase Auth auf https://schuelermatch.de zeigt). DNS bei Namecheap neu gesetzt: A @ -> 216.198.79.1 (neuer Vercel-IP-Bereich), CNAME www -> bf647d4442e8521a.vercel-dns-017.com.
- Verifiziert: Google DNS aufgeloest, www mit HTTPS 200, Vercel zeigt Valid Configuration fuer beide.
- Lehre: Falls die Domain wieder ausfaellt, zuerst Namecheap Advanced DNS pruefen (Eintraege koennen dort verschwinden, z.B. durch Nameserver-Wechsel).

## Launch-Checkliste (wartet auf Startschuss des Nutzers)
1. Impressum/Datenschutz pruefen (lassen) - Minderjaehrige!
2. js/gate.js: GATE_AKTIV = false setzen + pushen
3. Google Search Console einrichten (DNS-TXT-Verifizierung) + sitemap.xml einreichen -> Google Jobs greift dann automatisch (JobPosting-Markup liegt bereit)
4. Optional danach: cv_design-Migration, E-Mail-Benachrichtigungen (warten ebenfalls auf Freigabe)

## Lebenslauf-Studio + PDF-Spec (13. Juli 2026)
- **pdf.js komplett neu** nach exakter Typografie-Spec (Commit 8096ae9): A4 210x297, Raender 18/18/15/15, zweispaltig 35/65 (Leiste getoent, volle Hoehe), Name 26pt/Titel 10pt VERSALIEN+Akzentlinie/Text 10pt LH1.5, Abstaende 7/4/3/1.5mm, Balken 1.4mm ohne Prozent, Emoji-Filter, Mehrseiten sauber (Titel-Verwaisungsschutz), Layouts klassisch/modern/minimal x 4 Farben. Neue Exporte: erzeugeLebenslaufPdf, erzeugeLebenslaufPdfMitAnkern (Anker fuer Scroll-Sync), lebenslaufAlsBlob.
- **lebenslauf.html + js/lebenslauf.js** (Commit 59777b6): eigene Editor-Seite (keine Sidebar), Karten-Editor (details) mit Haekchen + Fortschritt, Vorlagen, Autosave 0.9s mit Status in Kopfzeile, lokaler Entwurf (cv-draft-<id>). Live-Vorschau = echtes PDF via pdf.js-Canvas (sticky, Scroll-Sync); Zeitlimit-Wachhund + Fallback (Renderer in der eingebetteten Test-Umgebung hing zeitweise - in echtem Chrome unproblematisch, Fallback faengt es ab). Mobil: Umschalter Bearbeiten/Vorschau. Dashboard-Menuepunkt "Lebenslauf" navigiert zur Seite (alte Dashboard-View ist unerreichbar/dormant im HTML).
- **Bewerbung mit Lebenslauf**: Modal-Wahl Auto-PDF (Standard, Mini-Vorschau, "Vorschau ansehen", Upload nach zeugnisse/<sid>/<jobid>/lebenslauf.pdf) oder eigenes PDF (max 5MB). Firma oeffnet Anhang per signed URL, Fallback Live-Erzeugung.
- **WARTET AUF NUTZER (SQL im Supabase SQL-Editor ausfuehren, Migration wurde vom Permission-System geblockt):**
  alter table public.profiles add column if not exists cv_design jsonb;
  alter table public.bewerbungen add column if not exists lebenslauf_url text;
  Ohne Spalten: alles laeuft (Design lokal, Firma generiert live); mit Spalten: Snapshot-Anhang + Design wandert zur Firma (Code schreibt lebenslauf_url bereits, Update schlaegt sonst leise fehl).
- test-pdf.html liegt unversioniert im Projektordner (lokales Testwerkzeug, ?layout=&farbe=&lang=1).

## Migration ausgefuehrt (13. Juli 2026, durch Nutzer im SQL-Editor)
- profiles.cv_design (jsonb) + bewerbungen.lebenslauf_url (text) EXISTIEREN (verifiziert via information_schema).
- Verdrahtet (Commit 3d347c9): Studio speichert cv_design im Autosave mit; Dashboard liest profile.cv_design (localStorage als Cache gewinnt); Firma-Select laedt cv_design des Bewerbers -> Live-PDF im Design des Schuelers; lebenslauf_url-Update bei Bewerbung greift jetzt dauerhaft (Snapshot-Anhang).

## Design-Session: Logo-Anpassung umgesetzt (13. Juli 2026, Commit 87c83ce)
- 3 Varianten als lokale Vorschau (design-vorschau.html, unversioniert) erstellt; Nutzer liess mich waehlen -> Variante 2 'Zwei Seiten, ein Match' umgesetzt.
- Story: Teal = Schueler, Indigo = Arbeitgeber, Verlauf = Match. Token --verlauf in :root.
- Aenderungen: btn-green -> Marken-Verlauf/weiss; eyebrow indigo; h2 indigo (Dark: #a7abff); pill.active indigo; job-card::before 3px Verlaufs-Oberkante; btn-outline hover indigo; footer #232766; final-cta Teal->Indigo-Verlauf. Dark-Mode-Overrides angepasst (btn-green Schrift weiss).
- Verifiziert per Computed Styles (hell+dunkel). Screenshot-Engine der Test-Pane war flaky (bekannt).

## E-MAIL-BENACHRICHTIGUNGEN KOMPLETT (20. Juli 2026) - END-TO-END VERIFIZIERT
- **Architektur**: DB-Trigger (bewerbungen INSERT/UPDATE of status) -> pg_net http_post -> Edge Function 'mail-ereignis' (deployed, verify_jwt, anon-Bearer im Trigger) -> Resend API. Taeglicher Digest: pg_cron 'mail-digest-taeglich' (0 16 * * * UTC) -> Edge Function 'mail-digest'.
- **Einstellbar pro Firma**: profiles.benachrichtigung ('sofort'/'taeglich'/'aus', Default taeglich) + Select im Firmenprofil. Schueler bekommen immer Zusage-/Absage-Mail.
- **Resend**: Account des Nutzers, Domain mail.schuelermatch.de VERIFIZIERT (Subdomain wie von Resend empfohlen; DKIM/SPF/MX/DMARC bei Namecheap, alle propagiert). Secrets: RESEND_API_KEY + MAIL_ABSENDER='SchuelerMatch <no-reply@mail.schuelermatch.de>'. Free-Tier 100 Mails/Tag.
- **Stolperstein dokumentiert**: Supabase-SQL-Editor MASKIERT eingefuegte JWTs zu '•'-Punkten (401 UNAUTHORIZED_INVALID_JWT_FORMAT); Reparatur via MCP-Migrationen (webhook_token_reparieren, cron_token_reparieren). NIE Keys durch den SQL-Editor pasten!
- **Test**: Status-Flip einer Test-Bewerbung -> 2x HTTP 200, Zusage-Mail im Postfach halawaisi3@gmail.com angekommen (Absender @mail.schuelermatch.de).
- **Aufgeraeumt**: altes mailto-Popup der Firma (antwortMailAnbieten) entfernt - Mails gehen jetzt automatisch, Toast weist darauf hin.
- Funktions-Quellcode im Repo: supabase/functions/mail-ereignis + mail-digest.

## Session 21. Juli 2026 - Feinschliff, Admin, Auth-Haertung
- **Alle Browser-Popups entfernt** (0 alert/confirm mehr): Fehler -> Toasts, destruktive Aktionen -> Zwei-Klick-Bestaetigung (rote Button-Klasse .btn-confirm/.weg-confirm). Job-Assistent mobil poliert (Vorlagen-Chips als Wischleiste).
- **Job posten = eigener Sidebar-Reiter** (view-posten) getrennt von "Meine Jobs & Bewerber" (view-jobs). Bewerbungs-Modal: Starthilfe als Chip, Lebenslauf-Wahl als Karten.
- **Datenschutzerklaerung** an tatsaechlichen Stand angepasst (Lebenslauf/Bilder/Verifizierung/Chat/Bewertungen, neuer Abschnitt "Was der Arbeitgeber sieht", Empfaenger Resend/Open-Meteo/Fonts/CDN, konkrete Speicherfristen, BayLDA). RECHTLICH weiter ungeprueft - Elterneinwilligung Art.8 + Betreiber-Volljaehrigkeit offen.
- **ADMIN-BEREICH** (admin.html + js/admin.js): Verifizierungen pruefen, Dokument per signed URL ansehen, Ein-Klick-Freischalten, Dokument wird nach Entscheidung automatisch geloescht. Absicherung: profiles.ist_admin + Funktion public.ist_admin() (SECURITY DEFINER) + RLS-Policies (profiles select/update, storage verifizierung select/delete). Admins: s.weisioda@gmail.com, halawaisi3@gmail.com. Link im Schueler-Dashboard nur fuer Admins sichtbar (#admin-link).
- **Verifizierungs-Mail**: mail-ereignis v4 reagiert jetzt auch auf profiles UPDATE (verifiziert false->true) -> Freischalt-Mail. Trigger profil_verifiziert_mail. Getestet, zugestellt.
- **Custom SMTP ueber Resend** (vom Nutzer in Supabase eingetragen): Host smtp.resend.com:465, User resend, Absender no-reply@mail.schuelermatch.de. Auth-Mails (Reset etc.) laufen jetzt ueber die eigene Domain - getestet, zugestellt. Zweiter Resend-Key "supabase-smtp" (nur Sending, nur mail.schuelermatch.de).
- **Auth-Bugfix**: handle_new_user() abgesichert - role faellt auf 'schueler' zurueck (statt 500 "null value in role"), alter_jahre defensiv geparst. Getestet.
- **John (hidiscord7oki) geloescht** - Fake-Registrierung (Discord), 0 Aktivitaet.
- **OFFEN / NUTZER-MANUELL**: "Confirm email" in Supabase Auth ist noch AUS -> jeder kann sich mit Fake-Mail anmelden. Muss der Nutzer unter Authentication > Sign In/Providers > Email anschalten.

## Session 22./23. Juli 2026 - Firmen-Freigabe + E-Mail-Bestaetigung KOMPLETT
- **Firmen-Freigabe Stufe 1** (Commit b4bd0a6): profiles.firma_status (neu/freigegeben/gesperrt), RLS-gehaertete Job-Sichtbarkeit via public.firma_freigegeben() (SEC DEFINER), Admin-Reiter 'Firmen-Freigabe' (admin.html Tabs), Firmen-Banner + 'In Pruefung'-Badges im Firma-Dashboard, Freigabe-Mail (mail-ereignis v5 + Trigger firma_freigabe_mail). SQL-verifiziert: gesperrte Firma = 0 oeffentliche Jobs; Mail zugestellt.
- **Confirm email AN** (durch Nutzer) + verifiziert: Signup wartet auf Bestaetigung, 'Confirm your email address' via Resend/eigene Domain ZUGESTELLT.
- **Registrierung angepasst** (Commit b0b53d6): kein Auto-Login mehr nach SignUp; ohne Session -> 'Fast geschafft'-Ansicht (Mail-Hinweis + Spam-Tipp + Login-Link, CSS .auth-bestaetigen). Login zeigt bei unbestaetigter Mail eigene Meldung statt 'falsches Passwort'. E2E im Browser getestet (echtes Signup, danach geloescht).
- **Geplant/Stufe 2 offen**: 'Verifiziertes Unternehmen'-Abzeichen (Gewerbeschein-Upload, optional), Melden-Funktion fuer Jobs/Chats, deutsche Supabase-Mail-Templates (aktuell englisch: 'Confirm your email address' - anpassbar unter Authentication > Emails > Templates).

## Session 23. Juli 2026 (Teil 2) - Konnektoren, Impeccable, Audit-Fixes
- **Chrome-Verbindung (claude-in-chrome)** eingerichtet: kompletter Live-Rundgang durch alle eingeloggten Bereiche selbst durchgefuehrt (Dashboard, Bewerbungs-Timeline, Lebenslauf-Studio inkl. Live-PDF-Vorschau, Admin beide Reiter) - alles funktioniert, 0 Konsolen-Fehler. Konto-Logins macht weiterhin NUR der Nutzer.
- **Playwright-MCP installiert** (User-Scope, cmd /c npx @playwright/mcp@latest) - Tools verfuegbar. NAECHSTER GROSSER SCHRITT: E2E-Test-Suite (Registrierung/Login/Suche/Bewerbung/Job-Assistent).
- **Higgsfield-MCP registriert** (braucht noch OAuth durch Nutzer; KI-Video/Bild fuer Marketing, kostet eigene Credits). Magic/21st.dev + Design-Skills waren schon da. motion.dev bewusst weggelassen (kein offizieller MCP).
- **Impeccable installiert** (Skill + Hooks in beiden .claude-Ordnern; /impeccable-Befehle). init ausgefuehrt -> PRODUCT.md (Positionierung: 'Nur fuer Schueler gebaut'; Erfolg: aktive Nutzer + gefuellter Katalog; Region bewusst offen).
## Session 23. Juli 2026 (Teil 3) - Playwright-E2E-Test-Suite GEBAUT
- **43 Tests, alle gruen** (~3 Min Laufzeit). Ausfuehren: `npm test` im Projektordner (Node portable im PATH noetig). Weitere Scripts: `npm run test:ui` (interaktiv), `npm run test:report` (HTML-Report).
- **Architektur**:
  - `playwright.config.js`: startet den Python-Server (Port 5500) automatisch, 2 Projekte: `chromium` (Desktop) + `mobil` (Pixel 7, nur mobil.spec.js)
  - `tests/helpers/basis.js`: gemeinsame Test-Basis - Gate-Bypass (sessionStorage `sm-zugang-ok`) + **kompletter Supabase-Mock via Route-Interception**. KEIN Test spricht je mit der Produktions-DB: keine echten Accounts, keine E-Mails, keine Zaehler. Mock-Antworten pro Test ueberschreibbar via `test.use({ antworten })`.
  - `tests/helpers/fixtures.js`: 4 deterministische Test-Jobs (decken alle Filterdimensionen ab: Kategorien, Synonym-Suche, NEU-Badge, Lohn/Alter/Ort/Arbeitszeit)
- **Abgedeckt**: Gate (Passwort richtig/falsch/Session), Jobboerse komplett (Suche+Synonyme, Pills, alle Filter, Sortierung, URL-Sync/Deep-Links, Empty-State+Reset, Detail-Modal, Tastatur, NEU-Badge), Auth (Login-Fehler, "Email not confirmed"-Unterscheidung, PW-Toggle, Registrierungs-Validierung inkl. Elterneinwilligung u16, PW-Staerke-Meter, Rollen-Tabs, gemocktes SignUp -> "Fast geschafft"), Job-Detailseite (Rendering, JSON-LD JobPosting, Bewertungen inkl. Schnitt, Fehlerfaelle), Landingpage (Hero-Suche, Kategorie-Kacheln, FAQ-Accordion+aria, Dark-Mode inkl. Persistenz, Links), Statisches (404, robots.txt, sitemap.xml, Impressum/Datenschutz, Konsolen-Fehler-Check ueber 7 Seiten), Mobil (Hamburger, Filter+Modal, Registrierung).
- **Erweiterung (23.7., Teil 4): eingeloggte Dashboards jetzt abgedeckt** - Gesamtzahl **60 Tests, alle gruen** (~2,5 Min).
  - `tests/helpers/supabase-fake.js`: In-Memory-PostgREST-Fake (Filter eq/neq/in/is, .single(), Embeds wie job:job_id(...)/bewerber:schueler_id(...), INSERT/UPDATE/DELETE, count/head) + Session-Injektion via localStorage-Key `sb-<ref>-auth-token` (kein echter Login) + Geocode-Mock (Open-Meteo). Nutzer SCHUELER/FIRMA + `defaultDb()`. Tests inspizieren die Fake-DB direkt (z.B. Bewerbung/Job landet wirklich drin).
  - **Schueler-Dashboard** (`dashboard-schueler.spec.js`, 10 Tests): Auth-Guard (nicht eingeloggt -> login), Laden/Name/Matches, Filter+Synonym, Sidebar->Bewerbungen-Timeline, Profil vorbefuellt+Speichern (PATCH), Verifizierungs-Ansicht, Bewerbungs-Flow (unverifiziert -> Verifizierung; verifiziert -> Bewerbung landet in DB), Motivations-Starthilfe, Logout.
  - **Firma-Dashboard** (`dashboard-firma.spec.js`, 7 Tests): Auth-Guard, Job-Assistent-Start, Meine-Jobs-Liste+Stats+Pausiert-Badge, Bewerber mit Ampel (Top-Match) + Annehmen/Ablehnen, Annehmen schreibt Status in DB, Pruef-Banner fuer neue Firma, Job-posten-Wizard -> Job landet in DB.
  - Stolperfalle dokumentiert: Sidebar ist Off-Canvas (`left:-280px`), im Test erst per `#sidebar-toggle` oeffnen. Test-Timeout auf 45s erhoeht (Dashboards laden jsPDF/pdf.js/supabase-js/Fonts von CDNs -> unter Parallel-Last sonst flaky).
  - Weiterhin NICHT abgedeckt: Chat-Verlauf/Senden, Admin-Panel, echte Uploads (Storage nur als Erfolg gemockt) - Kandidaten fuer spaeter.
- **Deploy-Sicherheit**: `package.json` hat bewusst KEIN build-Script (Vercel deployt weiter statisch); `.vercelignore` neu - schliesst tests/, node_modules/, Configs, *.md u.a. vom Deploy aus. `.gitignore` um test-results/ + playwright-report/ ergaenzt.
- 3 anfaengliche Testfehler waren Setup-Fehler, keine App-Bugs (Theme-Override im Init-Script, Mobil-Spec im Desktop-Projekt, "Jetzt starten" statt "Login" auf index.html).

## Session 26. August 2026 (Teil 21) - 16 englische Fehlertexte

Der naechste Punkt aus der Liste, und einer der wenigen, der ohne Sanad
auskommt: **Formular-Fehlermeldungen**.

Gemessen: **16 Stellen** gaben den englischen Text von Supabase oder der
Dateiablage direkt an den Nutzer weiter - beim Hochladen des Schuelerausweises,
beim Speichern des Lebenslaufs, beim Anfordern eines neuen Passworts. Also
genau dort, wo ein 14-Jaehriger sitzt, der ohnehin unsicher ist.

`verstaendlich()` in `js/zustand.js` gab es laengst und deckte Netz, Rechte,
Duplikate, Groesse und Sitzung ab. Nur riefen es diese 16 Stellen nicht auf.

### Zwei Faelle fehlten im Uebersetzer
- **Das Tempolimit der Anmeldedienste.** "For security purposes, you can only
  request this after 41 seconds" ist der haeufigste Fehler auf den
  Anmeldeseiten ueberhaupt. Die Sekundenzahl wird jetzt uebernommen - ein
  blosses "gleich nochmal" laesst Leute im Sekundentakt weiterklicken.
- **Abgelehnte Dateiart.** `js/dokument-pfad.js` faengt das seit Teil 17
  vorher ab; die Meldung bleibt fuer den Fall, dass doch etwas durchkommt.

### Ein Nebenbefund beim Passwort-Zuruecksetzen
`js/forgot-password.js` zeigte `error.message` roh an. Das war nicht nur
englisch, sondern inkonsequent: Die Erfolgsmeldung sagt bewusst "**Falls** diese
E-Mail registriert ist", damit sich nicht ablesen laesst, wer ein Konto hat -
und der Fehlerzweig kippte diesen Schutz wieder um.

### Der Betreiber-Bereich bleibt roh - mit Ansage
Die 6 Stellen in `js/admin.js` sind **nicht** umgestellt. Dort sitzt die
einzige Person, die mit "new row violates row-level security policy" etwas
anfangen kann; ein freundliches "hat gerade nicht geklappt" wuerde die
Fehlersuche unmoeglich machen. Das steht als Kommentar im Dateikopf und wird
von einem Test festgehalten, damit es spaeter niemand als Versehen
"korrigiert".

**Suite: 625 -> 633 Tests, alle gruen.**

## Session 26. August 2026 (Teil 20) - Derselbe Fehler auf der Schuelerseite

Fortsetzung der Methode aus Teil 19. Diesmal nicht die Texte der Seite, sondern
**die Regeln der Datenbank** ausgelesen: alle CHECK-Constraints auf einmal. Zwei
Funde in einer einzigen Abfrage.

### Befund 1: Die Registrierung nahm Zehnjaehrige an

`chk_alter_jahre` auf `profiles` liess **ab 10** zu, und die Auswahlliste in
`register.html` bot 10, 11 und 12 an - genau derselbe Fehler wie im
Anzeigenformular aus Teil 18, nur auf der anderen Seite der Plattform. Ein
Zehnjaehriger konnte sich ein Konto anlegen, auf einer Seite, die ueberall
"ab 13" sagt.

Behoben: Liste beginnt bei 13, `pruefeAlter()` in `js/jugendschutz.js` prueft im
Ablauf, `supabase/alter-grenze.sql` macht es verbindlich. Juengstes Profil in
der Datenbank: 15 - die Regel trifft keine bestehende Zeile.

Der Text ist bewusst ein anderer als beim Anzeigenformular: Dort liest ihn ein
Arbeitgeber und der Paragraph gehoert dazu. Hier liest ihn ein Kind - ohne
Gesetzestext und ohne Vorwurf. Ein Test haelt den Unterschied fest.

### Befund 2: Die Einwilligung der Eltern wurde weggeworfen

Bei der Registrierung wird das Haekchen "Ich habe die Erlaubnis meiner Eltern"
abgefragt und im Browser geprueft. Gespeichert wurde es **nirgends**: In
`options.data` standen nur Name, Rolle, Alter und Ort.

**Art. 7 Abs. 1 DSGVO verlangt aber, dass der Verantwortliche nachweisen kann,
dass eingewilligt wurde.** Genau danach wird die rechtliche Pruefung fragen.

Behoben ohne Schema-Aenderung: `handle_new_user()` liest gezielte Schluessel aus
`raw_user_meta_data` und ignoriert weitere - `eltern_einwilligung` samt
Zeitpunkt landet also dort und bleibt erhalten. `supabase/alter-grenze.sql`
enthaelt die Abfrage, mit der sich der Nachweis einsehen laesst, und beschreibt
den optionalen Weg, es zusaetzlich ins Profil zu ziehen (mit dem Hinweis, dass
der Schutz-Trigger die Spalten dann einfrieren muss - sonst koennte jemand die
eigene Einwilligung nachtraeglich setzen und der Nachweis waere wertlos).

### Nebenbei korrigiert: meine eigene SQL-Datei aus Teil 18

`chk_mindestalter` **gab es bereits** (ab 10). `supabase/mindestalter-grenze.sql`
haette eine zweite Regel danebengelegt statt sie zu ersetzen. Funktioniert
haette es - die strengere gewinnt -, aber jeder spaetere Leser haette erst
herausfinden muessen, welche gilt. Die Datei ersetzt die alte Regel jetzt, und
die Pruefabfrage am Ende sucht nach beiden Namen.

Gefunden nur, weil ich die Constraints ausgelesen habe, statt meine eigene Datei
fuer richtig zu halten.

### Ein eigener Fehler im Modul
`Number('')` ist `0`, und `Number.isInteger(0)` ist wahr. Eine leere Auswahl kam
damit als "0 Jahre" an und bekam die Meldung "unter 13 ist nicht erlaubt" -
ein Vorwurf, wo gar kein Bedienfehler vorlag. Betraf beide Pruefungen.
Ein gemeinsames `alsAlter()` behebt es, zwei Tests halten es fest.

**Suite: 613 -> 625 Tests, alle gruen.**

## Session 26. August 2026 (Teil 19) - Jedes Versprechen gegen den Code

In Teil 18 fiel zufaellig eine unbelegte Werbeaussage auf. Diese Runde macht
daraus eine Methode: **jede Sicherheits- und Vertrauenszusage der oeffentlichen
Seiten gegen das pruefen, was der Code tatsaechlich tut.** Vor der ausstehenden
rechtlichen Pruefung genau die richtige Frage.

Geprueft wurden die Zusagen auf `index.html`, `eltern.html`, `fuer-firmen.html`
und `jobs.html`.

### Befund: "die wir geprueft haben" galt nur im Browser

`fuer-firmen.html` verspricht den Arbeitgebern woertlich:

> "Nur Schueler. Wer sich bewirbt, hat einen Schuelerausweis oder eine
> Schulbescheinigung hochgeladen, **die wir geprueft haben**."

Erzwungen wurde das nur in `js/dashboard-schueler.js` (`if
(!profile.verifiziert)`). Die Zugriffsregel der Datenbank verlangte lediglich
`auth.uid() = schueler_id` - **keine Verifizierung**. Wer die Schnittstelle
direkt anspricht, konnte sich unverifiziert bewerben, und der Arbeitgeber haette
darauf vertraut, dass jemand die Unterlagen gesehen hat.

Dieselbe Klasse wie das Mindestalter aus Teil 18: eine Zusage, die nur im
Browser gilt, ist keine Zusage. `supabase/bewerbung-verifiziert.sql` schliesst
es (Hilfsfunktion `ist_verifiziert()` im Stil von `firma_freigegeben`, dann die
INSERT-Regel). Nicht selbst eingespielt. Stand: 3 Bewerbungen, davon 0 von
unverifizierten Schuelern - es ist nichts durchgerutscht.

### Befund: "dass ein echtes Unternehmen dahintersteckt"

`fuer-firmen.html` verspricht: "Wir pruefen von Hand, dass ein echtes
Unternehmen dahintersteckt." Die Firmenkarte im Betreiber-Bereich zeigte dafuer
**nur Name, Ort und E-Mail**. Damit laesst sich das kaum pruefen - die Zusage
war staerker als das, was der Betreiber in der Hand hatte.

`js/firmen-pruefung.js` zieht jetzt aus den vorhandenen Angaben die
Anhaltspunkte heraus, die etwas aussagen: eigene Domain gegenueber Freemail,
Wegwerf-Adresse, Rechtsform im Namen, fehlender Ort. Es entscheidet nichts und
blockiert nichts - die Freigabe bleibt Handarbeit.

**Bewusst zurueckhaltend:** Ein Freemail-Konto ist kein Betrugsverdacht. Ein
Elternteil, das Nachhilfe sucht, oder ein kleiner Laden hat oft nichts anderes.
Deshalb steht dort "bei kleinen Anbietern normal - frag im Zweifel nach der
Firmenanschrift" statt einer roten Warnung. Mehrere Tests pruefen ausdruecklich,
dass NICHT gewarnt wird. Wer lauter Alarme sieht, klickt sie nach drei Tagen weg
- dieselbe Ueberlegung wie bei den Chat-Warnungen in Teil 16.

### Geprueft und in Ordnung

- **"Firmen sehen deinen Lebenslauf erst, nachdem du dich beworben hast"** - die
  Regel "Firma sieht Profil von Bewerbern" erzwingt das sauber ueber einen
  Abgleich mit `bewerbungen` und `jobs`.
- **"Der Austausch laeuft ueber den Chat"** - `nachrichten` haengt zwingend an
  einer `bewerbung_id`, eine Firma kann niemanden ohne Bewerbung anschreiben.
- **Die Browser-Sperre beim Bewerben** war bereits getestet
  (`dashboard-schueler.spec.js`), die Luecke sass allein in der Datenbankregel.

### Notiert, nicht geaendert

`avatars` und `lebenslauf-bilder` sind **oeffentliche** Ablagen: Wer die Adresse
kennt, sieht das Foto ohne Anmeldung. Beide sind derzeit leer, es ist also
nichts offen. Auf Dauer gehoert das ueberdacht - private Ablage plus signierte
Adressen, so wie bei `verifizierung` und `zeugnisse`. Das ist ein groesserer
Umbau und steht in OFFENE-PUNKTE.

### Ein eigener Fehler - vom Kontrast-Test gefangen

Meine neuen CSS-Regeln hiessen `.firma-hinweis`. **Den Namen gab es schon** -
als Haftungshinweis auf `ferienjob.html`, `fairer-lohn.html` und
`fuer-firmen.html`. Meine Regel ueberschrieb ihn und legte dort einen grauen
Hintergrund unter, auf dem der Link zur Minijob-Zentrale nur noch **4,47:1**
erreichte (noetig sind 4,5:1).

Drei Tests in `tests/kontrast.spec.js` fielen darueber um - auf Seiten, die ich
gar nicht angefasst hatte. Genau dafuer ist die Kontrast-Pruefung da. Umbenannt
auf `.pruef-hinweis`, mit Kommentar im CSS, damit der Name nicht wieder
kollidiert.

Lehre fuer die naechste Runde: **vor einer neuen CSS-Klasse pruefen, ob es den
Namen schon gibt.** Ein `grep` haette gereicht.

### Tests
`tests/firmen-pruefung.spec.js` (16 Pruefungen).

**Suite: 597 -> 613 Tests, alle gruen.**

## Session 26. August 2026 (Teil 18) - Das Formular kannte das Gesetz nicht

Diese Runde folgt Sanads Richtung vom 25.8.: weiterentwickeln statt nur Fehler
suchen. Angesetzt am Vertrauen - dem, was eine Plattform fuer Minderjaehrige
zusammenhaelt.

### Die Idee, die sich beim Nachsehen umdrehte

Geplant war ein Abzeichen "geprueftes Unternehmen" an den Anzeigen. Beim Blick
auf die Zugriffsregel stellte sich heraus: `Jobs oeffentlich lesen` verlangt
`firma_freigegeben(firma_id)`. **Jede sichtbare Anzeige stammt also bereits von
einem geprueften Arbeitgeber.** Ein Abzeichen saesse auf 100% der Anzeigen -
das sagt nichts aus und legt sogar den falschen Umkehrschluss nahe, die anderen
seien ungeprueft. Idee verworfen.

### Befund 1: Das Anzeigenformular bot "ab 10 Jahren" an

Die Auswahlliste fuer das Mindestalter begann bei **10**. Geprueft wurde der
Wert an **keiner** Stelle - nicht im Browser, nicht in der Datenbank. Und
einzelne Anzeigen werden nirgends geprueft: Der Betreiber gibt Firmen frei,
nicht Anzeigen. Die Freischalt-Mail sagt es selbst: "Neue Jobs, die du postest,
gehen kuenftig direkt online."

Eine Firma konnte also eine Anzeige "ab 10 Jahren" schalten, und sie ging sofort
live. Nach § 5 Abs. 1 JArbSchG ist die Beschaeftigung von Kindern verboten; ab
13 sind leichte Taetigkeiten mit Einwilligung der Eltern erlaubt.

**Die Seite widersprach sich dabei selbst.** `jugendarbeitsschutz.html` sagt
woertlich: "Unter 13 Jahren: Arbeiten ist grundsaetzlich nicht erlaubt." Die
Startseite wirbt mit "ab 13". Nur das Formular wusste nichts davon.

Behoben in `js/jugendschutz.js` (eigenes Modul, damit die Regeln pruefbar sind
und nicht ein zweites Mal auseinanderlaufen):
- Auswahlliste beginnt bei 13.
- `pruefeMindestalter()` prueft zusaetzlich vor dem Absenden - eine
  Auswahlliste im Browser ist kein Schutz, wer die API direkt anspricht,
  umgeht sie. Ein Test schmuggelt genau so einen Wert ein und prueft, dass
  nichts angelegt wird.
- **Verbindlich** wird es erst mit `supabase/mindestalter-grenze.sql` (CHECK
  auf der Tabelle). Nicht selbst eingespielt - Schema-Aenderungen gibt Sanad
  einzeln frei. Niedrigstes Mindestalter in der Datenbank: 15, es ist also
  nichts Rechtswidriges live.

Dazu ein **Hinweis beim Waehlen**: Wer 13 oder 14 einstellt, liest jetzt, was
gilt - leichte Taetigkeiten, hoechstens 2 Stunden, Einwilligung der Eltern. Die
wenigsten Arbeitgeber wissen das, und im ganzen Ablauf stand es bisher nirgends.
Ein Test prueft, dass dieser Hinweis nicht von `jugendarbeitsschutz.html`
abweicht - genau an solchem Auseinanderlaufen ist das Formular gescheitert.
Kontrast gemessen: 5,78:1 (AA verlangt 4,5:1).

### Befund 2: "100% jugendschutzgeprueft"

Die Startseite warb mit dieser Kennzahl, `jobs.html` mit "Alle Jobs sind
jugendschutzgeprueft", dazu drei Beschreibungstexte, die Google anzeigt.

**Keine einzelne Anzeige wird geprueft.** Die Behauptung war nicht belegbar -
auf einer Seite, deren wichtigste Leser Eltern sind, und die ohnehin auf eine
rechtliche Pruefung wartet.

Ersetzt durch das, was tatsaechlich stimmt und staerker ist: **jeder
Arbeitgeber wird von Hand geprueft, bevor seine Anzeigen erscheinen** - das
erzwingt die Zugriffsregel der Datenbank.

Nebenbei geschlossen: Diese Zusage stand nur auf der Startseite und auf
`eltern.html`. Auf der **Jobboerse**, wo ein Schueler entscheidet, ob er einer
Anzeige traut, stand nichts davon - wer ueber Google oder einen geteilten Link
kommt, sieht die Startseite nie. Jetzt steht es dort, mit Verweis auf die
Rechte-Seite.

### Tests
`tests/jugendschutz.spec.js` (16 Pruefungen) und 4 neue in
`tests/dashboard-firma.spec.js`.

**Suite: 577 -> 597 Tests, alle gruen.**

## Session 26. August 2026 (Teil 17) - Der Betreiber-Bereich, den ich nie angesehen hatte

Angesehen wurde `admin.html` / `js/admin.js` - der einzige Bereich, den ich in
sechs Qualitaetsrunden ausgelassen hatte. Dort prueft der Betreiber
Ausweisdokumente Minderjaehriger.

### Befund 1: Ausweisdokumente konnten verwaisen

Der Speicherort einer hochgeladenen Datei kam aus der **Endung des Dateinamens**
(`file.name.split('.').pop()`). Wer erst ein Foto und spaeter ein PDF hochlud,
hinterliess ZWEI Dateien im Storage. In der Datenbank stand nur die neue - die
alte war ueber **keinen** Loeschweg mehr erreichbar: weder ueber den Knopf des
Schuelers noch ueber die Pruefung im Betreiber-Bereich, die ausdruecklich
"Dokument geloescht" meldet.

Gemessen: **bis zu 7 verschiedene Pfade fuer EIN Dokument** eines Schuelers
(`ausweis.jpg` / `.JPG` / `.jpeg` / `.pdf` / `.PDF` / `.png` / `.ausweis`). Also
bis zu 6 unerreichbare Ausweisdateien pro Person.

In der Produktion liegen 2 Dateien, beide korrekt verzeichnet - der Fehler hatte
noch nicht zugeschlagen, weil bisher niemand das Format gewechselt hat.

Dieselbe Falle steckte in **vier weiteren Uploads**: Profilfoto (zweimal),
Lebenslauf-Bilder (zweimal), Zeugnis zur Bewerbung. Bei den Fotos wiegt sie
schwerer, denn `avatars` und `lebenslauf-bilder` sind **oeffentliche** Ablagen -
eine zurueckgebliebene Datei bleibt unter ihrer alten Adresse fuer jeden
abrufbar, auch nachdem der Schueler sein Foto getauscht hat.

**Behoben in `js/dokument-pfad.js`** (eigenes Modul, damit pruefbar - dieselbe
Bauweise wie zuvor bei der Trefferlogik des Job-Alarms und den Chat-Warnungen):
- Die Endung kommt aus dem **MIME-Typ**, nicht aus dem Dateinamen. Ein Nutzer,
  eine Dokumentart, ein Pfad - `upsert` ueberschreibt wirklich.
- Beim Formatwechsel wird die Vorgaengerdatei aktiv entfernt. Bei den
  oeffentlichen Ablagen muss der Pfad dafuer erst aus der Adresse
  zurueckgewonnen werden (`pfadAusUrl`), weil dort keine Pfadangabe gespeichert
  ist.
- Groesse und Dateiart werden vorab geprueft, je Ablage mit deren eigenen
  Grenzen - mit deutschem Hinweis statt englischer Storage-Meldung.
- Der Betreiber-Bereich benutzt dasselbe `istPdf`. Vorher konnte eine Datei ohne
  Endung als `ausweis.ausweis` landen und ein PDF wurde als Bild angezeigt.

Eine Invariante haelt das zusammen: Was `pruefeFuerBucket` durchlaesst, MUSS
`dokumentPfad` einen Pfad liefern - sonst liefe der Upload mit `null` ins Leere.
Ein Test prueft das ueber alle vier Ablagen und alle erlaubten Typen.

### Befund 2: Eine Meldung verschwand mit dem Melder

Aus den Fremdschluesseln der Datenbank: `meldungen.melder_id` zeigt mit
**ON DELETE CASCADE** auf `profiles`. Wird ein Konto geloescht, verschwinden
alle Meldungen, die diese Person gestellt hat.

Ein Schueler meldet einen Erwachsenen wegen Belaestigung im Chat. Danach loescht
er aus Scham sein Konto - oder die Eltern verlangen die Loeschung. In dem Moment
ist die Meldung weg, und der Betreiber verliert genau den Vorgang, gegen den er
ermitteln muesste.

Bei der **gemeldeten** Person steht der Fremdschluessel schon richtig auf
`SET NULL` - der Vorgang bleibt. Die Asymmetrie war die Luecke.

`supabase/meldungen-fk.sql` stellt es um (Spalte nullbar + FK auf SET NULL).
**Nicht selbst eingespielt**: Schema-Aenderungen an der Produktionsdatenbank
gibt Sanad einzeln frei. `select count(*) from meldungen` = 0, es ist also nichts
verloren und die Umstellung trifft keine Zeile.

Der Betreiber-Bereich ist vorbereitet: Fehlt ein Konto, steht dort jetzt
**"Konto geloescht"** statt eines vagen "Unbekannt" - bei beiden Seiten
einheitlich. Gegenprobe gemacht: mit der alten Anzeige faellt genau dieser eine
Test um.

### Befund 3: Es gibt gar keine Konto-Loeschung

Die Datenschutzerklaerung verspricht Loeschung auf Zuruf per E-Mail (Art. 17).
In der Anwendung existiert dafuer nichts - der Betreiber muss es von Hand tun,
und niemand hatte je aufgeschrieben, was dazugehoert.

`supabase/konto-loeschen.sql` ist jetzt diese Anleitung. Die entscheidende
Erkenntnis darin: In der Datenbank kaskadiert fast alles vom Profil aus (eine
Loeschzeile raeumt Bewerbungen, Nachrichten, Bewertungen, gemerkte Jobs und bei
Firmen die Jobs samt deren Bewerbungen ab) - **der Storage nicht**. Wer nur die
Datenbankzeile loescht, laesst das Foto des Kindes in einer oeffentlichen Ablage
zurueck. Deshalb: erst die Dateien, dann die Datenbank, zum Schluss das
Anmeldekonto unter Authentication > Users (sonst legt der naechste Login ueber
`handle_new_user` ein neues Profil an).

Mit Probelauf: der Loeschblock endet auf `rollback`, das man bewusst auf `commit`
aendern muss.

### Befund 4: Die dringendste Warteschlange wurde verschwiegen

Der Kasten "Wartet auf dich" im Statistik-Reiter zeigte Firmen zur Pruefung und
offene Meldungen - aber **nicht die Schueler, deren Ausweis auf Pruefung
wartet**. Dabei ist das die dringendste Warteschlange: Wer nicht verifiziert
ist, kann sich auf gar nichts bewerben. Fuer ihn steht die ganze Plattform
still, waehrend der Betreiber im Ueberblick "nichts zu tun" liest.

`betreiber_statistik` liefert die Zahl gar nicht (dort gibt es nur
`firmen_offen` und `meldungen_offen`). Sie steckt in der Schuelerliste, die der
Bereich ohnehin laedt - also im Browser geloest, ohne Aenderung an der
Datenbank.

Dabei war ein Wettlauf zu beachten: Statistik und Schuelerliste werden
nebenlaeufig geladen. Kommt die Statistik zuerst, zeichnet sie nach, sobald die
Liste da ist - sonst staende dort dauerhaft eine leere Warteschlange. Ein Test
prueft ausserdem, dass die Zahl mit der im Schueler-Reiter uebereinstimmt; zwei
Zaehlungen derselben Sache duerfen nicht auseinanderlaufen.

### Ein Verdacht von mir war falsch
Ich hielt es fuer moeglich, dass sich das Dokument-Fenster nicht mit Escape
schliessen laesst - immerhin ein Fenster mit dem Ausweis eines Minderjaehrigen.
Nachgesehen: Es traegt `modal-overlay` und einen `.modal-close`-Knopf, damit
greift `js/tastatur.js` automatisch (Escape, Fokusfalle, Fokus zurueck).
Ebenso geprueft und in Ordnung: Der Toast "E-Mail geht raus" bei der
Firmen-Freigabe stimmt - der Trigger `firma_freigabe_mail` existiert, ist aktiv,
und die Mail-Funktion feuert nur beim Wechsel *auf* `freigegeben`, nicht beim
Sperren.

### Tests
`tests/dokument-pfad.spec.js` (33 Pruefungen), 5 neue in
`tests/admin-meldungen.spec.js`, 4 neue in `tests/admin-statistik.spec.js`.

**Suite: 555 -> 577 Tests, alle gruen.**


## Session 26. August 2026 (Teil 16) - Die Warnungen im Chat

Im Chat schreibt ein Minderjaehriger mit einem fremden Erwachsenen. Seit dem 22.8. gibt es dort Hinweise bei Kontaktdaten, Geldforderungen und Treffen unter vier Augen.

**Geprueft wurde die Erkennung nie.** Sie steckte in `js/chat.js` hinter einem Supabase-Import und lief in keinem einzigen Test - dieselbe Lage wie bei der Trefferlogik des Job-Alarms.

Herausgezogen nach `js/chat-warnung.js`. Dabei kamen zwei Befunde heraus.

### Befund 1: E-Mail-Adressen wurden gar nicht erkannt
Erkannt wurden Telefonnummern und die Namen anderer Messenger - aber **"schreib mir an max@gmail.com" ging glatt durch**. Dabei ist genau das der haeufigste Weg, den geschuetzten Chat zu verlassen.

Ergaenzt. Bewusst einfach gehalten: Es geht nicht um Gueltigkeit nach RFC, sondern darum, dass da offensichtlich eine Adresse steht.

### Befund 2: Fehlalarm bei Terminabsprachen
Vor der Suche nach einer Ziffernfolge werden Trennzeichen entfernt - auch **Leerzeichen**. Aus *"Ich kann am 12 03 2026 anfangen"* wurde damit `12032026`, und eine harmlose Absprache bekam eine Warnung wegen Kontaktdaten.

Das Tueckische: An `12.03.2026` **hatte** jemand gedacht - Punkte werden ausdruecklich nicht entfernt, mit Kommentar. An dieselbe Schreibweise mit Leerzeichen nicht.

Behoben: Zifferngruppen werden nur noch als Nummer gewertet, wenn mindestens eine Gruppe drei oder mehr Ziffern am Stueck hat. Datum und Uhrzeit bestehen aus ein-, zwei- und vierstelligen Gruppen (`12 03 2026`, `14 30`); eine Telefonnummer hat immer eine laengere Gruppe (`0176`, `1234567`).

**Warum das wichtiger ist, als es klingt:** Eine Warnung, die bei jeder Terminabsprache aufpoppt, liest nach drei Tagen niemand mehr. Ein Fehlalarm beschaedigt genau die Hinweise, auf die es im Ernstfall ankommt.

### `tests/chat-warnung.spec.js` (22 Pruefungen)
E-Mail in mehreren Schreibweisen · Handynummer mit Bindestrichen und Klammern · fuenf Messenger-Namen · **neun harmlose Nachrichten, die nichts ausloesen duerfen** (Terminabsprachen, Uhrzeiten, Jahreszahlen, Klassenstufe, Stundenlohn) · Vorkasse, Gebuehr mit Umlaut, Gutscheinkarte · Einladung in die Wohnung und "komm allein", aber nicht ein normaler Treffpunkt im Laden.

Dazu zwei Pruefungen an der Einbindung: Die Warnung erscheint nur an **fremden** Nachrichten (sich selbst zu warnen waere sinnlos), und jede Warnart hat einen Text.

**Gegenprobe gemacht:** Mit der alten Erkennung fallen genau drei Tests um - beide E-Mail-Pruefungen und der Fehlalarm bei `12 03 2026`.

**Suite: 513 -> 535 Tests, alle gruen.**

## Session 26. August 2026 (Teil 15) - Der Job-Finder endete in einer Sackgasse

Angesehen wurde der **Job-Finder**, den ich bisher nie geprueft hatte. Die Startseite verspricht: *"Fuenf Fragen, eine Minute - danach hast du vier Vorschlaege, die zu dir passen."*

### Was gut ist
Die Bewertung ist solide gebaut. **Das Alter ist ein harter Filter**, kein Wunsch (`if (job.ab > antworten.alter) return -1`) - es wird also nie etwas vorgeschlagen, das man nicht machen darf. Der Rest laeuft ueber Punkte statt harter Filter, damit bei ungewoehnlichen Kombinationen nicht plotzlich nichts uebrig bleibt.

Geprueft: Fuer 13-Jaehrige stehen 6 der 18 Ideen zur Verfuegung - vier Vorschlaege gehen also immer auf, ein Leerzustand ist gar nicht moeglich.

### Was fehlte
**Am Ende wurde das Ergebnis weggeworfen.** Der Test lernt Alter und Vorlieben, und der Knopf hiess dann *"Jobs in meiner Naehe"* und fuehrte auf die **ungefilterte** Jobboerse.

Ein 13-Jaehriger klickte sich also durch fuenf Fragen und landete anschliessend zwischen Anzeigen ab 16.

### Behoben
- Alle 18 Ideen haben jetzt eine `kategorie`, die **genau** so heisst wie in der Jobboerse.
- Der Hauptknopf heisst *"Jobs fuer mein Alter"* und traegt `?alter=` in der Adresse - die Beschriftung sagt, was passiert.
- **Jede Ergebniskarte** bekommt einen eigenen Weg: *"Solche Jobs in deiner Naehe"* mit Kategorie **und** Alter.

`jobs.html` versteht beide Parameter laengst (`lieseUrlParameter()`), es war nur nie jemand auf die Idee gekommen, sie hier zu benutzen.

### Vier neue Tests
Der Hauptknopf traegt das Alter · jede der vier Karten hat einen Weg mit Kategorie und Alter · **die Kategorien im Finder gibt es auch wirklich in der Jobboerse** (Schreibweise abgeglichen - sonst greift der Filter still nicht und die Liste bleibt einfach leer) · und einmal wirklich geklickt, mit Pruefung, dass der Filter drueben ankommt.

### Zwei eigene Stolperer
1. Meine Antworttexte in den neuen Tests waren **geraten** ("Nachmittags" statt "Ein paar Stunden nach der Schule"). Die echten stehen in `js/job-finder.js` - die bestehenden Tests hatten sie korrekt.
2. Ein **bestehender Test** pruefte die alte Knopfbeschriftung und fiel um. Richtig so: Ich hatte sie absichtlich geaendert. Angepasst samt Begruendung im Kommentar.

**Suite: 509 -> 513 Tests, alle gruen.**

## Session 26. August 2026 (Teil 14) - Der unsichtbare Knopf in der Zusage-Mail

Angesehen wurde etwas, das bisher niemand geprueft hatte: die **Texte der automatischen E-Mails**. Eine Absage geht an einen 14-Jaehrigen; wie die formuliert ist, zaehlt.

**Die Texte sind gut.** Die Absage sagt *"das sagt nichts ueber dich aus"* und *"Bleib dran"* statt einer Floskel. Daran war nichts zu tun.

### Aber die Knoepfe darin hatten zwei Probleme in einer Zeile
```
background:linear-gradient(120deg,#00c896,#2b2f8f);color:#fff
```

**1. Kontrast.** Weisse Schrift auf `#00c896` kommt auf **2,16:1**. Am gruenen Ende des Verlaufs war der Knopftext kaum zu lesen - derselbe Befund, der am selben Tag schon die Web-Knoepfe betraf.

**2. Outlook kennt keine CSS-Verlaeufe.** Sein Renderer stammt aus Word. Die Kurzform `background:` mit einem Verlauf als einzigem Wert ist fuer ihn ungueltig und faellt **komplett weg** - uebrig bleibt weisse Schrift auf weissem Grund. Der Knopf war dort schlicht **unsichtbar**.

Betroffen: die Verifizierungs-Mail, die Firmen-Freischaltung und die **Zusage** - die wichtigste Mail, die diese Seite ueberhaupt verschickt.

### Behoben
`background-color` als deckender Rueckfall plus `background-image` fuer den Verlauf. Wer Verlaeufe kann, sieht sie; alle anderen sehen eine dunkle Flaeche mit lesbarer Schrift. Der Verlauf beginnt jetzt bei `#00795c` statt `#00c896` - **5,4:1 statt 2,16:1**.

Gleiches Vorgehen beim schmalen Zierbalken oben im Mailrahmen, in allen drei Funktionen: In Outlook fehlte er bisher ersatzlos.

### `tests/mail-knoepfe.spec.js` (5 Pruefungen)
Die Edge Functions lassen sich hier nicht ausfuehren (Deno, Datenbank, Resend) - aber genau diese Fehlerklasse ist am **Quelltext** erkennbar. Geprueft wird: keine `background:`-Kurzform mit Verlauf · jeder Knopf mit weisser Schrift hat einen dunklen Rueckfall (gerechneter Kontrast) · auch der **Anfang** des Verlaufs ist dunkel genug (die Farbe, die Verlaufs-faehige Clients am linken Rand zeigen) · alle Nutzerwerte werden escaped · jede Mail nennt einen Weg zum Abbestellen.

**Gegenprobe gemacht:** gegen den alten Stand meldet der Test alle vier Stellen namentlich.

**Suite: 504 -> 509 Tests, alle gruen.**

## Session 26. August 2026 (Teil 13) - Die ungeprueften Zeilen

Der Job-Alarm ist seit Teil 7/8 fertig gebaut. Aber ein Stueck davon war **voellig ungeprueft**: die Logik, die entscheidet, welche Anzeigen ein Schueler zugeschickt bekommt.

Sie steckte mitten in der Edge Function - und die laesst sich ohne Datenbank und ohne Deno-Laufzeit nicht ausfuehren. Also lief sie in keinem einzigen der 480 Tests.

**Warum das ausgerechnet hier zaehlt:** In dieser Logik sitzt die Altersgrenze. Wer sie falsch herum schreibt, schickt einem 13-Jaehrigen Anzeigen ab 16 zu. Auf einer Plattform fuer Minderjaehrige ist das kein Schoenheitsfehler.

### Herausgezogen
Neu: `supabase/functions/mail-job-alarm/treffer.js` - reines JavaScript, ohne Deno- oder Supabase-Abhaengigkeiten. Die Edge Function importiert es, und die Testsuite laedt **dasselbe Modul** ueber den Testserver (der liefert das ganze Projektverzeichnis aus).

Kein nachgebauter Zwilling also, sondern der Code, der spaeter wirklich laeuft.

### `tests/job-alarm-treffer.spec.js` (24 Pruefungen)
**Altersgrenze:** zu jung -> nein · genau das Mindestalter -> ja · ein Jahr zu jung -> nein · ohne Mindestalter an der Anzeige -> nicht ausschliessen · ohne Altersangabe im Profil -> nicht ausschliessen.

**Ort:** innerhalb/ausserhalb des Umkreises · groesserer Umkreis holt den Job zurueck · die gerechnete Entfernung Muenchen-Augsburg liegt zwischen 45 und 65 km · ohne Koordinaten Vergleich ueber den Ortsnamen, unabhaengig von Gross-/Kleinschreibung und Leerzeichen · Alarm ohne Ort schraenkt nicht ein.

**Kategorie, Arbeitszeit, Lohn:** leer heisst "egal", nicht "muss leer sein" · genau der Mindestlohn reicht · **eine Anzeige ohne Lohnangabe erfuellt keinen Mindestlohn** (sonst bekaeme jemand mit "ab 12 EUR" Anzeigen ganz ohne Angabe).

**Keine Wiederholungen:** was vor der letzten Mail da war, geht nicht erneut raus · der Zeitpunkt selbst zaehlt als schon geschickt · eine Sekunde spaeter geht raus.

### Gegenprobe
Den Altersvergleich absichtlich umgedreht (`>` zu `<`): **13 Tests fallen um**, darunter beide Alterspruefungen. Die Tests pruefen also wirklich etwas.

### Nachgetragen in OFFENE-PUNKTE.md
Beim Deployen der Edge Function muessen jetzt **beide Dateien** mit: `index.ts` und `treffer.js`. Ohne die zweite startet die Funktion nicht.

### Nebenbei: ein wirklich wackliger Test, endlich erklaert
Im vollen Lauf fiel zum zweiten Mal an diesem Tag `jobs-filter.spec.js` um - *"jeder Filter im Panel hat eine sichtbare Beschriftung"*. Beim ersten Mal hatte ich es als Flakiness abgetan. Zweimal ist keine Flakiness mehr.

Isoliert bestand der Test **sechsmal hintereinander**. Der Vergleich mit seinen zwei Nachbartests brachte es:

```js
// Nachbarn:            goto -> auf .job-card warten -> klicken
// Der wacklige Test:   goto -> sofort klicken
```

`js/jobs.js` ist ein **ES-Modul** und wird asynchron geladen; erst danach haengt der Klick-Handler am Knopf. Wer sofort klickt, trifft womoeglich einen Knopf, der noch nichts tut - der Klick verpufft, das Panel oeffnet nie. Unter Parallellast laedt das Modul langsamer, und die Wettlaufsituation geht verloren.

Behoben im Helfer `oeffneFilter()` selbst, nicht nur im einen Test: Er wartet jetzt auf eine sichtbare Job-Karte als Beleg, dass das Modul gelaufen ist. Die Begruendung steht als Kommentar daneben.

**Suite: 480 -> 504 Tests, alle gruen.**

## Session 26. August 2026 (Teil 12) - Wenn etwas nicht mehr da ist

Ein offener Faden aus der Google-Jobs-Runde: Was passiert eigentlich, wenn eine Anzeige verschwunden ist?

### Befund 1: Tote Anzeigen blieben im Index
`job.html` ist eine **statische Datei** und liefert immer HTTP 200 - der Job kommt erst per Abfrage dazu. Google sieht also nie eine 404 und behaelt die Adresse. Bei Stellenanzeigen ist genau das unerwuenscht: Wer aus der Google-Jobsuche kommt, landet auf einer Anzeige, die es nicht mehr gibt.

Dazu blieb der Titel auf *"Minijob fuer Schueler - SchuelerMatch"* stehen, obwohl die Seite "Job nicht verfuegbar" anzeigte.

**Behoben** durch ein nachtraeglich gesetztes `noindex` - Google wertet die robots-Angabe nach dem Ausfuehren des JavaScripts aus. Der Titel wird gleich mitgesetzt.

**Die wichtige Unterscheidung:** Bei einer **Stoerung** wird ausdruecklich KEIN `noindex` gesetzt. Die Anzeige gibt es dann vermutlich noch, nur die Verbindung klemmt. Sie deswegen aus dem Index zu werfen waere schlimmer als das Problem. Ein eigener Test haelt das fest.

### Befund 2: Meine eigene Ratgeber-Kachel log
Die Kachel *"Lebenslauf erstellen - kostenlos, in wenigen Minuten"* fuehrte direkt in eine Anmelde-Sperre: `lebenslauf.html` ruft `requireAuth('schueler')` auf. Beim Bauen der Uebersicht in der Runde davor hatte ich das nicht geprueft.

Jetzt steht **"Konto noetig"** als Vermerk in der Ueberschrift der Kachel - bewusst dort und nicht nur im Fliesstext, weil Kacheln ueberflogen werden.

### Nebenbei geprueft, alles in Ordnung
`robots.txt` existiert und sperrt die Dashboards sowie die Passwort-Seiten aus. `admin.html`, `lebenslauf.html`, `404.html` und `job-alarm-aus.html` tragen alle `noindex`.

### `tests/verschwundene-anzeige.spec.js` (6 Pruefungen)
Pausierte Anzeige -> noindex und ehrlicher Titel · fehlende Kennung ebenso · **Stoerung -> KEIN noindex** · vorhandene Anzeige bleibt indexierbar · der Ratgeber nennt die Anmeldepflicht · und eine Liste `MIT_ANMELDUNG`, die dafuer sorgt, dass jede kuenftige Kachel mit Anmeldepflicht denselben Vermerk bekommt - und jede ohne ihn nicht traegt.

**Gegenprobe gemacht:** gegen den alten Stand fallen genau die beiden noindex-Pruefungen um.

### Und ein selbstgemachter Nachschlag
Der neue Vermerk ist ein zweites `<span>` INNERHALB des `<b>` der Kachel. Mein Ratgeber-Test aus der Runde davor griff mit `k.locator('span')` alle spans - und brach ab, weil die Auswahl nicht mehr eindeutig war. Behoben mit dem direkten Kindselektor `> span`.

Ein Test, den man beim naechsten Ausbau der Kacheln mit anfassen muss. Das steht jetzt als Kommentar daneben.

**Suite: 474 -> 480 Tests, alle gruen.**

## Session 26. August 2026 (Teil 11) - Der Fehler, den ich selbst gebaut hatte

Diese Runde begann mit einer Zaehlung: Wohin verlinkt die Startseite eigentlich?

```
  4 job-finder.html      2 jugendarbeitsschutz.html      1 ferienjob.html
  3 jobs.html            2 eltern.html                   1 taschengeld.html
  3 jobideen.html                                        1 fairer-lohn.html
```

**Ferienjob, Taschengeld und Fairer Lohn kamen genau einmal vor - und zwar im Footer.** Kein einziger Link aus dem Inhalt. Zwei dieser Seiten hatte ich am selben Tag selbst gebaut und jeweils bloss in den Footer gehaengt. Dort sterben Links.

Besonders unguenstig beim Ferienjob: Wenn im Oktober die Herbstferien anfangen, findet die Seite niemand - die Seite mit dem Countdown, die genau dann etwas wert ist.

### Warum keine fuenfte Kachel auf der Startseite
Der naheliegende Ort waere die Wege-Sektion gewesen ("Womit faengst du an?", vier Kacheln fuer vier Absichten). Aber `.wege-grid` hat `repeat(4, 1fr)` - eine fuenfte Karte haette allein in der zweiten Zeile gestanden, auf ein Viertel Breite gestreckt. Das Raster auf fuenf Spalten umzustellen haette alle Karten gequetscht.

### Stattdessen: ein Eintrag in der Hauptnavigation
Die Navigation hatte vier Eintraege und deckte nur Suchwege ab (Jobs, Job-Finder, Jobideen, Fuer Arbeitgeber). Ein fuenfter - **Ratgeber** - deckt die andere Absicht ab: *erst mal wissen, was ueberhaupt gilt.*

Das skaliert auch: Kuenftige Ratgeberseiten kommen auf die Uebersicht, nicht in die Navigation.

**Neu: `ratgeber.html`** - nach Zielgruppe getrennt (Schueler / Eltern), jede Kachel mit einem Satz, was einen dort erwartet. Ganz oben steht, was man lesen sollte, wenn man nur eine Sache liest: den Jugendarbeitsschutz. Alles andere folgt daraus.

### Der Test, der den Fehler kuenftig verhindert
`tests/ratgeber.spec.js` fuehrt eine Liste `RATGEBERSEITEN` und prueft, dass **jede davon auf der Uebersicht verlinkt** und **von der Startseite aus in zwei Klicks erreichbar** ist. Wer eine neue Ratgeberseite baut, traegt sie dort ein - und der Test meckert, bis sie auch verlinkt ist.

Dazu: Kacheln muessen eine Erklaerung haben (nicht nur eine Ueberschrift), duerfen nicht wie Fliesstext-Links unterstrichen sein (dieselbe `.legal-page a`-Falle wie bei den Knoepfen), und der Ratgeber muss in der **Navigation** stehen, nicht nur im Footer.

### Zwei Funde beim Testlauf
**1. `navigation.spec.js` schlug an - zu Recht.** Der Test haelt die Soll-Menueleiste fest und meldete acht Seiten, auf denen sie sich geaendert hatte. Genau dafuer gibt es ihn: Er entstand am 25.8., nachdem beim Wachstum **fuenf verschiedene Navigationen** entstanden waren.

**2. Eine Seite fiel NICHT durch - und das war der eigentliche Hinweis.** `jobideen.html` bestand weiter, weil sie den neuen Eintrag gar nicht bekommen hatte. Grund: Sie markiert ihren eigenen Menuepunkt mit `aria-current="page"`, und mein Suchmuster verlangte exakt `<a href="jobideen.html">`. Ein bestandener Test kann also der auffaelligere Befund sein als ein fehlgeschlagener.

Nachgezogen: `ratgeber.html` markiert ihren eigenen Eintrag jetzt ebenfalls mit `aria-current` - so macht es jede Seite. Und der Navigationstest prueft jetzt **13 statt 9 Seiten**: `fairer-lohn`, `ferienjob`, `taschengeld` und `ratgeber` fehlten in seiner Liste, obwohl sie dieselbe Leiste tragen.

**Suite: 453 -> 474 Tests, alle gruen.**

## Session 26. August 2026 (Teil 10) - Taschengeldtabelle

Stand seit dem Wettbewerbsvergleich vom 25.8. auf der Ideenliste: *"Taschengeldtabelle (Nachschlagewerk, wird gesucht)"*. **schuelerjobs.de hat genau diese Seite.**

### Warum sie hierher gehoert
Nicht wegen des Themas - SchuelerMatch vermittelt Jobs, kein Taschengeld -, sondern wegen der **Zielgruppe**: Wer "Taschengeldtabelle" sucht, ist meistens ein Elternteil. Und Eltern sind bei Minderjaehrigen ohnehin die Instanz, die zustimmen muss (Art. 8 DSGVO). Ein Elternteil, das auf einer ernsthaften, sauber belegten Seite landet und dabei erfaehrt, dass das Kind sich auch selbst etwas verdienen koennte - das ist ein natuerlicher Weg, kein aufgesetzter.

### Der Fund beim Recherchieren
**Drei Quellen, drei verschiedene Tabellen.** Die Abweichungen liegen bei 10 bis 20 Euro pro Altersstufe - auch der Wettbewerber weicht ab und nennt keine Quelle.

Der Grund: **Es gibt keine amtliche Taschengeldtabelle.** Was kursiert, sind Empfehlungen. Die verbreitetste stammt vom **Deutschen Jugendinstitut** (Chabursky/Langmeyer, *Taschengeld und Gelderziehung*, September 2025, Datengrundlage DJI-Survey 2023). Zwei unabhaengige Quellen bestaetigen dieselben Zahlen.

Diese Seite nennt deshalb **ausdruecklich Quelle und Stand** und hat einen eigenen Abschnitt darueber, warum andere Seiten andere Zahlen zeigen. Wer vergleicht, kann so einordnen statt zu raten. Das ist der Unterschied zum Wettbewerber, der eine Tabelle hinstellt, als waere sie gesetzt.

### Inhalt
DJI-Tabelle nach acht Altersstufen · warum der Takt bei 10 Jahren von woechentlich auf monatlich wechselt (Planungsfaehigkeit) · **Budgetgeld ab 12** als eigenes Konzept · der Vergleich mit einem Nebenjob · vier haeufige Fragen (Bedingungen knuepfen, Taschengeldparagraf § 110 BGB, Kindergeld, Minijob-Grenze).

**Bewusst NICHT geschrieben:** dass Taschengeld ueberfluessig sei, wenn man arbeiten kann. Beide erfuellen verschiedene Zwecke - Taschengeld gibt es bedingungslos und lehrt Einteilen, selbstverdientes Geld lehrt, was eine Stunde Arbeit wert ist. Ein Test haelt genau diesen Satz fest, damit ihn niemand spaeter wegkuerzt.

### Verlinkt
Footer aller 13 oeffentlichen Seiten · `sitemap.xml` · og-Tags samt Teilen-Bild · aufgenommen in die Seitenlisten von `a11y`, `kontrast`, `knopf-kontrast`, `tippziele-mobil` und `teilen-vorschau`.

`tests/taschengeld.spec.js` (11 Pruefungen) - darunter: nennt Quelle und Stand, sagt dass es keine Pflicht ist, erklaert die Abweichungen anderer Seiten, verwendet die korrigierte Minijob-Grenze von 603 statt 556 Euro.

**Suite: 437 -> 453 Tests, alle gruen.**

## Session 26. August 2026 (Teil 9) - Google Jobs: zwei stille Fehler

In der Launch-Liste steht *"sitemap.xml einreichen -> Jobs erscheinen in Google Jobs"*. Ob das klappt, entscheidet sich an der JSON-LD-Auszeichnung auf der Job-Detailseite. Die gab es - aber ungeprueft, und das Tueckische daran: **Fehlt eine Pflichtangabe, erscheint die Anzeige einfach nicht. Google meldet sich nicht.**

Ausgelesen, was tatsaechlich im Browser landet. Zwei Befunde:

### 1. `jobLocation` fiel still weg
```js
jobLocation: job.ort ? { ... } : undefined
```
Ohne Ort verschwand das Feld - und damit eine der **fuenf Angaben, die Google zwingend verlangt** (title, description, datePosted, hiringOrganization, jobLocation). Herausgekommen waeren ungueltige strukturierte Daten.

In der Datenbank haben aktuell alle vier Jobs einen Ort, der Fall trat also noch nicht ein. Das Job-Formular verlangt den Ort auch. Aber die Zeile war eine Falle fuer den ersten Job, bei dem es anders kommt.

**Jetzt wird lieber gar nichts ausgeliefert als etwas Unvollstaendiges** - eine fehlerhafte Auszeichnung kann der ganzen Seite schaden, eine fehlende kostet nur diesen einen Job.

### 2. `validThrough` fehlte immer
Ohne diese Angabe zeigt Google Stellenanzeigen unbegrenzt weiter - auch laengst besetzte. Jetzt **90 Tage ab Veroeffentlichung**. Das passt zur eigenen Logik der Seite, die eine Anzeige ab zwei Monaten als moeglicherweise veraltet kennzeichnet. Wird ein Job pausiert, liefert die Seite ohnehin "nicht verfuegbar" und gar keine strukturierten Daten mehr.

### Nebenbefund (nicht angefasst)
Alle vier Jobs in der Datenbank haben **keinen `firma_name`** - sie stammen von vor dem 25.8., als das Feld eingefuehrt wurde. In Google stuende bei ihnen "Arbeitgeber auf SchuelerMatch" statt eines echten Namens. Es sind bewusste Testdaten, deshalb unveraendert gelassen; neue Anzeigen bekommen den Namen mit.

Ebenfalls aufgefallen: `tests/helpers/fixtures.js` kennt `firma_name` gar nicht. Die Tests laufen damit immer ueber den Ersatzpfad. Der neue Test deckt beide Wege gezielt ab, statt die gemeinsamen Testdaten anzufassen und 430 andere Tests zu wackeln.

### Neu: `tests/google-jobs.spec.js` (7 Pruefungen)
Alle fuenf Pflichtangaben; Ort als `Place` mit Adresse statt als blosser Text; Datumsformat und `validThrough` nach `datePosted`; Stundenlohn mit `unitText: HOUR` (sonst liest Google es als **Jahresgehalt**); ohne Ort gar keine Daten; Titel als Ersatzbeschreibung; ohne Lohn bleibt die Anzeige gueltig; Firmenname; pausierter Job.

**Ein Test war zuerst falsch gebaut:** Er reichte einen pausierten Job per Mock durch und pruefte damit an der eigentlichen Schutzstelle vorbei - `job-detail.js` fragt mit `.eq('aktiv', true)`, ein pausierter Job kommt vom Server gar nicht erst zurueck. Jetzt bildet der Test genau das nach (PostgREST antwortet mit `PGRST116`) und prueft zusaetzlich, dass die Seite ueberhaupt auf `aktiv=true` filtert.

**Gegenprobe gemacht:** gegen den alten Stand faellt der Test auf beiden Befunden um.

**Suite: 430 -> 437 Tests, alle gruen.**

## Session 26. August 2026 (Teil 8) - Job-Alarm: die Oberflaeche

Zweiter Teil des Job-Alarms. Der Motor stand seit Teil 7, jetzt kommt die Bedienung dazu.

### Wo sie sitzt
**Unter der Jobliste, nicht darueber.** Wer dort ankommt, hat gerade durchgescrollt und nichts Passendes gefunden - genau dann ist ein Alarm etwas wert. Und genau dann stehen die Filter schon so, wie der Schueler sie haben will: Der Alarm **uebernimmt sie einfach**, statt ein zweites Formular zu verlangen.

Drei Zustaende: kein Alarm (Angebot), laeuft (zeigt die Kriterien, "Auf aktuelle Filter setzen" / "Ausschalten"), aus (Wiedereinschalten).

### Solange die Tabelle fehlt, ist die Karte unsichtbar
Die Datenbank-Aenderung aus Teil 7 steht noch aus. Statt einer Fehlermeldung blendet sich die Karte stumm aus - ein Schueler soll nichts von einer halbfertigen Baustelle mitbekommen. Ein Test sichert genau das ab, mit der Antwort, die PostgREST bei einer unbekannten Tabelle wirklich schickt (`42P01`).

### Zwei Funde beim Testen

**1. Ein echter Bug in meinem eigenen Code - und die Datei hatte gewarnt.**
`geocode()` gibt **nie `null`** zurueck, sondern immer ein Objekt mit `status`: `'ok'`, `'unbekannt'` oder `'gestoert'`. Mein `if (geo) { lat = geo.lat }` war deshalb immer wahr und schrieb bei unbekanntem Ort `undefined` in die Felder - die dann still aus dem JSON fielen.

`js/geo.js` erklaert im Kopfkommentar genau diese Unterscheidung, und zwar weil eine **fruehere Fassung desselben Fehlers Nutzern still ihre Koordinaten geloescht hat**: Wer nur seinen Namen aenderte, waehrend der Geo-Dienst klemmte, verschwand aus der Umkreissuche, ohne es zu merken.

Jetzt sauber unterschieden:
- `ok` -> uebernehmen
- `unbekannt` -> leeren, es wird ueber den Ortsnamen verglichen
- `gestoert` -> die bisherigen Koordinaten **nur behalten, wenn der Ort derselbe ist**. Bei einem neuen Ort werden sie verworfen; sie zeigten sonst auf die alte Stadt, und der Umkreis suchte am falschen Fleck.

Beide Faelle haben jetzt einen eigenen Test.

**Beinahe haette ich das ueberdeckt.** Der Test meldete `undefined` statt `null`; ein `toBeNull()` in ein `== null` zu aendern haette ihn gruen gemacht und den Bug verdeckt.

**2. Eine Luecke im Test-Helfer.**
`helpers/supabase-fake.js` beachtete den `vnd.pgrst.object`-Kopf nur bei GET. Nach `insert`/`update` kam trotzdem eine Liste zurueck, waehrend PostgREST ein Objekt liefert. Wer `.insert(...).select().single()` schreibt, bekam im Test ein Array und im Echtbetrieb ein Objekt - **ein Test konnte gruen sein, obwohl die Seite kaputt war**. Behoben; gilt jetzt fuer POST und PATCH genauso.

### Neu
`js/job-alarm.js`, Karte in `dashboard-schueler.html`, `aktuelleFilter()` in `js/dashboard-schueler.js` (liest dieselben Felder wie `wendeJobFilterAn()`), CSS.

`tests/job-alarm.spec.js` (9 Pruefungen): Angebot ohne Alarm; ohne Ort wird nichts gespeichert, sondern erklaert; Rueckfall auf den Wohnort aus dem Profil; Uebernahme aller Filter samt Koordinaten; unbekannter Ort; beide Geo-Stoerfaelle; Ausschalten; und die verborgene Karte bei fehlender Tabelle.

**Suite: 421 -> 430 Tests, alle gruen.**

## Session 26. August 2026 (Teil 7) - Job-Alarm: der Motor

Der Job-Alarm stand in OFFENE-PUNKTE.md als **staerkster Wachstums-Hebel**: Wer heute nichts Passendes findet, geht sonst und kommt nicht wieder.

**Zuschnitt dieser Runde: der Motor, noch ohne Oberflaeche.** Genau anders herum waere es falsch - eine Oberflaeche, mit der man einen Alarm anlegt, der dann keine Mails schickt, verspricht etwas, das nicht eingehalten wird. So kann noch niemand einen Alarm anlegen, und es geht auch nichts kaputt.

### Guenstiger Fund vorweg
Es gibt bereits `mail-digest`: eine Edge Function, die **einmal taeglich** laeuft und Arbeitgebern eine Sammel-Mail schickt statt einer Mail pro Bewerbung. Genau diese Form braucht der Job-Alarm auch - taeglich statt sofort, eine Mail statt vieler. Bei Minderjaehrigen ein Argument fuer sich.

### Gebaut
- **`supabase/job-alarm.sql`** - Tabelle `job_alarme`, RLS, Spalten-Trigger, Abmelde-Funktion.
  - **Ein Alarm je Schueler** (`unique` auf `schueler_id`). Mehrere Alarme heissen mehrere Mails und viel Verwaltung; wer die Kategorie leer laesst, bekommt ohnehin alles aus seiner Gegend.
  - `zuletzt_gesendet` steht beim Anlegen auf *jetzt*, damit nicht sofort alle Altbestaende als "neu" verschickt werden.
  - **Spalten-Trigger direkt mitgebaut** - die Lehre aus Teil 6 desselben Tages. `zuletzt_gesendet` und `abmelde_token` gehoeren eingefroren; das eine wuerde sonst erlauben, sich alte Anzeigen erneut schicken zu lassen, das andere ist der Schluessel zum Abmelden.
- **`supabase/functions/mail-job-alarm/index.ts`** - die taegliche Funktion.
- **`job-alarm-aus.html` + `js/job-alarm-aus.js`** - Abmelden per Ein-Klick-Link.

### Drei Entscheidungen, die Erklaerung verdienen

**1. Escaping.** `mail-digest` schreibt Job-Titel unescaped in die Mail. Dort geht sie an dieselbe Firma zurueck, die den Titel geschrieben hat - Selbstschaden, harmlos. Beim Job-Alarm gingen **von Arbeitgebern geschriebene Titel an Schueler**. Das ist eine ganz andere Lage; hier wird alles escaped. `mail-digest` wurde gleich mitgezogen, damit nicht zwei Regeln fuer dasselbe Problem existieren.

**2. Die Abmelde-Seite hat bewusst KEIN `gate.js`.** Sie wird aus einer E-Mail heraus aufgerufen. Wer sich abmelden will und erst ein Baustellen-Passwort eintippen soll, meldet sich nicht ab - er markiert die Mail als Spam. Dazu ein `List-Unsubscribe`-Kopfzeile, damit die Abmeldung auch direkt im Mailprogramm geht.

**3. Wiederholte Aufrufe sind harmlos.** Die Funktion ist wie ihre Schwestern oeffentlich erreichbar. Sie nimmt aber keine Eingaben entgegen, und nach dem Versand wird `zuletzt_gesendet` fortgeschrieben - der zweite Aufruf findet nichts mehr. Damit laesst sich niemand zuspammen. Fortgeschrieben wird **erst nach erfolgreichem Versand**: Schlaegt Resend fehl, wird es morgen erneut versucht, statt still zu verschwinden.

Ausserdem: Verschickt werden nur Jobs, die auch oeffentlich sichtbar sind (aktiv **und** Firma freigegeben - der Service-Role-Schluessel umgeht RLS, die Regel steht also von Hand in der Funktion), und nur solche, fuer die der Schueler **alt genug** ist.

### Offen: die Datenbank-Aenderung wurde blockiert
`apply_migration` lief in den Sicherheitsfilter der automatischen Freigabe. Die Datei `supabase/job-alarm.sql` ist fertig und muss von Sanad im Supabase-SQL-Editor ausgefuehrt werden (sie enthaelt keine Schluessel, Einfuegen ist also unproblematisch). Danach:
1. `supabase/functions/mail-job-alarm/index.ts` deployen
2. Zeitplan setzen, z.B. Cron `0 16 * * *`
3. Oberflaeche im Schueler-Dashboard bauen (naechste Runde)

### Getestet
`tests/job-alarm-abmelden.spec.js` (6 Pruefungen): gueltiger Token meldet ab und reicht ihn durch; ohne Token wird die Datenbank gar nicht erst gefragt; abgeschnittener Token wird erkannt (genau das machen Mailprogramme); Serverfehler nennt einen zweiten Weg; die Seite ist ohne Baustellen-Passwort erreichbar; `noindex` gesetzt.

Die Seite steht jetzt auch in den Listen von `a11y`, `kontrast` und `knopf-kontrast`.

**Suite: 412 -> 421 Tests, alle gruen.**

## Session 26. August 2026 (Teil 6) - Zugriffsregeln gesichert, zwei Loecher gefunden

Vorhaben war schlicht: Die RLS-Policies standen nur im Supabase-Dashboard, ohne Verlauf und ohne Referenz. Beim Auslesen kamen zwei Befunde heraus, die vorher niemand gesehen hatte.

### Befund 1 (behoben): `jobs` konnte verschenkt werden

Fuer fuenf Tabellen friert je ein BEFORE-UPDATE-Trigger die Spalten ein, die niemand aendern darf. **Fuer `jobs` gab es keinen** - die Tabelle war beim Security-Audit vom 26.7. uebersehen worden. Drei Dinge trafen dort zusammen:

1. Die Policy *"Firma bearbeitet eigene Jobs"* hat kein `WITH CHECK` - sie prueft nur, WELCHE Zeile angefasst werden darf, nicht wie die Zeile hinterher aussieht.
2. `authenticated` hat UPDATE-Recht auf **alle** Spalten von `jobs`, `firma_id` eingeschlossen.
3. Kein Trigger fing es ab.

Eine freigegebene Firma konnte damit an ihrem eigenen Job `firma_id` auf ein fremdes Konto setzen. Der Job wanderte dorthin - und mit ihm der Zugriff auf alles, was daran haengt: die Bewerbungen, die **Bewerberprofile** (Name, Alter, Schule, Ort, E-Mail, Foto von Minderjaehrigen), die **Zeugnisse** und die Chatverlaeufe.

Fremde Jobs uebernehmen ging nicht - das `USING` der Policy verhindert es. Nur eigene weggeben. Eine weitere Grenze fand sich beim Nachstellen: `jobs_firma_id_fkey` verlangt ein existierendes Konto als Ziel. Beliebige Fantasiewerte gehen also nicht; jedes echte Schueler- oder Firmenkonto aber schon.

**Nebenbei mitbehoben:** `erstellt_am` war ebenfalls frei aenderbar. Davon haengen das "NEU"-Abzeichen und die Altersangabe der Anzeige ab - eine Firma haette ihre Anzeige beliebig oft wieder auf "neu" stellen koennen.

**Behoben** durch `trg_schuetze_job` nach dem Muster der fuenf vorhandenen (Migration `schutz_trigger_jobs`, Sicherung in `supabase/schutz-trigger-jobs.sql`). Eingefroren werden `id`, `firma_id`, `erstellt_am`. **Bewusst nicht** `aufrufe`: Den Zaehler setzt `job_aufruf_zaehlen()` auch fuer eingeloggte Besucher hoch, ein eingefrorener Wert haette deren Aufrufe verschluckt.

**Nachgestellt und geprueft** in einer Transaktion mit Wegwerf-Zeile: Angriff wird abgewehrt (`firma_id` bleibt stehen), `erstellt_am` bleibt stehen, der Titel laesst sich weiter aendern. Die Zeile wurde im selben Zug wieder geloescht.

Beim Anwenden noch ein Detail gelernt: `revoke execute ... from anon, authenticated` laeuft ins Leere, weil das Recht von `PUBLIC` kommt. Erst `revoke ... from public` zog - jetzt sind alle sechs Schutz-Funktionen gleich abgesichert.

**Der Supabase-Advisor findet diesen Befund nicht.** Fehlendes `WITH CHECK` erkennt kein Linter; das faellt nur beim Lesen auf.

### Befund 2 (behoben): SQL-Dateien lagen oeffentlich im Netz

`schuelermatch.de/supabase/schutz-trigger.sql` lieferte **HTTP 200**. Wer die Adresse erriet, bekam das komplette Sicherheitsmodell der Datenbank als Textdatei. Ein Geheimnis stand nicht drin - der enthaltene Schluessel ist der oeffentliche anon-Key, der ohnehin im Frontend liegt - aber lesen koennen muss es auch niemand. Die neue Datei mit der vollstaendigen Zugriffskarte waere nach dem Push genauso oeffentlich gewesen.

`supabase/` steht jetzt in `.vercelignore`.

### Neu im Repo
- **`supabase/rls-stand.sql`** - alle 42 Policies, Zeilenschutz, Hilfsfunktionen und Eimer-Einstellungen, wiederholbar ausfuehrbar. Zusammen mit `schutz-trigger.sql` laesst sich die Zugriffskonfiguration komplett neu aufbauen. Am Ende stehen die Abfragen zum Vergleichen.
- **`supabase/schutz-trigger-jobs.sql`** - der neue Trigger samt Begruendung.
- **Zwei neue Pruefungen** in `tests/speicher.spec.js`: dass die internen Ordner in `.vercelignore` stehen, und dass im Repo kein Schluessel ausser dem anon-Key liegt (JWTs werden dekodiert und die Rolle geprueft).

**Suite: 410 -> 412 Tests, alle gruen.**

## Session 26. August 2026 (Teil 5) - Das Bild, das beim Teilen erscheint

**Befund:** Es gab **kein einziges** `og:image`. Wer einen SchuelerMatch-Link in eine WhatsApp-Gruppe warf, sah einen nackten Textkasten ohne Bild. Fuer eine Seite, deren Wachstum davon lebt, dass Schueler Jobs untereinander weitergeben, ist genau das der sichtbarste Moment ueberhaupt - und er war leer.

Schlimmer noch: `register.html` und `login.html` hatten **gar keine** og-Tags. Ein in eine Klassengruppe geteilter Anmelde-Link zeigte nur die blanke Adresse.

### Das Bild
`assets/og-bild.jpg`, 1200x630, 73 KB. Erzeugt aus `assets/og-vorlage.html` per Playwright-Aufnahme.

**Warum aus HTML statt als Grafikdatei:** So kommen Schrift und Farben aus derselben Quelle wie die Seite selbst. Ein separat nachgebautes Bild driftet beim naechsten Design-Wechsel auseinander. Die Vorlage liegt im Repo und ist von `.vercelignore` ausgenommen - sie soll nicht als Seite im Netz stehen.

### Zwei Dinge, die ohne Messung durchgerutscht waeren
**1. Der Verlauf.** Die Karte benutzt bewusst `#00795c -> #2b2f8f`, nicht den hellen Marken-Verlauf. Weisse Schrift auf `#00c896` kommt nur auf 2,2:1 - dieselbe Lehre wie bei den Knoepfen aus Teil 2.

**2. Der Akzent im Titel.** "Ohne Umwege." stand zuerst in der Markenfarbe `#00c896` und kam damit auf **2,87:1** - sogar unter den 3:1, die fuer grosse Schrift gelten. Jetzt `#6bf0cb`: 4,4:1. Gleiche Farbfamilie, nur heller, dieselbe Logik wie bei `logo-light.png`.

Gemessen wurde **pixelgenau**: die Karte zweimal aufgenommen, einmal mit und einmal ohne Text. Damit ist fuer jeden Schriftpixel die Farbe DARUNTER bekannt. Bei einem Verlauf im Hintergrund waere jeder Schaetzwert falsch gewesen - ein erster Versuch mit geschaetztem Grund lieferte Unsinn (1,17:1 fuer weisse Schrift), weil er die weichgezeichneten Buchstabenraender als Hintergrund las.

Endstand: Titel weiss 5,99 · Titel mint 4,42 · Unterzeile 5,30 · Fusszeile 7,27 · Etiketten 5,87.

### JPEG statt PNG
Als PNG wog die Karte **374 KB** - die Datei ist im Wesentlichen ein Farbverlauf, den PNG verlustfrei speichern muss. WhatsApp zeigt oberhalb von rund 300 KB gar keine Vorschau mehr. Als JPEG mit Guete 92: **73 KB**, ohne sichtbaren Verlust.

### Neu: `tests/teilen-vorschau.spec.js` (15 Pruefungen)
Prueft genau das, was man selbst nie sieht, weil es in einer fremden App gerendert wird:
- jede der 12 Seiten hat `og:image`, `og:title`, `og:description`, `twitter:card`
- die Adresse ist **absolut** (relative Pfade loesen WhatsApp und Facebook nicht auf) und zeigt auf die eigene Domain
- die Datei existiert, laesst sich laden, ist unter 300 KB
- die angegebenen Masse stimmen mit der Datei ueberein, Seitenverhaeltnis 1,91:1
- alle Seiten zeigen auf dasselbe Bild (sonst wird beim Aendern eine vergessen)
- die Vorlage liegt im Repo, damit das Bild reproduzierbar bleibt

**Gegenprobe gemacht:** `og:image` aus `index.html` entfernt -> der Test faellt um.

**Suite: 395 -> 410 Tests, alle gruen.**

## Session 26. August 2026 (Teil 4) - Sagt die Datenschutzerklaerung die Wahrheit?

Die Runde begann mit einer Absicherung: Die Kontrastmessung aus Teil 3 lief nur im hellen Modus. Gibt es einen Dunkelmodus, koennte `#00795c` dort genau das kaputt gemacht haben, was gerade repariert wurde.

**Entwarnung:** Der Dunkelmodus wurde im August entfernt (`e920946`). Kein Risiko.

**Aber beim Nachsehen fiel etwas anderes auf:** Die Datenschutzerklaerung nennt die *"Hell-/Dunkel-Einstellung"* immer noch als gespeicherten Wert - Monate nachdem die Funktion verschwunden ist.

Das fuehrte zu einem systematischen Abgleich: **Stimmt ueberein, was der Code tut und was die Erklaerung behauptet?**

### Befund 1: gespeicherte Werte
| Schluessel | Wozu | in Abschnitt 7? |
|---|---|---|
| `cv-draft-<id>` | Lebenslauf-Entwurf | genannt |
| `cv-design-<id>` | PDF-Layout und Farbe | genannt |
| `onboarding-weg-<id>` | "Erste Schritte" ausgeblendet | genannt |
| `gesehen-<rolle>-<id>` | gesehene Benachrichtigungen | genannt |
| `sm-bundesland` | Bundesland Ferienjob-Seite | **fehlte** |
| Hell-/Dunkel | gibt es nicht mehr | **stand noch drin** |

Der fehlende Schluessel war **mein eigener** - in Teil 1 desselben Tages eingefuehrt, ohne die Erklaerung anzufassen. Genau die Sorte Fehler, die niemandem auffaellt, weil Code und Rechtstext an voellig verschiedenen Stellen liegen.

`sm-zugang-ok` (Bauphasen-Sperre, sessionStorage) bleibt bewusst ungenannt - technisch notwendig, verschwindet zum Launch. Die Begruendung steht im Test.

### Befund 2: Fremdserver
Jeder Host, den die Seite von sich aus kontaktiert, bekommt die IP-Adresse des Besuchers zu sehen. In Deutschland ist das kein theoretisches Risiko - Google Fonts von einem Fremdserver zu laden hat schon Abmahnungen ausgeloest.

Abschnitt 5 nannte Supabase, Vercel, Resend, Open-Meteo, Google Fonts und cdnjs. **Nicht genannt: `cdn.jsdelivr.net`** - von dort laedt `js/supabase.js` die Datenbank-Bibliothek, also auf praktisch jeder Seite. Ergaenzt.

### Neu: `tests/speicher.spec.js` (5 Pruefungen)
Der Test kann den Rechtstext nicht auf Richtigkeit pruefen. Er kann aber Alarm schlagen, sobald sich der **Bestand** aendert:
- neuer Speicher-Schluessel im Code -> faellt um
- Schluessel entfaellt, steht aber noch im Text -> faellt um
- neuer Fremdserver im Code -> faellt um, mit Namen und Fundstelle
- Dunkelmodus wieder im Text, obwohl nicht im Code -> faellt um
- **Sentry**: Sobald jemand den DSN eintraegt (heute leer, also kein Netzwerkverkehr), verlangt der Test die Nennung als Auftragsverarbeiter. Das stand bisher nur als Merkposten in OFFENE-PUNKTE.md.

**Gegenproben gemacht:** Fake-Schluessel eingebaut -> faellt um. Alten Text eingespielt -> faellt um. jsDelivr aus dem Text entfernt -> faellt um, mit der Meldung `cdn.jsdelivr.net - als "jsDelivr" nicht genannt (js/supabase.js)`.

**Suite: 390 -> 395 Tests, alle gruen.**

## Session 26. August 2026 (Teil 3) - Kann man den Text eigentlich lesen?

Sanad hatte gefragt, wofuer das Coral-Orange ueberhaupt da ist, und dann entschieden: *"mach was am besten ist und du fuer richtig haeltst."*

Aus der einen Farbfrage wurde ein Befund ueber die ganze Seite.

### Der blinde Fleck
Alle bisherigen Pruefungen fragen, ob Elemente **da**, **gross genug** oder **bedienbar** sind. Keine fragte, ob man den Text **lesen** kann. Farbe fiel ueber Monate durch das Raster.

Eine Messung aller Textknoten auf 14 Oberflaechen (12 oeffentliche Seiten + beide Dashboards) ergab rund **90 Stellen unter dem geforderten Kontrast**:

| Stellen | Was | gemessen | noetig |
|---|---|---|---|
| ~48 | Marken-Gruen `#00a87d` als Fliesstextfarbe | 2,9-3,0:1 | 4,5:1 |
| 6 | Warnfarbe `#ff6b4a` als Schrift | 2,7-2,8:1 | 4,5:1 |
| 1 | Passwort-Anzeige "Okay" bei der Registrierung | **1,86:1** | 4,5:1 |

### Behoben an den Token, nicht an den Regeln
- **`--match-green-dark`: `#00a87d` -> `#00795c`** (5,1:1). Dieses Token ist fast ausschliesslich Schriftfarbe - Verweise im Fliesstext, Lohnangaben, Status-Etiketten, Zwischenueberschriften. Der Ton kam nicht von aussen: Er steckte schon als Anfang von `--verlauf-tief` in der Palette.
- **`--coral`: `#ff6b4a` -> `#a5442c`** (6,1:1). Erst war `#b04a30` vorgesehen; auf den blassen Coral-Toenungen der Status-Etiketten landete der aber bei **4,48** - genau auf der Kante. Ein Ton tiefer haelt dort 5,2:1.
- **`js/auth.js`**: Balkenfarbe und Schriftfarbe der Passwort-Anzeige getrennt. Der Balken ist eine Grafik und darf kraeftig bleiben; die Beschriftung daneben braucht Lesbarkeit. Vorher benutzten beide dieselbe Farbe.
- **`js/gate.js`**: Fehlertext im Zugangs-Overlay mitgezogen.

**`--match-green` (`#00c896`) blieb unangetastet.** Das ist die Markenfarbe fuer Flaechen, Logo, Verlaeufe und Schrift auf dunklem Grund - dort ist sie richtig. Geaendert wurde nur, was als kleine Schrift auf hellem Grund steht. Wichtig nach der zurueckgenommenen Palette vom Vortag: **Das hier ist kein Farbwechsel, sondern ein Abdunkeln derselben Farben.**

### Vorher geprueft, nicht angenommen
Die Sorge war, dass ein dunkleres Coral auf dunklem Grund umkippt (`#a5442c` kommt auf `--ink` nur auf ~3:1). Eine Messung aller sichtbaren Coral-Stellen zeigte: **Coral steht nirgends auf dunklem Grund.** Die Klasse `.eyebrow-light` heisst nur so, sitzt aber auf hellem Papier.

### Zwei Fehlalarme der eigenen Messung
Beide behoben, beide in `helpers/kontrast.js` dokumentiert - ein Test, der falsch Alarm schlaegt, wird irgendwann ignoriert:
1. Ein durchsichtiger Knopf sass auf einer **dunklen Karte**; gemessen wurde gegen die helle Seitenfarbe (1,06:1 gemeldet, in Wirklichkeit einwandfrei).
2. Die Onboarding-Karte hat einen Verlauf aus fast durchsichtigen Stopps (Alpha 0,06). Als deckend gerechnet ergab das 1,59:1, obwohl dort dunkle Schrift auf fast weissem Grund steht.

Die Messung sammelt jetzt alle Schichten zwischen Text und Seite ein und rechnet sie von unten nach oben uebereinander.

### Neu: `tests/kontrast.spec.js` (15 Pruefungen)
12 oeffentliche Seiten, beide Dashboards, plus die Passwort-Anzeige mit drei verschiedenen Eingaben - die erscheint erst beim Tippen und waere der Flaechenmessung sonst entgangen.

**Gegenprobe gemacht:** gegen den Stand von vorher faellt der Test auf **allen 15** Pruefungen um.

**Suite: 375 -> 390 Tests, alle gruen.**

## Session 26. August 2026 (Teil 2) - Gruene Schrift auf gruenem Knopf

Gefunden auf dem Bildschirmfoto der frisch gebauten Ferienjob-Seite: "Ferienjobs ansehen" stand gruen auf gruenem Verlauf. Die Ursache war keine neue Zeile, sondern eine alte:

```
.legal-page a { color: var(--match-green-dark); text-decoration: underline; }
```

Diese Regel ist **spezifischer als** `.btn-green` (Klasse + Typ schlaegt Klasse allein) und faerbte damit jeden Knopf ein, der als `<a>` in einer Ratgeberseite steht.

**Gemessen: 1,77:1** statt der vorgesehenen 5,4:1. Gefordert sind 4,5:1. Betroffen waren `fairer-lohn.html`, `jobideen.html`, `fuer-firmen.html` - und die neue `ferienjob.html` gleich mit. Auf den ersten dreien seit Monaten unentdeckt.

**Warum keiner der bestehenden Tests das fand:** Sie pruefen, ob Elemente da, gross genug und bedienbar sind - nicht, ob man ihre Schrift lesen kann. Der Tippziel-Test misst Flaechen, der a11y-Test Struktur und Beschriftungen. Farbe fiel durch das Raster.

**Fix:** `.legal-page a.btn` holt Knopffarbe und fehlende Unterstreichung zurueck. Nach der Aenderung ueberall **5,4:1**.

**Neu: `tests/knopf-kontrast.spec.js`** (11 Seiten). Rechnet den WCAG-Kontrast jeder Knopfschrift gegen ihren tatsaechlichen Hintergrund - bei Verlaeufen gegen die schlechtere Endfarbe, bei durchsichtigen Knoepfen gegen den ersten undurchsichtigen Vorfahren.

Der letzte Punkt kam aus einem **Fehlalarm des eigenen Tests**: Auf der Startseite sitzt ein durchsichtiger Knopf auf einer dunklen Karte. Die erste Fassung mass gegen die Seitenfarbe und meldete 1,06:1, obwohl weiss auf dunkler Karte einwandfrei ist. Ein Test, der falsch Alarm schlaegt, wird irgendwann ignoriert - deshalb laeuft er jetzt die Vorfahren hoch.

**Gegenprobe gemacht:** Test gegen das alte CSS laufen lassen - er faellt auf genau den vier betroffenen Seiten um. Er prueft also wirklich etwas.

**Suite: 364 -> 375 Tests.**

## Session 26. August 2026 - Ferienjob: der Bereich, der zur Jahreszeit passt

Sanad hat aus vier Vorschlaegen den Ferienjob-Bereich gewaehlt. Saisonal der richtige Zeitpunkt: Die Herbstferien beginnen je nach Bundesland zwischen dem 5. Oktober und dem 2. November, gesucht wird also **jetzt**.

**Befund vorweg:** "Ferienjob" gab es laengst - als Wert der Spalte `arbeitszeit`, als Auswahl im Job-Formular und als Filter-Option in der Jobboerse. Was fehlte, war jede Erklaerung, was in den Ferien ueberhaupt gilt. Die **4-Wochen-Regel** (max. 4 Wochen im Kalenderjahr, nur in den Ferien) kennt kaum ein Schueler, obwohl der ganze Ferienjob daran haengt.

### Gebaut
- `ferienjob.html` - Regeln, Verdienst, Bewerbungszeitpunkt
- `js/ferien.js` - Ferienkalender: 16 Bundeslaender x 4 Zeitraeume, dazu die Datumsrechnerei
- `js/ferienjob.js` - Bundesland waehlen, Countdown, Terminliste

**Der Countdown ist der eigentliche Grund fuer die Seite.** Er beantwortet die Frage, mit der jemand herkommt: "Wann habe ich frei, und lohnt sich das Suchen jetzt schon?" Die Wahl des Bundeslands wird gemerkt.

### Warum die Termine fest im Code stehen
Naheliegend waere `ferien-api.de` gewesen - die antwortete beim Bauen aber mit **HTTP 429**. Ein Countdown, der leer bleibt, sobald ein Fremddienst hustet, ist schlechter als eine gepflegte Tabelle. Und ein einmal festgelegter Ferientermin aendert sich nicht mehr.

**Wartung:** Der Bestand reicht bis zu den Sommerferien 2027. Danach ergaenzen. Laeuft er aus, sagt die Seite das ehrlich ("Keine Termine hinterlegt") statt veraltete Angaben zu zeigen - ein Test deckt genau diesen Fall ab.

### Inhalt
4-Wochen-Regel als Jahresbudget · 8 Std/Tag, 40 Std/Woche, 6-20 Uhr · Pausen- und Ruhezeiten · Altersstufen (unter 13 / 13-14 / 15-17 / ab 18) · kurzfristige Beschaeftigung: bis 70 Arbeitstage **keine Sozialabgaben, unabhaengig vom Verdienst** · Lohnsteuer per Steuererklaerung zurueckholen (Grundfreibetrag 12.348 EUR) · typische Ferienjobs · Bewerbung 4-6 Wochen vorher.

### Nebenbefund: veraltete Zahl auf drei Seiten
`eltern.html`, `fairer-lohn.html` und `jobideen.html` nannten **556 EUR** als Minijob-Grenze. Das ist der Wert von 2025; seit dem 1.1.2026 sind es **603 EUR** (Mindestlohn 13,90 EUR). Auf einer Seite, die Minderjaehrigen erklaert, was ihnen zusteht, ist eine falsche Geldzahl kein Schoenheitsfehler. Korrigiert.

### Zwei Funde aus den Tests
1. **`innerText` liefert den gerenderten Text.** Die Countdown-Kopfzeile wird per CSS in Versalien gesetzt, also scheiterten gross/klein-empfindliche Pruefungen an "HERBSTFERIEN IN HESSEN". Die Tests pruefen jetzt ohne Ruecksicht auf Gross-/Kleinschreibung - das ist auch das richtigere Verhalten, denn geprueft wird, was ein Nutzer sieht.
2. **Der Bundesland-Waehler war 43px hoch** - einen Pixel unter den 44, die eine Fingerkuppe braucht. Vom Tippziel-Test gefunden, mit `min-height: 46px` behoben. Genau dafuer ist der Test da.

### Verlinkt
Footer aller 12 oeffentlichen Seiten · `sitemap.xml` · in die Seitenlisten von `a11y.spec.js` und `tippziele-mobil.spec.js` aufgenommen.

**Suite: 346 -> 362 Tests, alle gruen.** 16 neue in `tests/ferienjob.spec.js`, davon 7 fuer die Datumsrechnerei mit festen Stichtagen (laufende Ferien, letzter Ferientag, ausgelaufener Bestand, Plausibilitaet aller 64 Zeitraeume).

## Session 25. August 2026 (Teil 13) - Schriftwechsel: weniger nach Vorlage aussehen

Auf Wunsch von Sanad (*"kannst du die schrift und etc weniger ki aussehnd lassen"*).

**Bestandsaufnahme, was eine Seite generiert aussehen laesst:**
- Schriften: **Space Grotesk + Inter** - genau die Kombination, die der Design-Pruefer zweimal gemeldet hatte. Beide stehen auf jeder zweiten KI-erzeugten Seite.
- Rund **120 Emoji** als Symbole (Rakete, Konfetti, Gluehbirne, Eis, Hund ...)
- **15 Farbverlaeufe**

**Drei Alternativen gerendert und Sanad gezeigt** statt blind umzustellen - es ist eine Markenentscheidung. Ehrlicher Hinweis dabei: Zwei der drei unterschieden sich kaum vom Ist-Zustand, und die Schrift ist ohnehin nicht der groesste Hebel.

**Gewaehlt: Bricolage Grotesque (Ueberschriften) + IBM Plex Sans (Text).**
- Bricolage Grotesque ist eine variable Schrift mit eigenwilligen Details - deutlich mehr Charakter als Space Grotesk.
- IBM Plex Sans passt zum bereits verwendeten **IBM Plex Mono**: Damit steht die Seite jetzt auf einer stimmigen Familie statt auf zwei zufaellig kombinierten Schriften.
- Umgestellt in **20 HTML-Dateien**, im CSS (18 + 23 Stellen) und in `js/gate.js`.

**Emoji und Verlaeufe bleiben** - ausdrueckliche Entscheidung von Sanad.

**Nachgezogen:** `tests/schriften.spec.js` aus Runde 3 hatte die alten Namen fest eingetragen und faellt sonst um. Er prueft weiterhin, dass kein Schnitt geladen wird, der nirgends benutzt wird.

**Suite: 346 Tests, alle gruen** (unveraendert).


## Session 25. August 2026 (Teil 12) - Bei wem bewerbe ich mich eigentlich?

Runde 27. Die Job-Detailseite durchgesehen - der Moment, in dem sich ein Schueler entscheidet.

### Der Fund: Der Arbeitgeber wurde nirgends genannt
Die Jobs-Tabelle hat seit jeher eine Spalte `firma_name`. In der Produktionsdatenbank nachgesehen: **bei keinem der vier Jobs gefuellt**. Der Grund stand im Code - beim Posten wurde sie schlicht nie geschrieben.

Folgen:
- **Schueler sahen nie, bei wem sie sich bewerben.** Fuer Minderjaehrige ist das eine Vertrauensfrage - und unsere eigene Elternseite verspricht ausdruecklich, dass Unternehmen geprueft werden. Dann sollte man auch sehen, welches.
- Die strukturierten Daten fuer die **Google-Jobsuche** meldeten "Arbeitgeber auf SchuelerMatch" statt des echten Namens.
- Das Kuerzel im Kreis neben dem Titel kam vom **Jobtitel**, nicht von der Firma. Die CSS-Klasse heisst `company-name` und zeigte den **Ort**.

### Zweiter Fund: Kein Alter der Anzeige
Auf den Karten gibt es ein "NEU"-Abzeichen fuer die ersten 72 Stunden - auf der Detailseite stand nichts. Eine Stelle von vor einem halben Jahr ist meist laengst vergeben; das sollte man sehen, bevor man Zeit in eine Bewerbung steckt.

### Behoben
- `js/dashboard-firma.js` schreibt den Firmennamen jetzt beim Posten mit. **Bewusst kopiert statt verknuepft**: Die Anzeige soll zeigen, wer damals inseriert hat.
- Firmenname auf der Detailseite und auf beiden Kartenansichten (Boerse und Dashboard), das Kuerzel im Kreis kommt jetzt von der Firma.
- Alter der Anzeige in Alltagssprache ("vor 3 Tagen eingestellt", "vor 2 Monaten eingestellt"). **Ab zwei Monaten dezent rot** - dann lohnt eine Nachfrage, ob die Stelle ueberhaupt noch frei ist.

**Die vier bestehenden Jobs wurden NICHT angefasst** - es sind bewusste Testdaten. Der Code kommt mit fehlendem Firmennamen sauber zurecht; ein eigener Test prueft, dass dann kein "bei undefined" erscheint.

**Dauerhaft abgesichert:** `tests/firmenname.spec.js` (9 Tests): Name auf Boerse und Detailseite, sauberes Verhalten ohne Namen, die Datumstexte in allen Stufen, Hervorhebung ab zwei Monaten (und keine davor) - und dass **Google den echten Namen bekommt**.

**Suite jetzt: 346 Tests, alle gruen** (vorher 337).


## Session 25. August 2026 (Teil 11) - Die Suche verzeiht jetzt, wie Menschen tippen

Runde 26. Nach fuenf Runden mit neuen Inhaltsseiten wieder zurueck zum Produkt selbst.

### Gemessen mit 23 Eingaben, wie sie ein 15-Jaehriger tippt
**Neun davon fanden nichts**, obwohl passende Jobs da waren:

| Eingabe | Problem |
|---|---|
| `muenchen`, `cafe`, `einraeumen` | Umlaute umschrieben |
| `nachhilfe job`, `job nachhilfe`, `gassi gehen` | ein Fuellwort dazwischen |
| `kellnerin` | andere Wortform |
| `nachhife` | Tippfehler |
| `supermarkt` | Umgangssprache |

Das Fuellwort-Problem war das heimtueckischste: Die Suche verlangte, dass **jedes** Wort im Anzeigentext vorkommt. "nachhilfe job" scheiterte daran, dass "job" nirgends steht - obwohl der Nutzer damit gar nichts Bestimmtes meinte.

### Vier Schritte in `js/suche.js`
1. **Umlaute vereinheitlichen** - "muenchen" und "München" werden zur selben Zeichenfolge, ebenso "cafe" und "café".
2. **Fuellwoerter ignorieren** (job, arbeit, stelle, suche, gehen, als, fuer ...). Bleibt danach nichts uebrig ("ich suche einen job"), wird **alles** gezeigt statt nichts - der Nutzer hat ja nichts Konkretes gesagt.
3. **Ein Tippfehler erlaubt** - ein Zeichen zu viel, zu wenig oder falsch. **Bewusst erst ab fuenf Zeichen**: Sonst faende "hund" auch "rund" und "hand".
4. **Woerterbuch erweitert** um weibliche Formen (kellnerin, verkaeuferin), Umgangssprache (supermarkt, laden, markt) und Faecher (mathe, englisch).

**Ergebnis: 0 von 23 Eingaben scheitern** (vorher 9).

**Dauerhaft abgesichert:** `tests/suche.spec.js` (22 Tests) - und zwar **zweiseitig**. Die eine Haelfte prueft, dass gefunden wird, was gemeint ist. Die andere, dass die Suche **nicht einfach alles findet**: "pizzabaecker", "zahnarzt" und "flugbegleiter" muessen leer bleiben, "hand" darf nicht "Hunde" treffen, und zwei Woerter muessen wirklich eingrenzen (Nachhilfe gibt es in Muenchen, nicht in Augsburg). Eine zu grosszuegige Toleranz waere nicht besser als gar keine.

**Gegen den alten Code geprueft: 10 der 22 Tests fallen um.**

**Suite jetzt: 337 Tests, alle gruen** (vorher 315).


## Session 25. August 2026 (Teil 10) - Fairer Lohn: die Regel, die kaum jemand kennt

Runde 25.

### Der Fund im Ratgeber von schuelerjobs.de
Ein Satz, der bei uns nirgends vorkam: *"Ein Recht auf einen bestimmten Stundenlohn hast du als Schueler nicht - auch nicht auf den Mindestlohn."*

**Das stimmt.** Das Mindestlohngesetz gilt nach § 22 Absatz 2 nicht fuer Personen unter 18 ohne abgeschlossene Berufsausbildung. Fuer eine Plattform, die Minderjaehrige schuetzen will, ist das ein Kernthema: Wer es nicht weiss, haelt ein schlechtes Angebot womoeglich fuer gesetzlich garantiert - oder denkt umgekehrt, ihm stuenden 12,82 Euro zu.

### Nebenbei ein eigener Fehler
Unser Filter hiess **"Mindestlohn"**. Genau das Wort, das den falschen Eindruck erweckt - dabei ist ein Mindestbetrag gemeint, den man selbst haben moechte. Heisst jetzt **"Stundenlohn ab"** (in Jobboerse und Schueler-Dashboard). Zwei bestehende Tests mussten nachgezogen werden.

### Gebaut: `fairer-lohn.html`
- Die Mindestlohn-Ausnahme ganz oben, mit Fundstelle - **und dem Zusatz, was daraus NICHT folgt**: kein Mindestlohn heisst nicht, dass man alles annehmen muss
- Eine Tabelle mit ueblichen Loehnen nach Taetigkeit und Alter (10 Zeilen), plus Faustregel: unter 8 Euro genauer hinsehen
- **Woran man erkennt, dass etwas nicht stimmt**: Bezahlung nach Menge ohne Rechnung, unbezahlte Probearbeit ueber Stunden, "Trinkgeld gleicht das aus", Ausweichen beim Thema Geld, Vorkasse
- **Drei Saetze zum Nachfragen**, die man wirklich sagen kann. Mit 15 nach mehr Geld zu fragen ist unangenehm - fertige Formulierungen helfen mehr als der Rat "verhandle einfach".
- Was am Ende uebrig bleibt (556-Euro-Grenze, Kindergeld)

**Dauerhaft abgesichert:** `tests/fairer-lohn.spec.js` (8 Tests). Darunter zwei inhaltliche: dass die Seite auch sagt, was aus der Ausnahme **nicht** folgt - und dass die **Loehne mit der Jobideen-Seite uebereinstimmen**. Zwei Seiten mit Zahlen duerfen sich nicht widersprechen.

**Suite jetzt: 315 Tests, alle gruen** (vorher 302).


## Session 25. August 2026 (Teil 9) - Startseite: mehrere Einstiege statt einem

Runde 24.

### Angesehen: studentjob.de
Deren Startseite bietet **mehrere Einstiege nebeneinander** an: nach Jobart (Ferienjob, Nebenjob, Minijob), nach Stadt, ein "weiss noch nicht so recht, was ich suche" - und einen eigenen Kasten fuer Arbeitgeber, prominent oben statt versteckt. Das Prinzip dahinter: Nicht jeder kommt mit derselben Frage.

### Das Problem bei uns
Nach vier neuen Seiten in drei Runden war die Startseite noch auf dem alten Stand. Job-Finder, Jobideen, Eltern- und Arbeitgeber-Seite waren dort nur **kleine Textlinks** - der ganze neue Inhalt praktisch unsichtbar. Wer als Vierzehnjaehriger ohne Vorstellung ankam, sah eine Kategorienliste und eine Jobboerse, die gerade noch leer ist.

### Gebaut: Abschnitt "Womit faengst du an?"
Vier Karten, jede fuer eine andere Absicht:
1. **Ich weiss noch nicht, was** -> Job-Finder (steht bewusst an erster Stelle - wer schon weiss, was er sucht, findet die Boerse ohnehin ueber das Menue)
2. **Zeig mir, was moeglich ist** -> Jobideen
3. **Ich weiss schon, was ich suche** -> Jobboerse
4. **Ich bin ein Elternteil** -> Elternseite, dezent abgesetzt, damit Schueler nicht faelschlich dort landen

**Dauerhaft abgesichert:** `tests/startseite-wege.spec.js` (5 Tests). Prueft nicht nur, dass die Karten da sind, sondern dass die **Wege wirklich funktionieren**: Klick auf die erste Karte fuehrt zum Test, und der Test laedt auch; Klick auf die Jobboerse zeigt wirklich Jobs. Ausserdem, dass der Einstieg fuer Unentschlossene vorn steht.

**Suite jetzt: 302 Tests, alle gruen** (vorher 297).


## Session 25. August 2026 (Teil 8) - Navigation vereinheitlicht (Aufraeumen nach dem Wachstum)

Runde 23. Kein Wettbewerbsvergleich diesmal, sondern das Aufraeumen dessen, was die letzten Runden angerichtet hatten.

**Der Befund:** In drei Runden waren vier neue Seiten dazugekommen (Jobideen, Job-Finder, Eltern, Arbeitgeber), und bei jeder hatte ich die Menueleiste ein Stueck erweitert. Ergebnis: **fuenf verschiedene Navigationen**.

- Startseite: So funktioniert's | Fuer Schueler | Fuer Firmen | Jobs | Job-Finder
- Jobboerse: Jobs | Job-Finder | Fuer Schueler | Fuer Firmen
- Jobideen/Job-Finder/Eltern: Start | Jobs | Job-Finder | Jobideen
- Arbeitgeber: Start | Jobs | Job-Finder | Fuer Arbeitgeber
- Jugendarbeitsschutz: Start | Jobs | Job-Finder

Wer von der Startseite auf "Jobideen" klickte, verlor "Fuer Arbeitgeber" aus dem Menue. Und **"Fuer Firmen" zeigte noch auf einen Seitenanker** (`#firmen`), obwohl es inzwischen eine eigene Seite gab - auf jeder anderen Seite lief dieser Link ins Leere.

**Zweiter Fund:** Auf `jugendarbeitsschutz.html` fehlte der Hamburger-Knopf. Dort war das Menue **auf dem Handy ueberhaupt nicht erreichbar** - die Links sind per CSS ausgeblendet, und ohne Knopf kommt man nicht dran. Das hatte keine der bisherigen Pruefungen gefunden: Sie pruefen, ob sichtbare Elemente gross genug sind, nicht ob etwas fehlt.

**Behoben:** Eine einheitliche Leiste auf allen neun oeffentlichen Seiten - **Jobs | Job-Finder | Jobideen | Fuer Arbeitgeber**. Dazu `aria-current="page"` auf dem aktiven Eintrag, farblich hervorgehoben: Man sieht jetzt, wo man ist. "Fuer Eltern" steht bewusst nur im Footer - Eltern kommen ueber Suche oder Link, nicht ueber das Hauptmenue.

**Ein eigener Fehler, vom Test gefangen:** Beim Vereinheitlichen habe ich den Knopf auf der Startseite von "Jetzt starten" zu "Login" gemacht - eine bewusste fruehere Entscheidung ueberschrieben. Der bestehende Test `landing.spec.js` fiel darueber. Auf der Startseite ist "Jetzt starten" richtig (die meisten Besucher haben dort noch kein Konto), auf Unterseiten "Login". Jetzt mit Kommentar im Code, damit es nicht nochmal passiert.

**Dauerhaft abgesichert:** `tests/navigation.spec.js` (21 Tests): identisches Menue auf allen neun Seiten, Hamburger-Knopf ueberall vorhanden, aktive Seite markiert, kein Menuelink zeigt ins Leere (auch keine Anker mehr), und die Seiten ausserhalb des Menues bleiben ueber den Footer erreichbar.

**Suite jetzt: 297 Tests, alle gruen** (vorher 276).


## Session 25. August 2026 (Teil 7) - Arbeitgeber-Seite: das staerkste Argument stand nirgends

Runde 22. Fuer Unternehmen gab es bisher nur einen Kasten auf der Startseite mit vier Stichpunkten - dabei haengt der Start der Plattform an ihnen. Ohne Anzeigen ist die Jobboerse leer.

### Der Kern: Jugendarbeitsschutz als Verkaufsargument
Wer Minderjaehrige beschaeftigt, haftet nach dem Jugendarbeitsschutzgesetz - Bussgelder bis **30.000 Euro**. Ein Cafe-Besitzer, der eine Aushilfe sucht, hat genau davor Respekt: zu jung, zu spaet, zu lang, verbotene Taetigkeit, fehlende Elterneinwilligung.

**Und genau das nimmt SchuelerMatch ihm ab:** Er traegt ein Mindestalter ein, und die Anzeige wird nur Schuelern gezeigt, die es erfuellen. Keine Bewerbungen von Vierzehnjaehrigen auf eine Stelle ab 16. Das ist der Unterschied zu einem Aushang im Fenster oder einer allgemeinen Jobboerse - und es stand bisher nirgends.

### Gebaut: `fuer-firmen.html`
- Drei Schritte zur Anzeige (Konto, Anzeige, Bewerbungen)
- Die fuenf haeufigsten Stolperfallen des Jugendarbeitsschutzes, konkret benannt
- Was die Plattform bietet: nur verifizierte Schueler, Bewerbungen mit Lebenslauf, Chat ohne Handynummer-Austausch, Umkreissuche
- Verlinkt direkt auf die Einverstaendniserklaerung fuer Eltern (die der Arbeitgeber ohnehin braucht)
- **Fuer wen es NICHT passt** - Vollzeit, gefaehrliche Maschinen, feste Verfuegbarkeit waehrend der Schulzeit. Ehrlichkeit spart beiden Seiten Zeit.

### Zwei bewusste Entscheidungen
**Keine erfundene Reichweite.** Die Seite sagt offen: *"SchuelerMatch startet gerade. Wir haben noch keine tausenden Nutzer, die wir Ihnen versprechen koennten - und wir behaupten es auch nicht."* Erfundene Zahlen waeren der schnellste Weg, das Vertrauen eines Arbeitgebers zu verlieren. Ein Test prueft, dass keine Nutzerzahlen auf der Seite stehen.

**Ehrlich zum Preis.** Zurzeit kostenlos - aber mit dem Zusatz, dass das nicht ewig so bleibt und wir es rechtzeitig ankuendigen. Wer das erst erfaehrt, wenn die Rechnung kommt, kommt nicht wieder.

**Dauerhaft abgesichert:** `tests/fuer-firmen.spec.js` (11 Tests). Darunter zwei, die inhaltlich pruefen statt nur technisch: dass **keine Nutzerzahlen** versprochen werden, und dass die Altersangaben **nicht der Elternseite widersprechen** - inzwischen erklaeren drei Seiten dasselbe Gesetz.

**Suite jetzt: 276 Tests, alle gruen** (vorher 260).


## Session 25. August 2026 (Teil 6) - Elternseite mit Einverstaendniserklaerung

Runde 21. Diesmal aus einer anderen Richtung verglichen: Bisher ging es immer um die Schuelerseite - dabei haengt das Henne-Ei-Problem an den Firmen und an den **Eltern**.

### Angesehen: schuelerjobs.de aus Eltern- und Firmensicht
Die 404-Seite dort verriet die ganze Seitenstruktur. Auffaellig:
- **Informationen fuer Eltern** (eigene Rubrik, mit Einverstaendniserklaerung zum Download)
- Taschengeldtabelle 2026 (Nachschlagewerk, das gesucht wird)
- Schuelerjobs in den Sommerferien / in deiner Stadt (saisonal und lokal)
- Referenzen und "in den Medien" (Vertrauen fuer Firmen)
- Anzeigenpreise / Inserieren

### Gebaut: `eltern.html`

**Warum ausgerechnet Eltern:** Sie werden hier gleich doppelt gebraucht - fuer die Anmeldung unter 16 (Art. 8 DSGVO) und fuer den Job selbst, den jeder seriose Arbeitgeber schriftlich bestaetigt haben will. Dazu sind sie oft diejenigen, die die Plattform pruefen, **bevor** das Kind sich ueberhaupt anmeldet. Fuer die gab es bisher nichts.

**Inhalt:**
- Altersgrenzen in Elternsprache (unter 13 / 13-14 / ab 15 / ab 16)
- **Die zwei Arten von Einwilligung auseinandergehalten** - das wird staendig verwechselt: die Zustimmung zum Konto (Datenschutz) ist etwas anderes als die Einverstaendniserklaerung fuer den Job
- **"Wie sicher ist das hier?"** mit konkreten Antworten statt Beteuerungen: Firmen werden von Hand freigegeben, Schueler verifiziert, Kontakt laeuft ueber unseren Chat (keine Handynummer noetig), automatische Warnungen bei Kontaktdaten/Vorkasse/Alleintreffen, Melden mit einem Klick
- Worauf beim Job zu achten ist (Vorstellungsgespraech, Arbeitsvertrag, Minijob-Zentrale, 556-Euro-Grenze, Kindergeld)

**Dazu eine Einverstaendniserklaerung zum Ausdrucken.** Kein PDF noetig - die Vorlage steht als Teil der Seite, und eine Druck-Regel blendet beim Ausdrucken alles andere aus. So sieht man vorher genau, was auf dem Papier landet. Der Hinweis "keine Rechtsberatung" steht **auf der Vorlage selbst**, nicht nur daneben.

**Verlinkt** im Footer aller acht oeffentlichen Seiten und in `sitemap.xml`.

**Dauerhaft abgesichert:** `tests/eltern.spec.js` (7 Tests): Vorlage vollstaendig, Rechtsberatungs-Hinweis vorhanden, beim Drucken bleibt wirklich nur die Vorlage uebrig, die zwei Einwilligungsarten werden unterschieden, die Altersangaben stimmen mit der Jugendarbeitsschutz-Seite ueberein, die Sicherheitsmerkmale werden konkret benannt, und die Seite ist von ueberall erreichbar. Ausserdem in alle fuenf Qualitaetspruefungen aufgenommen.

**Suite jetzt: 260 Tests, alle gruen** (vorher 248).

### Noch offen aus dem Vergleich
- Ferienjob-Bereich, Job-Alarm per E-Mail, Staedte-Seiten, Erfahrungsberichte
- **Taschengeldtabelle** - neu dazugekommen: ein Nachschlagewerk, nach dem tatsaechlich gesucht wird
- **Seite fuer Firmen** ("Warum hier inserieren?") - bisher gibt es fuer Unternehmen keinen eigenen Einstieg


## Session 25. August 2026 (Teil 5) - Job-Finder: der Test, der zum Namen passt

Runde 20. Weiter im neuen Stil: erst vergleichen, dann bauen.

### Angesehen: ausbildung.de
Dort steht auf der Startseite: *"Du weisst noch nicht, welcher Beruf zu dir passt? In 3 Minuten schlauer mit dem Berufscheck!"* - ein kurzer Orientierungstest fuer alle, die noch keine Vorstellung haben. Dazu der Dreischritt "Orientieren. Entdecken. Bewerben."

**Warum das hier besonders gut passt:** Die Plattform heisst **SchuelerMatch** - gematcht wurde bisher aber nur nach Alter und Ort. Ein 14-Jaehriger, der nicht weiss, was er ueberhaupt machen koennte, bekam nur eine Filterliste.

### Gebaut: `job-finder.html` + `js/job-finder.js`

Fuenf Fragen, etwa eine Minute: Alter, drinnen oder draussen, wie viel Kontakt zu Menschen, wann Zeit ist, was am wichtigsten ist (Geld / Flexibilitaet / etwas lernen). Danach vier passende Jobideen - jede mit einer **Begruendung**, warum gerade sie vorgeschlagen wird. Ein Ergebnis ohne Begruendung wirkt beliebig.

**Drei Entscheidungen, die im Code stehen:**
- **Punkte statt harter Filter.** Nur das Alter ist eine echte Grenze - alles andere gibt Punkte. Sonst bleibt bei ungewoehnlichen Kombinationen nichts uebrig, und ein leeres Ergebnis hilft niemandem.
- **Das Alter ist unverhandelbar.** Ein Vorschlag, den man gar nicht machen darf, waere schlimmer als kein Vorschlag. Ein Test haelt das fest.
- **Laeuft komplett im Browser.** Keine Anmeldung, keine Daten an den Server. Das senkt die Huerde - und bei Minderjaehrigen ist es auch datenschutzrechtlich der einfachere Weg.

Am Ende fuehrt das Ergebnis weiter: "Jobs in meiner Naehe" und "Profil anlegen". Ohne naechsten Schritt waere auch ein gutes Ergebnis eine Sackgasse.

**Verlinkt** im Hauptmenue aller oeffentlichen Seiten, in den Footern, in `sitemap.xml` - und mit einem Hinweis direkt unter "Was willst du machen?" auf der Startseite ("Noch keine Ahnung? Finde es in einer Minute heraus").

**Eigener Fehler unterwegs, gefunden durch den Test:** Der `<noscript>`-Hinweis stand zuerst *innerhalb* des Bereichs, den das Skript komplett ersetzt - er war also sofort weg. Jetzt steht er daneben, mit einem Kommentar, warum.

**Dauerhaft abgesichert:** `tests/job-finder.spec.js` (10 Tests): Altersgrenze wird nie ueberschritten, es kommt immer ein Ergebnis, die Vorschlaege passen zur Antwort (draussen + wenig Kontakt fuehrt nicht zu "Service im Cafe"), Zurueck-Knopf, Neustart, Weiterfuehrung und der Hinweis ohne JavaScript. Ausserdem in **alle fuenf** Qualitaetspruefungen aufgenommen.

**Suite jetzt: 248 Tests, alle gruen** (vorher 233).


## Session 25. August 2026 (Teil 4) - NEUE RICHTUNG: Weiterentwicklung statt Fehlersuche

**Der Auftrag hat sich geaendert.** Bis hierher ging es 15 Runden lang um Messen und Fehlerbeheben. Sanad hat umgesteuert: kuenftig **weiterentwickeln, andere Webseiten vergleichen und daraus lernen**.

### Wettbewerbsvergleich (25.8.)
Angesehen: **zenjob.com** (Schichtvermittlung fuer Studierende) und **schuelerjobs.de** (direkter Wettbewerber).

Was die haben und wir nicht:
- **Jobideen als eigener Menuepunkt** (schuelerjobs.de) - Inspiration statt nur Suche
- **Ferienjobs gleichrangig im Titel** bei beiden; bei uns nur eine Filter-Option unter fuenf
- **Erfahrungsberichte echter Nutzer** mit Namen und Zitat (zenjob)
- **Staedte-Seiten** ("Jobs in Berlin, Hamburg, Muenchen...")
- **Berufsbilder als Einstieg** ("Kellner*in", "Kassierer*in") statt nur Kategorien
- **Job-Alarm per E-Mail** (dort "Jobletter")
- **Ratgeber/Blog**

Was fuer uns spricht: schuelerjobs.de bewirbt auf der Startseite prominent einen Job **ab 18 Jahren** - auf einer Seite fuer Schueler. Unsere Altersfilterung mit Mindestalter an jeder Anzeige ist ein echter Vorteil.

### Gebaut: `jobideen.html`

**Warum diese Idee zuerst:** Sie loest das Henne-Ei-Problem zum Start. Solange keine Firmen inseriert haben, ist die Jobboerse leer - die Jobideen-Seite hat trotzdem Inhalt, den Google findet und der Besuchern einen Grund gibt wiederzukommen.

**Inhalt:** 21 Jobideen, sortiert nach dem Alter, ab dem sie erlaubt sind (13 / 15 / 16). Jede mit Altersangabe, ueblichem Verdienst und einem ehrlichen Tipp aus der Praxis - etwa dass man sich fuer Eisverkauf im Maerz bewerben muss, weil im Juni alles weg ist, oder dass Prospektverteilen nach Menge bezahlt wird und man vorher ausrechnen sollte, was das pro Stunde bedeutet.

Dazu die Rechtslage an den richtigen Stellen eingebaut: die 2-Stunden-Grenze unter 15, die Ferienregel ab 15 (bis zu 4 Wochen Vollzeit im Jahr - das wissen die wenigsten), die 22-Uhr-Grenze ab 16 und die 556-Euro-Minijobgrenze.

**Verlinkt** im Hauptmenue und im Footer von Startseite, Jobboerse, Job-Detail und Jugendarbeitsschutz; in `sitemap.xml` eingetragen.

**Lehre aus Runde 12 angewendet:** Die neue Seite wurde sofort in **alle fuenf** Qualitaetspruefungen aufgenommen (Barrierefreiheit, Tastatur, Layout-Spruenge, Texte/Teilen, Tippziele) - nicht erst, wenn es jemand merkt.

**Suite jetzt: 233 Tests, alle gruen** (vorher 227).

### Naechste Ideen aus dem Vergleich (noch offen)
- **Ferienjob-Bereich**: eigener Einstieg statt versteckter Filter, plus die Ferienregeln erklaert
- **Job-Alarm per E-Mail**: bindet Besucher, die heute nichts finden
- **Staedte-Seiten**: staerkster SEO-Hebel, lohnt aber erst mit echten Anzeigen
- **Erfahrungsberichte**: erst moeglich, wenn es echte Nutzer gibt


## Session 25. August 2026 (Teil 3) - Schutz-Trigger waren nirgends gesichert

Runde 18 des Dauerauftrags. Ausgangspunkt war der Firmen-Freigabe-Ablauf.

**Der Ablauf selbst ist gut gebaut:** Eine neue Firma sieht ein Banner ("Dein Konto wird geprueft. Du kannst schon Jobs anlegen - sobald wir dich freigeben, werden sie automatisch sichtbar. Du bekommst dann eine E-Mail."), kann also sofort loslegen. Beim Job-Posten sagt die Rueckmeldung ehrlich "sichtbar, sobald dein Konto freigegeben ist". Gesperrte Konten bekommen eine eigene Meldung mit Kontaktmoeglichkeit.

**Die Pruefung eines Versprechens fuehrte zum eigentlichen Fund.** Das Banner sagt "Du bekommst dann eine E-Mail" - kommt die wirklich? In der Repo-Datei `mail-webhooks-einrichten.sql` standen nur Trigger fuer `bewerbungen`, nichts fuer `profiles`. Es sah nach einem leeren Versprechen aus.

**In der Datenbank nachgesehen: Das Versprechen wird eingehalten.** Die Trigger `firma_freigabe_mail` und `profil_verifiziert_mail` existieren dort - sie wurden nur nie ins Repo eingetragen. Meine Vermutung war also falsch.

**Dabei kam aber Groesseres heraus:** In der Datenbank waren **zehn** Trigger aktiv, im Repo standen **zwei**. Nicht gesichert waren unter anderem **alle sechs Schutz-Trigger** - darunter `trg_schuetze_profil`, der die kritischste Luecke des Security-Audits vom 26.7. schliesst: Ohne ihn kann sich jeder eingeloggte Nutzer per `update profiles set ist_admin = true` selbst zum Administrator machen. RLS allein hilft dagegen nicht, weil die Zeile dem Nutzer ja gehoert - geschuetzt werden muessen einzelne **Spalten**.

Waere die Datenbank je neu aufgesetzt worden - Umzug, Wiederherstellung, oder weil Supabase ein pausiertes Projekt zurueckstellt -, waeren alle diese Regeln ersatzlos verschwunden. **Und niemand haette es gemerkt**, bis jemand die Luecke nutzt.

**Behoben:**
- **Neu: `supabase/schutz-trigger.sql`** - alle sechs Schutz-Trigger samt ihrer Funktionen und `ist_admin()`, mit Erklaerung, wogegen jede Regel schuetzt. Wiederholbar ausfuehrbar.
- `mail-webhooks-einrichten.sql` um die beiden fehlenden Mail-Trigger ergaenzt.

**Dauerhaft abgesichert:** `tests/db-sicherung.spec.js` (4 Tests) vergleicht die Liste der aktiven Trigger mit dem, was im Repo steht, prueft dass zu jedem Trigger auch seine Funktion gesichert ist, dass die Profil-Regel genau die vier kritischen Felder einfriert - und dass das E-Mail-Versprechen im Banner durch einen Trigger und einen Zweig in der Edge Function gedeckt ist. **Alle vier fallen ohne die neuen Dateien um.** Der Test braucht keinen Browser und laeuft in unter zwei Sekunden.

**Suite jetzt: 227 Tests, alle gruen** (vorher 223).


## Session 25. August 2026 (Teil 2) - Bestaetigungsmail erneut anfordern

Runde 17 des Dauerauftrags. Der Registrierungs-Trichter vom ersten Besuch bis zum fertigen Profil.

**Vieles war besser als erwartet:** Die "Fast geschafft"-Ansicht nach der Registrierung nennt die E-Mail-Adresse, erklaert den naechsten Schritt und weist auf den Spam-Ordner hin. Der Verifizierungs-Hinweis steht prominent im Dashboard und wird auf der Job-Detailseite vorab erklaert. Die Fehlermeldung bei der Registrierung ist bewusst allgemein gehalten, damit niemand herausfinden kann, welche E-Mail-Adressen registriert sind.

**Die Luecke - eine Sackgasse im wichtigsten Trichter:**
Kam die Bestaetigungsmail nicht an (Zustellproblem, Tippfehler in der Adresse), gab es **keinen Weg weiter**. Kein erneutes Senden, keine Korrektur. Der Rat "schau im Spam-Ordner" war alles. Wer die Mail nicht bekam, konnte sich nie einloggen - und die Plattform nie nutzen. Beim Login dasselbe: Die Meldung "bitte bestaetige zuerst deine E-Mail" nannte keinen Ausweg.

**Behoben:**
- In der "Fast geschafft"-Ansicht gibt es jetzt einen Knopf **"E-Mail erneut senden"**.
- Beim Login erscheint derselbe Knopf unter der Fehlermeldung, wenn die Adresse noch nicht bestaetigt ist.
- Supabase begrenzt das Anfordern zeitlich und antwortet dabei englisch ("For security purposes, you can only request this after 51 seconds"). Dieser Text wird uebersetzt: "Gerade eben schon versucht. Warte kurz und probier es dann noch einmal."
- Nach erfolgreichem Senden sperrt sich der Knopf 30 Sekunden, damit niemand aus Ungeduld in die Sperre des Anbieters laeuft. Nach einem Fehlversuch wird er schon nach 3 Sekunden wieder frei.

**Dauerhaft abgesichert:** `tests/bestaetigungsmail.spec.js` (5 Tests). **Alle fuenf fallen gegen den alten Code um.**

**Suite jetzt: 223 Tests, alle gruen** (vorher 218). Laufzeit 5,9 Minuten.


## Session 25. August 2026 - Merkliste: Meldung sagte das Gegenteil

Runde 16 des Dauerauftrags. Merkliste (Herz-Knopf) und Bewerbungsfluss durchgesehen.

**Der Fehler:** In `toggleMerken()` lief die Erfolgsmeldung **unabhaengig davon, ob das Speichern geklappt hatte** - und sagte dabei das Gegenteil dessen, was der Nutzer wollte:

- Jemand tippt auf das Herz, um einen Job zu merken. Das Speichern scheitert. Meldung: **"Job entfernt"**.
- Jemand entfernt einen Job. Das Loeschen scheitert. Meldung: **"Job gemerkt ❤"**.

In beiden Faellen wurde der Fehler selbst mit keinem Wort erwaehnt. Der Grund: Die Meldung las den Zustand aus `gemerkteIds`, und der aendert sich bei einem Fehler ja gerade nicht - also stand dort immer der alte Wert.

**Behoben:** Bei einem Fehler kommt jetzt eine ehrliche Meldung ("Das Merken hat gerade nicht geklappt") und die Erfolgsmeldung bleibt aus.

**Ausserdem:** Drei weitere Stellen im Schueler-Dashboard reichten noch rohe englische Fehlertexte durch (Zeugnis hochladen, Lebenslauf hochladen, PDF-Vorschau) - dasselbe Muster, das Runde 6 an anderen Stellen behoben hatte. Jetzt ueber `verstaendlich()`.

**Der Bewerbungsfluss war in Ordnung** - Fehler werden abgefangen, der Knopf zurueckgesetzt, die Meldungen stimmen. Dass eine Bewerbung auch dann abgeht, wenn das automatische Lebenslauf-PDF scheitert, ist eine bewusste und im Code dokumentierte Entscheidung.

**Dauerhaft abgesichert:** `tests/merken.spec.js` (4 Tests). **Gegen den alten Code geprueft: genau einer faellt um** - der zum Meldungstext. Das Herz blieb auch vorher schon korrekt ungefuellt; falsch war allein die Meldung darunter. Die anderen drei sind als Absicherung gekennzeichnet, nicht als Fehlerbeleg.

**Suite jetzt: 218 Tests, alle gruen** (vorher 214). Laufzeit dieses Durchlaufs: 9,2 Minuten.


## Session 24. August 2026 (Teil 10) - Umkreissuche: Ortsdaten gingen verloren

Runde 15 des Dauerauftrags. Der Geo-Teil (`js/geo.js`) war bisher nie geprueft worden.

**Der Fehler - stiller Datenverlust:**
`geocode()` gab bei **jedem** Problem dasselbe zurueck (`null`) - egal ob der Ort nicht existierte oder der Dienst gerade nicht antwortete. Beide Aufrufer schrieben daraufhin `lat = null, lon = null` in die Datenbank.

Praktisch hiess das: Ein Schueler aendert nur seinen **Namen**, waehrend der Geo-Dienst klemmt - und verliert dabei seine gespeicherten Koordinaten. Danach taucht er in der Umkreissuche nicht mehr auf und sieht keine Entfernungen mehr. **Ohne jeden Hinweis.** Bei Firmen dasselbe: Eine bestehende Anzeige waere aus der Umkreissuche der Schueler verschwunden, nur weil beim Bearbeiten der Geo-Dienst kurz gestoert war.

**Zweiter Fehler:** Kein Zeitlimit. Antwortete der Dienst gar nicht (statt einen Fehler zu liefern), wartete `fetch` unbegrenzt - und mit ihm das Speichern des ganzen Profils.

**Behoben:**
- `geocode()` liefert jetzt drei unterscheidbare Ergebnisse: gefunden (mit Koordinaten), **unbekannt** (Tippfehler im Ort) und **gestoert** (Dienst nicht erreichbar).
- Neue Hilfsfunktion `uebernehmeKoordinaten()`: schreibt Koordinaten nur, wenn etwas Verlaessliches bekannt ist. **Bei einer Stoerung bleiben die Felder unangetastet** - vorhandene Werte ueberleben.
- **Zeitlimit von 8 Sekunden** per AbortController.
- Bei unbekanntem Ort bekommen Schueler und Firmen jetzt einen Hinweis ("pruef die Schreibweise, sonst zeigen wir dir keine Entfernungen an"), statt dass es stillschweigend passiert.

**Dauerhaft abgesichert:** `tests/geo.spec.js` (7 Tests). **Alle sieben fallen gegen den alten Code um** - sie belegen also echte Fehler und sind nicht nur Beiwerk.

**Suite jetzt: 214 Tests, alle gruen** (vorher 207).

**Zur Laufzeit:** Dieser Volldurchlauf brauchte 18,6 Minuten statt der ueblichen 6. Nachgemessen: Die sieben neuen Tests brauchen allein **eine** Minute - sie sind nicht die Ursache. Es ist dieselbe Schwankung, die Runde 14 dokumentiert hat (Faktor zwei bis drei je nach Auslastung des Rechners). Kein Anlass, erneut zu optimieren.


## Session 24. August 2026 (Teil 9) - Versuch: Testlaufzeit senken (gescheitert)

Runde 14. Anlass war die Bitte, die Pausen zwischen den Runden zu verkuerzen. Die Pause selbst liegt beim Minimum von 60 Sekunden - die eigentliche Wartezeit ist der volle Testlauf mit 5-6 Minuten. Also: Versuch, den zu beschleunigen.

**Ergebnis: nicht gelungen.** Drei Hypothesen geprueft, alle drei waren nicht die Ursache:
1. **Feste Wartezeiten im Testcode** (48,6s verteilt auf 48 Stellen). Klang nach dem Hauptgrund, ist aber bei paralleler Ausfuehrung nur ein Bruchteil.
2. **Fehlende Ressourcen-Blockade in `tests/helpers/basis.js`.** Tatsaechlich holte jeder Test dort Google Fonts und supabase-js frisch aus dem Netz - die Schwester-Datei `supabase-fake.js` macht das laengst, `basis.js` war uebersehen worden. Behoben, aber **messbar nicht schneller**.
3. **OneDrive als Bremse.** Das Projekt liegt in einem synchronisierten Ordner. Gegenprobe mit einer Kopie ausserhalb: **60s statt 47s** - ausserhalb sogar langsamer. Widerlegt.

**Warum keine belastbare Optimierung moeglich war:** Derselbe Test brauchte in drei Messungen 53s, 48s und 28s. Bei einer Schwankung um Faktor zwei laesst sich nicht feststellen, ob eine Aenderung etwas bringt. Die Laufzeit haengt an der Tagesform des Rechners (vier Kerne), nicht an einem behebbaren Defekt im Testaufbau.

**Was trotzdem bleibt - und einen eigenen Wert hat:**
- `basis.js` klemmt jetzt Google Fonts ab und puffert supabase-js pro Worker. Damit sind **alle** Tests unabhaengig vom Netz; vorher haetten sie bei schlechter Verbindung oder offline gehangen. Acht Testdateien waren betroffen.
- Blockierte Schriften werden mit einer leeren, gueltigen Antwort beantwortet statt mit einem Abbruch - das erzeugt keine Konsolenfehler mehr.

**Suite weiterhin: 207 Tests, alle gruen** (Laufzeit 6,3 Min - unveraendert).

**Fuer die Zukunft:** Wer die Laufzeit ernsthaft senken will, muesste die Zahl der Seitenaufrufe reduzieren (mehrere Pruefungen je Aufruf buendeln). Das macht die Tests aber unuebersichtlicher und schlechter isoliert - der Preis waere hoeher als der Gewinn.


## Session 24. August 2026 (Teil 8) - Namen im Lebenslauf-PDF

Runde 13 des Dauerauftrags. Der PDF-Export war in den Tests komplett ausgeklammert (jsPDF wird dort abgeklemmt) - also nie geprueft.

**Der Fund - und er trifft ausgerechnet die Zielgruppe:**
Der Export nutzt die PDF-Standardschrift "helvetica". Die kennt nur westeuropaeische Zeichen. Alles darueber hinaus wurde **nicht weggelassen, sondern durch ein falsches Zeichen ersetzt**. Am echten Export gemessen:

| Eingabe | landete im PDF |
|---|---|
| `Şeyma Çelik` | `^eyma Çelik` |
| `Łukasz` | `Aukasz` |
| `Nguyễn` | `NguyÅn` |
| `Дмитрий` | `<8B@89` |
| `12 € pro Stunde` | `12  pro Stunde` |
| `„Zitat“ – Strich` | `Zitat  Strich` |

Fuer eine Schueler-Plattform in Deutschland ist das nicht nebensaechlich: Viele Schueler haben tuerkische, polnische, arabische oder russische Namen. Im **wichtigsten Dokument ihrer Bewerbung** stand dann ein entstellter Name - ein Lukasz hiess dort "Aukasz". Und das Euro-Zeichen verschwand ersatzlos.

**Behoben** in `js/pdf.js`: Die vorhandene Emoji-Filterung wurde zu einer vollstaendigen Zeichen-Aufbereitung ausgebaut. Latin-1 (inklusive der deutschen Umlaute) geht unveraendert durch; fuer tuerkische, polnische, rumaenische und serbische Buchstaben gibt es eine Ersatztabelle; Kyrillisch wird in lateinische Umschrift gewandelt ("Dmitrij" statt Zeichenmuell); vietnamesische und andere Akzente werden per Unicode-Zerlegung auf den Grundbuchstaben zurueckgefuehrt; Euro-Zeichen wird zu "EUR", typografische Anfuehrungszeichen und Gedankenstriche zu ihren einfachen Entsprechungen. Was sich gar nicht sinnvoll uebertragen laesst (arabische, chinesische Schrift), wird weggelassen statt als Muell gedruckt.

**Ausserdem:** An drei Stellen ging Text bisher voellig ungefiltert ins PDF (Textbausteine links, Sprachniveau, Absaetze im Anschreiben) - jetzt laufen alle ueber dieselbe Aufbereitung.

**Ehrliche Einschraenkung:** Das ist eine Umschrift, keine originalgetreue Darstellung. "Şeyma" wird zu "Seyma". Der Name ist damit korrekt lesbar, aber nicht exakt geschrieben. Die saubere Loesung waere eine eingebettete Unicode-Schrift - die kostet mehrere hundert Kilobyte Ladezeit bei jedem PDF und loest Arabisch wegen der Schreibrichtung trotzdem nicht. Fuer den Zweck (ein lesbarer Lebenslauf) ist die Umschrift der bessere Kompromiss.

**Dauerhaft abgesichert:** `tests/pdf-zeichen.spec.js` (7 Tests). Die Aufbereitungs-Funktion wird dafuer exportiert, damit der Test **ohne** die PDF-Bibliothek aus dem Netz auskommt - schnell und unabhaengig.

**Suite jetzt: 207 Tests, alle gruen** (vorher 200).

**Nebenbei geprueft:** Ob mehr Test-Arbeiter die Laufzeit senken. Ergebnis: nein (5m48 mit vier statt 5m00 mit Standard). Die Zeit steckt in Wartezeiten der Tests, nicht in Rechenlast - der Rechner hat vier Kerne, mehr Parallelitaet bringt hier nichts.


## Session 24. August 2026 (Teil 7) - Betreiber-Bereich nachgezogen

Runde 12 des Dauerauftrags. Der Admin-Bereich war bisher nur unter Sicherheitsaspekten betrachtet worden, nie auf Bedienbarkeit.

**Der eigentliche Fund war eine Luecke im Vorgehen, nicht im Code:** Ein Abgleich zeigte, dass `admin.html` in **keiner einzigen** der sieben Qualitaetspruefungen der letzten Runden vorkam - weder bei Barrierefreiheit, Tastatur, Tippzielen, Layout-Spruengen, Fehlerzustaenden, Texten noch Schriften. Sechs Runden Verbesserungsarbeit sind an ihm vorbeigelaufen.

**Was die nachgeholte Messung ergab - erfreulich viel war schon in Ordnung:**
- **Tastaturbedienung, Fokus, Layout-Spruenge: alles gruen.** Die zentralen Loesungen aus Runde 4 (`js/tastatur.js`) und Runde 5 (`js/zustand.js`) greifen dort automatisch mit, ohne dass jemand daran gedacht hatte. Genau dafuer waren sie zentral gebaut.
- Bei einer Server-Stoerung zeigt der Bereich korrekt eine ehrliche Meldung statt haengender Platzhalter.

**Zwei echte Fehler gefunden und behoben:**
1. **Vier `<h1>` auf einer Seite** - eines je Reiter (Verifizierung, Firmen, Meldungen, Statistik). Fuer Screenreader-Nutzer ist das eine Seite mit vier Titeln. Jetzt: eine unsichtbare Seiten-h1 ("Betreiber-Bereich"), die Reiter sind h2. Damit stimmt auch die Reihenfolge bis zum h3 im Dokument-Dialog.
2. **Zwei Tippziele unter 44px auf dem Handy** (Logo 132x25, Zurueck-Link 67x41). Ursache: Die Regel aus Runde 10 hiess `nav .logo` - der Betreiber-Bereich hat aber eine eigene Kopfzeile (`header.ll-topbar`), keine `<nav>`. Regel verallgemeinert.

**Zwei Vermutungen, die sich NICHT bestaetigt haben:**
- Ich hielt es fuer moeglich, dass Verifizierungs-Dokumente nur in der Datenbank, nicht im Storage geloescht werden - das waere ein Datenschutzproblem gewesen. **Nachgesehen: falsch.** Die Datei wird zuerst im Storage geloescht, und schlaegt das fehl, bricht der ganze Vorgang ab.
- Ich erwartete fehlende Rueckfragen bei folgenreichen Aktionen. **Auch falsch:** Ablehnen, Verifizierung zurueckziehen und Sperren haben alle eine Zwei-Klick-Bestaetigung direkt am Knopf.

**Nebenbei:** Der ganzseitige Fehlertext versprach "dein Konto und deine Bewerbungen sind sicher" - im Betreiber-Bereich unpassend. Jetzt neutral formuliert.

**Dauerhaft abgesichert:** `admin.html` ist jetzt fester Bestandteil von vier Pruefungen (`a11y`, `tastatur`, `layout-spruenge`, `tippziele-mobil`), damit ihn kuenftige Runden nicht wieder uebersehen.

**Suite jetzt: 200 Tests, alle gruen** (vorher 196).


## Session 24. August 2026 (Teil 6) - Chat robuster gemacht

Runde 11 des Dauerauftrags. Der Chat war der letzte Bereich, den keine Runde angefasst hatte.

**Zwei belegte Fehler:**
1. **Der getippte Text ging beim Fehlschlag verloren.** Das Eingabefeld wurde geleert, *bevor* die Nachricht gesendet war. Schlug das Senden fehl, sah man nur "Nachricht konnte nicht gesendet werden" - und musste alles neu tippen. Jetzt wird erst geleert, wenn die Nachricht wirklich angekommen ist.
2. **Ein Ladefehler sah aus wie ein leerer Chat.** Bei einer Stoerung stand da "Noch keine Nachrichten - schreib die erste!", als waere der ganze Verlauf geloescht. Das ist dasselbe Muster, das Runde 5 an anderen Stellen behoben hatte; der Chat war uebersehen worden. Jetzt sagt er, dass gerade nicht geladen werden konnte - und ein bereits sichtbarer Verlauf bleibt stehen.

**Eine Vermutung, die sich NICHT bestaetigt hat:** Ich hielt das fehlende Abfangen von Netzfehlern beim Senden fuer einen dritten Fehler - das Eingabefeld muesste dauerhaft gesperrt bleiben. **Gegengeprueft gegen den alten Code: war es nicht.** supabase-js gibt solche Fehler als Wert zurueck, statt eine Ausnahme zu werfen. Das Abfangen bleibt als Vorsichtsmassnahme drin, ist aber keine Fehlerbehebung. Der zugehoerige Test ist als Absicherung markiert.

**Zwei Verbesserungen ohne vorherigen Fehler:**
- Wer nach oben scrollt, um aeltere Nachrichten zu lesen, wurde vom 8-Sekunden-Takt alle acht Sekunden wieder nach unten gerissen. Jetzt wird nur noch nach unten gesprungen, wenn man ohnehin unten stand.
- Der Takt pausiert, solange der Tab im Hintergrund liegt, und laedt beim Zurueckkommen sofort einmal nach.

**Wie die Tests geprueft wurden:** Alle vier liefen gegen den **alten** Code, um zu sehen, ob sie die Fehler ueberhaupt fangen. Zwei fielen um (die belegten Fehler), zwei blieben gruen - einer davon war die Gegenprobe, der andere entlarvte meine falsche Vermutung. Ohne diesen Schritt haette ich einen wertlosen Test fuer einen nie existierenden Fehler eingebaut und im Statusbericht behauptet, ihn behoben zu haben.

**Dauerhaft abgesichert:** `tests/chat-robust.spec.js` (4 Tests).

**Suite jetzt: 196 Tests, alle gruen** (vorher 192).


## Session 24. August 2026 (Teil 5) - Tippziele auf dem Handy

Runde 10 des Dauerauftrags. Gemessen auf einem Pixel 7 mit echter Touch-Emulation: Apple und Google empfehlen mindestens **44x44 Pixel** fuer alles, was man mit dem Finger trifft.

**Gefunden - und das betraf fast jede Seite:**
- Der **"Anzeigen"-Knopf am Passwortfeld war 61x15 Pixel** - 15 Pixel hoch. Praktisch nicht zu treffen, und ihn braucht jeder beim Anmelden.
- Das **Hamburger-Menue 38x32**, der **Herz-Knopf auf den Job-Karten 36x36**, die Schliessen-Kreuze im Filter **32x27**, der Wegklick-Knopf der Onboarding-Box **28x28**.
- Dutzende Knoepfe und Eingabefelder lagen bei 38-43 Pixeln, also knapp daneben.
- Eine fruehere Runde hatte 44px-Regeln eingefuehrt, aber **nur fuer den Lebenslauf-Editor**. Der Rest der Seite war ungedeckt.

**Behoben** ueber eine erweiterte `@media (pointer: coarse)`-Regel: Menue-Knoepfe, Glocke, Passwort-Umschalter, Schliessen-Kreuze, Teilen-Knopf, Herz-Knopf, alle `.btn`, Kategorie-Pills, Seitenmenue-Eintraege, Eingabefelder, Auswahlmenues, Footer-Links und das Logo.

**Ergebnis:** Von 10 zu kleinen Zielen auf der Jobboerse und 10 im Dashboard auf **null** - auf allen sieben geprueften Seiten.

**Zwei bewusste Ausnahmen, beide nach Pruefung:**
- Die **Einwilligungs-Checkbox** ist nur 18x18 - sie sitzt aber in einem `<label>`, also ist der ganze Text die Trefferflaeche. Sah in der Messung wie ein Fehler aus, ist keiner.
- Der **Jobtitel-Knopf** im Dashboard ist 25px hoch. Er existiert nur, damit die Karte per Tastatur erreichbar ist (Runde 4); angetippt wird die ganze Karte.

**Nebenbefund:** Auf dem Handy standen **Logo und der Knopf rechts daneben ohne jeden Abstand** direkt aneinander (beide bei exakt 205px). Nachgemessen mit dem alten CSS: **das gab es schon vorher** - es fiel nur weniger auf, solange das Logo halb so hoch war wie der Knopf. Jetzt mit `gap: 12px`.

**Ebenfalls gegengeprueft:** Der Umbruch der Sortier-Zeile auf dem Handy sah nach einer neuen Verschlechterung aus. Messung mit altem und neuem CSS: bestand vorher genauso (Filter y=339 vs. 344). Kein neuer Schaden.

**Dauerhaft abgesichert:** `tests/tippziele-mobil.spec.js` (10 Tests, laeuft im Mobil-Projekt): kein Tippziel unter 44px auf acht Seiten, Abstand in der Kopfzeile, keine Seite scrollt waagerecht.

**Suite jetzt: 192 Tests, alle gruen** (vorher 182). Ein Durchlauf zeigte einen roten Test, der einzeln sofort gruen war - Parallel-Last, kein Defekt. Zweiter Volldurchlauf: alles gruen.


## Session 24. August 2026 (Teil 4) - Datenabfragen beim Laden

Runde 9 des Dauerauftrags. Frage: Wie viele Abfragen laufen beim Oeffnen einer Seite, und warten sie unnoetig aufeinander?

**Gemessen (alle Abfragen mit Zeitstempel mitgeschnitten):**
- Oeffentliche Seiten sind sparsam: Jobboerse und Startseite je **eine** Abfrage, Job-Detail zwei (Job + Bewertungen, parallel). Nichts zu tun.
- **Schueler-Dashboard: sechs Abfragen, davon fuenf hintereinander.** Von der ersten bis zur letzten vergingen rund **1000ms** - fast reine Warteschlange, weil jede erst startete, wenn die vorige fertig war.
- **Die Tabelle `nachrichten` wurde ZWEIMAL abgefragt** - mit exakt derselben Bedingung. Einmal fuer das Zahlen-Abzeichen in der Seitenleiste, einmal fuer die Glocke oben rechts. Die zweite Abfrage holte dabei alles, was die erste wissen wollte.

**Behoben:**
- `sammle()` in `js/notifications.js` gibt die Zahl ungelesener Nachrichten jetzt mit zurueck, statt sie wegzuwerfen. `initGlocke()` reicht sie ueber `onUngelesen` ans Dashboard weiter. Die separate Zaehl-Abfrage entfaellt.
- Die Glocke startet jetzt **vor** `await ladeJobs()` statt danach. Sie braucht nur die eigene Profil-ID und kann parallel laufen.

**Ergebnis:** Von sechs Abfragen laufen jetzt nur noch **zwei** hintereinander statt fuenf. Die Spanne von der ersten bis zur letzten Abfrage sank von rund **1000ms auf 300ms**.

**Wichtig zur Messung:** Die absoluten Ladezeiten schwankten zwischen den Durchlaeufen um mehrere Sekunden, je nach Rechnerlast. Aussagekraeftig ist nur die **Spanne zwischen erster und letzter Abfrage** - die misst die Warteschlange selbst. Deshalb pruefen die Tests auch keine Millisekunden, sondern **wie oft welche Tabelle gefragt wird**: das ist reproduzierbar.

**Bewusst NICHT geaendert:** Die Tabelle `bewerbungen` wird weiterhin zweimal abgefragt - einmal vom Dashboard (alle Bewerbungen), einmal von der Glocke (nur die mit Statusaenderung). Die beiden haben unterschiedliche Filter, liegen in verschiedenen Modulen und laufen inzwischen **parallel**. Sie zusammenzulegen wuerde die Module aneinanderbinden, ohne dass der Nutzer etwas davon merkt.

**Dauerhaft abgesichert:** `tests/datenabfragen.spec.js` (5 Tests): Nachrichten nur einmal, Gesamtzahl der Abfragen gedeckelt, Glocke nicht am Ende der Kette, oeffentliche Seiten mit genau einer Abfrage.

**Suite jetzt: 182 Tests, alle gruen** (vorher 177).


## Session 24. August 2026 (Teil 3) - Texte und Teilen-Vorschau

Runde 8 des Dauerauftrags. Frage: Verstehen 13-Jaehrige die Texte?

**Ehrliches Ergebnis: Die Texte sind bereits gut.** Gemessen ueber alle Seiten: 5-8 Woerter pro Satz im Schnitt, genau **ein** Satz ueber 20 Woertern. Da war fast nichts zu holen. (Zwischendurch meldete die Messung faelschlich "keine schweren Woerter" - die Wortsuche war kaputt, ein Escaping-Fehler im Pruefskript. Erst nach der Reparatur kamen echte Treffer. Ohne die Gegenprobe haette ich ein falsches "alles gut" gemeldet.)

**Die wenigen echten Treffer:**
- "Verfuegbarkeit" stand als Lebenslauf-Baustein und auf der Startseite - fuer einen 13-Jaehrigen ein Amtswort. Jetzt: **"Wann ich Zeit habe"**. In den Firmen-Formularen bleibt es stehen (Erwachsene), in den Rechtstexten ebenso.
- Auf der Job-Detailseite stand "ein kostenloses (verifiziertes) Schueler-Konto" - eine Klammer mitten im Satz, die nichts erklaert. Jetzt ausgeschrieben: "Wir pruefen einmal kurz, ob du wirklich Schueler:in bist."
- "Match"/"Matching" bleibt: Das ist der Produktname.

**Der eigentliche Fund lag woanders.** Beim Durchsehen der Seiten-Metadaten fiel auf: **Open Graph gab es nur auf zwei von 15 Seiten** - ausgerechnet nicht auf `job.html`, der einzigen Seite mit einem eingebauten "Link kopieren"-Knopf. Wer einen Job per WhatsApp weiterschickte, verschickte nur eine nackte URL ohne jede Vorschau. Fuer eine Plattform, die ueber Weiterempfehlung waechst, ist das teuer.

**Behoben:**
- `job.html` und `jugendarbeitsschutz.html` haben jetzt Teilen-Angaben.
- `js/job-detail.js` schreibt sie nach dem Laden auf den **echten Job** um: Titel mit Ort, dazu Stundenlohn, Mindestalter und Arbeitszeit als Beschreibung.

**Ehrliche Einschraenkung:** Dienste wie WhatsApp fuehren kein JavaScript aus und sehen daher die allgemeine Fassung ("Minijob fuer Schueler"), nicht den konkreten Jobtitel. Job-genaue Vorschauen braeuchten serverseitiges Rendering, das es bei statischem Hosting nicht gibt. Die allgemeine Vorschau ist trotzdem deutlich besser als gar keine.

**Offen geblieben (bewusst):** Es gibt **kein `og:image`** - auf keiner Seite. Beim Teilen erscheint also nur Text, kein Bild. Das Logo ist 480x91 Pixel und damit zu schmal; empfohlen sind rund 1200x630. Dafuer muesste erst ein Banner-Bild gestaltet werden - eigenes Thema, kein Nebenbei-Fix.

**Dauerhaft abgesichert:** `tests/texte-und-teilen.spec.js` (9 Tests): kein Satz ueber 25 Woertern, Schnitt unter 15, kein Amtsdeutsch auf der Startseite, Teilen-Angaben auf allen vier oeffentlichen Seiten vorhanden und auf dem Job-Detail mit dem echten Titel gefuellt.

**Suite jetzt: 177 Tests, alle gruen** (vorher 168). Ein bestehender Mobil-Test musste mitgezogen werden, weil er auf den alten Baustein-Namen klickte.


## Session 24. August 2026 (Teil 2) - Layout-Spruenge

Runde 7 des Dauerauftrags. Frage: Springt der Inhalt beim Laden weg, waehrend man schon liest oder tippt? Gemessen wurde die echte Verschiebung im Browser (CLS ueber einen PerformanceObserver), nicht das Markup.

**Die Ausgangsvermutung war falsch - und das war der wichtigste Teil der Messung.**
Kein einziges `<img>` hat `width`/`height`-Attribute, was normalerweise die Hauptursache fuer springende Seiten ist. Die Messung zeigte aber: **alle Bilder haben feste Groessen per CSS**, sie springen nicht. Haette ich einfach ueberall Attribute ergaenzt, waere viel Arbeit fuer null Wirkung entstanden.

**Die echten Verursacher waren nachgeladene Inhalte ohne reservierten Platz:**
1. **Job-Detailseite: 0,12** (Googles Grenze fuer "gut" liegt bei 0,1). Die Seite zeigt beim Aufruf nur "Lade Job..." - eine Zeile. Kam der echte Inhalt, wuchs sie schlagartig und der Footer rutschte sichtbar nach unten. Besonders aergerlich, weil diese Seite ueber Google gefunden wird.
2. **Schueler-Dashboard: 0,14.** Ueber der Suchleiste stehen drei zunaechst leere Kaesten (Statistik, Verifizierungs-Hinweis, Onboarding-Box), die per JS gefuellt werden. Zusammen schoben sie beim Laden alles darunter um rund 246px nach unten - gemessen an `search-hero`, das von y=201 auf y=447 sprang.

**Behoben:**
- `#job-detail` bekommt eine Mindesthoehe, der Platz ist von Anfang an da.
- `#stats-row` reserviert seine gemessenen 96px. Diese Zeile ist **immer** da und **immer** gleich hoch, deshalb ist die Reservierung gefahrlos.
- `renderOnboarding()` laeuft jetzt **vor** dem Laden der Jobs statt danach. Der zweite Aufruf aktualisiert nur noch ein Haekchen - gleiche Hoehe, kein Sprung.

**Ergebnis:** Job-Detail 0,12 -> 0,07. Schueler-Dashboard 0,14 -> 0,09. Alle Seiten liegen jetzt unter Googles Schwelle.

**Bewusst NICHT behandelt:** Der Verifizierungs-Hinweis und die Onboarding-Box bekommen keine feste Hoehe. Beide koennen dauerhaft verschwinden (weggeklickt bzw. alles erledigt) - dann bliebe fuer immer eine leere Luecke stehen. Ein kurzer Sprung beim Laden ist das kleinere Uebel als ein Dauerloch. Ebenso bleibt beim Job-Detail ein Restsprung von 0,07, weil Stellenbeschreibungen unterschiedlich lang sind und die exakte Hoehe vorher niemand kennt.

**Dauerhaft abgesichert:** `tests/layout-spruenge.spec.js` (8 Tests) misst die echte Verschiebung auf sieben Seiten und laesst nichts ueber 0,1 durch.

**Suite jetzt: 168 Tests, alle gruen** (vorher 160).


## Session 24. August 2026 - Formular-Fehlermeldungen

Runde 6 des Dauerauftrags. Frage: Versteht man beim Registrieren, Anmelden und Passwort-Zuruecksetzen, was schiefging und was zu tun ist?

**Der Hauptfund - eine Sackgasse im wichtigsten Trichter:**
Das Registrierungsformular verlangte **8 Zeichen**, Supabase aber **10** (die Mindestlaenge wurde am 28.7. erhoeht, das Formular blieb stehen). Wer 8 oder 9 Zeichen eintippte, kam durch die Formularpruefung, wurde vom Server abgelehnt - und bekam nur die generische Meldung *"Registrierung momentan nicht moeglich. Bitte pruefe deine Eingaben"*. Der eigentliche Grund wurde **nie genannt**. Beim Passwort-Zuruecksetzen fehlte die Pruefung ganz und der **rohe englische Supabase-Text** wurde angezeigt ("Password should be at least 10 characters.").

**Behoben:**
- Mindestlaenge an fuenf Stellen auf 10 vereinheitlicht (`register.html`, `reset-password.html`, Pruefung und Staerke-Anzeige in `js/auth.js`). Die Meldung steht am Feld und nennt die Zahl.
- `js/reset-password.js`: prueft jetzt vorher selbst, faengt Netzausfaelle ab und uebersetzt die drei realistischen Server-Antworten ins Deutsche (zu kurz / Link abgelaufen / sonstiges) statt den englischen Rohtext durchzureichen.
- **`verstaendlich(error)` in `js/zustand.js` (neu)**: macht aus technischen Fehlern einen Satz, den auch ein 13-Jaehriger versteht. An **10 nutzersichtbaren Stellen** eingesetzt (4x Schueler-Dashboard, 6x Firmen-Dashboard) - darunter das Absenden einer Bewerbung, der wichtigste Moment fuer einen Schueler. Vorher stand dort `"Fehler: " + error.message`, also englischer Text mit Tabellen- und Spaltennamen.
- **Im Admin-Bereich bleibt der technische Text bewusst stehen** - dort hilft er beim Nachsehen, was los war.

**Dauerhaft abgesichert:** `tests/formular-fehler.spec.js` (4 Tests). Nagelt vor allem fest, dass Formular und Server dieselbe Mindestlaenge verlangen - genau das Auseinanderlaufen war die Ursache.

**Suite jetzt: 160 Tests, alle gruen** (vorher 156).


## Session 23. August 2026 (Teil 6) - Fehler- und Leerzustaende

Runde 5 des Dauerauftrags. Frage: Was sieht man, wenn nichts da ist oder etwas schiefgeht? Dazu die Datenbank kuenstlich kaputtgemacht (Server antwortet mit 500) und das Netz komplett gekappt, und dann auf jeder Seite nachgesehen, was ankommt.

**Der schwerwiegendste Fund - ein echter Bug, kein Schoenheitsfehler:**
Bei einer Server-Stoerung landeten eingeloggte Nutzer in einer **endlosen Weiterleitungsschleife**. Ursache in `js/session.js`: Ein fehlgeschlagener Profil-Abruf lieferte `null`, und die Rollenpruefung `profile?.role !== expectedRole` behandelte das wie "falsche Rolle" - also Weiterleitung. Weil dort dasselbe passierte, lud sich die Seite immer wieder neu, solange der Server nicht antwortete. Gemessen: 5 Seitenaufrufe in 6 Sekunden, ohne Ende. Eine **Firma landete dabei zusaetzlich im Schueler-Dashboard**. Jetzt wird zwischen "konnte nicht laden" und "andere Rolle" unterschieden; nur der zweite Fall leitet weiter, und niemals auf die Seite, auf der man schon steht.

**Die weiteren Funde:**
1. **Eine Stoerung wurde als Leerzustand ausgegeben.** Ueberall stand `if (error || !daten.length)` und zeigte dann "Aktuell keine Jobs - schau bald wieder vorbei!". Das ist die schlimmste aller Antworten: Sie klingt glaubwuerdig, also kommt niemand wieder. Betraf Startseite, Jobboerse, Job-Detail, beide Dashboards.
2. **Ohne Netz blieben die grauen Platzhalter fuer immer stehen.** Ein Netzausfall wirft eine Ausnahme statt `error` zurueckzugeben - die Ladefunktion brach mittendrin ab, und niemand raeumte auf. Auf `job.html` stand dauerhaft "Lade Job...".
3. **Die Leerzustaende waren Sackgassen.** "Noch keine Bewerbungen. Stoebere bei den Jobs" - eine Wegbeschreibung statt einer Tuer. Gleiches bei "keine Jobs verfuegbar", "keine passenden Jobs" und "noch keine Jobs gepostet". Einzig der Filter-Leerzustand auf der Jobboerse machte es richtig und hatte einen Knopf.

**Was gebaut wurde:**
- **`js/zustand.js` (neu)** - die gemeinsame Stelle dafuer. `hole()` klammert jeden Supabase-Aufruf so ein, dass ein Netzausfall genauso ankommt wie ein Serverfehler. `zeigeLadefehler()` ersetzt einen Listenbereich durch eine ehrliche Meldung mit "Nochmal versuchen"-Knopf, `zeigeSeitenfehler()` macht dasselbe ganzseitig fuer die Dashboards (dort ergibt die Seite ohne Profil keinen Sinn).
- **Wichtige Feinheit:** `PGRST116` (bei `.single()` = "kein Treffer") gilt bewusst NICHT als Stoerung. Sonst bekaeme jeder tote Job-Link eine "Verbindungsproblem"-Meldung statt "gibt es nicht mehr". Genau das ging beim Umbau kurz kaputt - der bestehende Test `job-detail.spec.js` hat es gefangen.
- **Jeder Leerzustand hat jetzt eine Tuer**: Jobboerse leer -> "Profil anlegen" / "Ich suche Schueler"; Schueler ohne passende Jobs -> "Alle Jobs ansehen" (die Dashboard-Liste ist nach Alter gefiltert, die offene Boerse nicht); Schueler ohne Bewerbungen -> "Jobs ansehen" als richtiger Knopf statt Fliesstext-Link; Firma ohne Anzeigen -> "Ersten Job posten"; Dashboard-Filter ohne Treffer -> "Filter zuruecksetzen" (fehlte dort, anders als auf der Jobboerse).
- **Optisch unterscheidbar:** Stoerung = warmes Rot mit Warnzeichen, Leere = neutrales Symbol. Auf einen Blick erkennbar, ob etwas kaputt ist oder einfach nichts da.

**Ergebnis der Nachmessung:** Weiterleitungsschleife weg (5 Aufrufe -> 1, Firma bleibt im Firmen-Dashboard). Alle Stoerungsfaelle melden sich ehrlich und bieten einen Weg nach vorn. Keine haengenden Platzhalter mehr - ohne Netz dauert es rund 8 Sekunden, weil supabase-js viermal wiederholt, aber es endet.

**Dauerhaft abgesichert:** `tests/zustaende.spec.js` (14 Tests) haelt drei Regeln fest: eine Stoerung sagt, dass sie eine ist; eine Stoerung wird nie als Leerzustand ausgegeben; ein Leerzustand ist keine Sackgasse.

**Suite jetzt: 156 Tests, alle gruen** (vorher 142).

**Nebenbei behoben:** Die zwei Knoepfe im ganzseitigen Fehler waren 4px unterschiedlich hoch. Zwei falsche Vermutungen (Zeilenhoehe, Rahmenlinie) wurden nachgemessen und verworfen - die Ursache war ein `margin-top: 4px` am Knopf, den der Flex-Container beim Strecken abzieht.

**Bewusst NICHT geaendert:** Die rund 8 Sekunden bis zur Fehlermeldung ohne Netz. Die kommen von den Wiederholungsversuchen in supabase-js, und die sind sinnvoll - kurze Funkloecher werden so ueberbrueckt, ohne dass der Nutzer etwas merkt. Ein Zwischenhinweis ("dauert laenger als sonst") waere denkbar, aber zusaetzliche Mechanik fuer einen seltenen Fall.


## Session 23. August 2026 (Teil 5) - Tastaturbedienung & Fokus-Sichtbarkeit

Runde 4 des Dauerauftrags. Frage: Kann man die Seite komplett ohne Maus bedienen - und sieht man dabei immer, wo man gerade steht? Erst gemessen (Wegwerf-Skripte, die jedes fokussierbare Element anspringen und den gerenderten Fokus-Stil auslesen), dann gefixt, dann neu gemessen.

**Was die Messung fand (alles echte Fehler, keine Theorie):**
1. **Auf jeder Filterseite war KEIN einziges Eingabefeld sichtbar fokussiert.** Sechs Felder auf `jobs.html` und im Schueler-Dashboard, dazu die grosse Suche auf der Startseite. Ursache: mehrere CSS-Regeln setzen `outline: none` und zeigen den Fokus nur ueber eine dezent geaenderte Rahmenfarbe - mit der Maus faellt das nicht auf, per Tab-Taste verliert man die Orientierung komplett.
2. **Die Rollen-Auswahl auf Login und Registrierung war per Tastatur gar nicht erreichbar.** "Ich bin Schueler" / "Ich bin Arbeitgeber" waren `<div>` mit `onclick` - kein Tabstopp, kein Enter. Wer keine Maus benutzt, konnte sich nicht als Firma registrieren.
3. **Kein einziger modaler Dialog reagierte auf Escape**, der Fokus sprang beim Oeffnen nicht hinein und blieb auch nicht darin. Man tabbte hinter den offenen Dialog und sah nichts mehr. Betraf alle `.modal-overlay` (Job-Detail auf Jobboerse und im Dashboard, Bewerbung, Chat, Admin-Dokumente, Melden).
4. **Job-Karten im Schueler-Dashboard waren per Tastatur nicht zu oeffnen** - der Klick-Handler haengt nur am Klick-Ereignis. (Auf der Jobboerse ging Enter, aber nicht die Leertaste, obwohl die Karte `role="button"` traegt.)
5. **Kein "Zum Inhalt springen"-Link** auf allen 15 Seiten - man muss sich auf jeder Unterseite neu durch die komplette Navigation tabben.
6. Das Seitenmenue auf dem Handy schob sich ueber den Inhalt, ohne den Fokus mitzunehmen, und liess sich nicht mit Escape schliessen.

**Was gebaut wurde:**
- **`js/tastatur.js` (neu, auf allen 15 Seiten eingebunden)** - eine zentrale Stelle statt Flickwerk pro Seite. Sie baut den Sprunglink, gibt jedem `.modal-overlay` beim Oeffnen `role="dialog"`/`aria-modal`, schickt den Fokus hinein, haelt ihn per Tab-Falle darin, schliesst auf Escape (ueber den echten Schliessen-Knopf, damit die Aufraeum-Logik der Seite mitlaeuft) und setzt den Fokus danach zurueck auf den Knopf, der den Dialog geoeffnet hat. Ein MutationObserver erfasst auch spaeter erzeugte Dialoge (Melden-Dialog). Das Seitenmenue laeuft ueber denselben Mechanismus, aber nur im Handy-Layout (erkannt daran, ob der Hamburger-Knopf sichtbar ist) und ohne Dialog-Rolle, weil es eine `<nav>` bleibt.
- **Fokus-Block in `css/style.css`** (bewusst ganz am Ende, damit er die frueheren `outline: none`-Regeln ueberschreibt): einheitlicher Ring fuer alle Felder, `[tabindex]` und `[role=button]` - per `:focus-visible`, also nur bei Tastaturbedienung. Beim Mausklick ins Feld aendert sich nichts. Dazu die `.skip-link`-Optik (unsichtbar, faehrt bei Fokus von oben ein).
- **Rollen-Auswahl** in `login.html` und `register.html` sind jetzt echte `<button type="button">` mit `aria-pressed`. Damit funktionieren Tab, Enter und Leertaste ohne eigenen Code. CSS-Reset ergaenzt, damit sie optisch unveraendert bleiben (per Screenshot geprueft).
- **Job-Karten**: auf der Jobboerse loest jetzt auch die Leertaste aus (mit `preventDefault`, sonst scrollt die Seite weg). Im Schueler-Dashboard wurde der **Jobtitel zu einem echten Knopf** - dort enthaelt die Karte bereits Knoepfe zum Merken und Bewerben, und ein `role="button"` um Knoepfe herum liest sich in Screenreadern falsch.

**Ergebnis der Nachmessung:** null Befunde auf allen 11 oeffentlichen Seiten und in beiden Dashboards. Alle Dialoge: Fokus springt hinein, bleibt drin, Escape schliesst, Fokus kehrt zurueck.

**Dauerhaft abgesichert:** `tests/tastatur.spec.js` (21 Tests) - die Messung selbst wurde zum Test umgebaut, damit das nicht zurueckfaellt. Prueft je Seite jedes fokussierbare Element auf sichtbaren Fokus, den Sprunglink (erster Tabstopp, faehrt sichtbar ein, landet wirklich im `<main>`), die Rollen-Knoepfe, das komplette Dialog-Verhalten inkl. Fokus-Rueckgabe und das Seitenmenue.

**Suite jetzt: 142 Tests, alle gruen** (vorher 121).

**Bewusst NICHT geaendert:** Die `outline: none`-Regeln weiter oben im CSS bleiben stehen - sie werden vom neuen Block am Dateiende ueberschrieben. Sie herauszunehmen haette jede einzelne Regel angefasst, ohne dass sich am Ergebnis etwas aendert. Ebenfalls nicht angefasst: eine echte Pfeiltasten-Navigation fuer die Rollen-Auswahl (ARIA-Tabs-Muster) - zwei Umschalt-Knoepfe mit `aria-pressed` sind hier das einfachere und robustere Muster.


## Session 23. August 2026 (Teil 4) - Schriftschnitte: Ladezeit UND Darstellung

Nicht geraten, sondern im Browser gemessen: fuer jedes sichtbare Element die tatsaechlich gerenderte Kombination aus Schriftfamilie und Gewicht gesammelt und mit dem verglichen, was die Seite von Google Fonts laedt.

### Zwei Arten von Fehlern gefunden
1. **Geladen, aber nie benutzt**: Space Grotesk 500 - reine Ladezeit-Verschwendung.
2. **Benutzt, aber nicht geladen** (das war die Ueberraschung): Inter 900, IBM Plex Mono 600 und 700. Fehlt ein Schnitt, rechnet der Browser ihn **kuenstlich hoch** ("faux bold") - sichtbar unsauberer Fettdruck. Das war ein Darstellungsfehler, den vorher niemand bemerkt hatte.

### Ursache in allen Faellen: geerbtes "bolder"
`<b>` bedeutet nicht "700", sondern "fetter ALS der Elternwert". In einem Element mit Gewicht 600 landet das bei **900**. Betroffen:
- `<b id="radius-wert">` im Umkreis-Filter (Label hat 600) -> Inter 900
- Mono-`<h4>` in der Lebenslauf-Vorschau -> Mono 700 (Mono gibt es nur in 400/500)
- `.ll-karte-typ` erbt 600 von der Kartenkopfzeile -> Mono 600
- Kleingedrucktes in der Elterneinwilligung erbt 600 vom Label
- `<b>` im Sprach-Abzeichen ("C1") -> Mono 600

### Behoben
Ueberall feste Gewichte statt relativer Vererbung gesetzt; Space Grotesk 500 aus der Font-URL aller 16 Seiten entfernt.
**Endstand gemessen: kein fehlender Schnitt, kein ungenutzter.**

### Tests: 120 -> 121, alle gruen
Neu `tests/schriften.spec.js`: sammelt ueber 13 Seiten alle gerenderten Familie/Gewicht-Kombinationen und prueft beide Richtungen - nichts Verlangtes darf fehlen, nichts Geladenes ungenutzt bleiben. Faengt kuenftig auch ein versehentliches `<b>` in einem 600er-Kontext.

## Session 23. August 2026 (Teil 3) - Ladezeit: jsPDF wird nachgeladen

### Gemessen (Live-Transfergroessen, mit Brotli)
| Ressource | Groesse |
|---|---|
| index.html / jobs.html | 4,5 / 2,4 KB |
| style.css | 19,5 KB |
| **jsPDF** | **93 KB** |
| pdf.js | 72 KB (wurde schon bei Bedarf geladen) |
| Schriften | 20 Dateien / 357 KB gesamt, 9 Schnitte |
| supabase-js (Einstieg) | 4,7 KB |

### Behoben
`jspdf.umd.min.js` hing als fester `<script>`-Tag in **drei** Seiten (dashboard-schueler, dashboard-firma, lebenslauf) und wurde bei jedem Aufruf geladen - gebraucht wird es aber nur, wenn wirklich ein PDF entsteht. Eine Firma, die nur Bewerber durchsieht, lud 93 KB umsonst.
- `js/pdf.js` laedt jsPDF jetzt selbst nach (`ladeJsPdf()`, merkt sich das laufende Promise, damit parallele Aufrufe nur einmal laden). Alle PDF-Wege laufen ohnehin durch `baueDokument()` - eine einzige Stelle.
- Die drei Script-Tags entfernt. Fehlerbehandlung der Aufrufer vorher geprueft: `ladeLebenslaufAlsPdf` faengt ab und zeigt einen Toast, `lebenslaufAlsBlob` wird vom Aufrufer umschlossen.
- CSP erlaubt cdnjs bereits - das dynamisch eingefuegte Script laeuft.

### Stolperfalle beim Pruefen dokumentiert
Der erste Testlauf meldete 2 von 3 Tests rot - aber die Fehler waren **Zeitueberschreitungen**, keine gescheiterten Pruefungen: Der Rechner war durch OneDrive-Sync blockiert (3 Tests brauchten 4,4 Minuten statt 20 Sekunden, selbst `echo` lief in einen Timeout). Wiederholung nach der Beruhigung: 3/3 gruen in 13,6 Sekunden. **Lehre**: Bei roten Tests immer erst die Fehlerart ansehen - Timeout unter Last ist kein Defekt. Zwischenzeitlich wurde nichts committet, die Live-Seite blieb unberuehrt.

### Tests: 117 -> 120, alle gruen
Neu `tests/pdf-nachladen.spec.js`: Dashboard und Firmen-Dashboard laden jsPDF nachweislich NICHT vorab; die Lebenslauf-Vorschau laedt es bei Bedarf nach und erzeugt ein echtes PDF (dafuer wird das CDN in genau diesem Test wieder zugelassen). PDF-Erzeugung war vorher gar nicht getestet.

### Offen fuer die naechste Runde
Schriften: 9 Schnitte (Inter 400/500/600/700, Space Grotesk 500/600/700, IBM Plex Mono 400/500). Pruefen, welche wirklich benutzt werden - je eingesparter Schnitt rund 15-20 KB.

## Session 23. August 2026 (Teil 2) - Barrierefreiheit systematisch
Erste Runde des Dauerauftrags "Webseite laufend verbessern". Bereich: Barrierefreiheit - vorher nie systematisch geprueft.

### Gefunden (eigenes Audit-Skript ueber 13 Seiten)
- **4 Seiten ohne h1** (login, register, forgot-/reset-password) - Screenreader-Nutzer, die per Ueberschrift navigieren, landen im Nichts.
- **Dashboard hatte 6x h1** (eine je Ansicht) statt einer.
- **lebenslauf.html hatte gar keine h1.**
- **~15 Eingabefelder ohne Namen**: teils nur Platzhalter (verschwinden beim Tippen, werden unzuverlaessig vorgelesen), teils `<label>` OHNE `for=` - die Beschriftung gehoerte technisch zu keinem Feld. Betroffen u.a. Suchfelder, alle Sprach-/Faehigkeiten-Zeilen und die versteckten Datei-Auswahlfelder.
- **Ueberschriften-Spruenge** h1 -> h3/h4.

### Behoben
- `.sr-only`-Hilfsklasse ergaenzt (unsichtbar, aber vorgelesen).
- Auth-Seiten: h2 -> h1 (Aussehen unveraendert ueber CSS).
- Dashboard: genau eine h1 (unsichtbar), Ansichts-Titel als h2. lebenslauf.html: unsichtbare h1.
- Alle Felder benannt - entweder per `<label for=>` oder `aria-label`.
- Deko-Karten im Hero nutzten `<h4>` fuer Beispieltext -> jetzt `div.match-card-name` (keine Pseudo-Ueberschrift mehr).
- Unsichtbare Zwischenueberschrift vor den Trefferlisten, damit h1 -> h3 nicht springt.

### Bewusst NICHT geaendert
`KEINE_META_DESCRIPTION` auf 404/Dashboard/Lebenslauf: alles `noindex`-Seiten, dort ist eine Beschreibung zwecklos. War eine Schwaeche der eigenen Pruefung, kein Seitenfehler.

### Tests: 104 -> 117, alle gruen
Neu `tests/a11y.spec.js`: prueft dauerhaft alle 13 Seiten auf Alternativtexte, benannte Felder und Bedienelemente, genau eine h1, keine Ueberschriften-Spruenge, lang-Attribut und `<main>`-Landmark.

## Session 23. August 2026 - Ueberlaeufe behoben + Lebenslauf handytauglich

### Vorgehen: gemessen statt geschaut
Eigenes Audit-Skript ueber alle Seiten bei 360/390/768px, das drei Dinge erkennt: Seite scrollt seitlich, Element ragt ueber den Fensterrand, Inhalt breiter als seine Box. Danach gezielt die Ursachen behoben und neu gemessen.

### Behobene Ueberlaeufe
- **Startseite scrollte seitlich** (412px bei 360px Fenster): `.kat-grid` zwang 2 Spalten, die langen Woerter ("Organisation") sprengten sie. Fix: `min-width:0` auf den Kacheln + kleinere Polster/Schrift unter 560px.
- **Rechtstexte**: `Datenschutzerklaerung` als 2.1rem-Ueberschrift lief ueber den Rand und liess die Seite scrollen. Fix: `overflow-wrap: break-word` + `hyphens: auto` global fuer Text-Elemente, Ueberschrift unter 560px kleiner.
- **Job-Karten ragten 8px raus**: `.jobs-grid` nutzte `minmax(320px, 1fr)` - bei nur 312px Platz wurden die Karten trotzdem auf 320px gezwungen. Fix: `minmax(min(320px, 100%), 1fr)`.
- **Ort/Kategorie/Arbeitszeit** auf Job-Karten konnten nicht umbrechen (`display:flex` ohne `flex-wrap`). Fix: `flex-wrap: wrap`.
- Bewusst NICHT "behoben": die schraeg gedrehten Deko-Karten im Hero (9px Schattenflaeche) und die Glocken-Blase, die absichtlich auf der Ecke sitzt. Beides verursacht kein seitliches Scrollen.

### Lebenslauf-Editor auf dem Handy
Gemessen mit **echter Touch-Emulation** (Pixel 7) - wichtig, weil `(pointer: coarse)`-Regeln bei blossem `setViewportSize` nicht greifen.
- **Eingabefelder waren 128px breit** (Schule/Klasse in zwei Spalten). Fix: unter 620px eine Spalte -> jetzt ~306px.
- **Im Sprachen-Block war ein Feld nur 8px breit**: Das Niveau-Dropdown ("Muttersprache") nahm die Zeile ein, das Namensfeld mit `flex:1` schrumpfte auf 8px. Fix: `.zeilen-editor` bricht auf schmalen Schirmen um, Name bekommt eine eigene Zeile.
- **Karten-Knoepfe (hoch/runter/loeschen) waren 19x24px** - kaum treffbar. Fix: 40x40 bei Touch. Ebenso vergroessert: Loeschen-Knopf in Zeilen (28->44), Umschalter, Vorlagen-Chips, Formulierungshilfe, Eingabefelder auf 44px Hoehe.
- Ergebnis: **kein Tippziel unter 40px mehr**, kein Feld schmaler als 150px.

### Tests: 97 -> 104, alle gruen
Neu `tests/lebenslauf-mobil.spec.js` (7 Tests, laeuft automatisch im Pixel-7-Projekt): Touch erkannt, kein Seitwaerts-Scrollen, einspaltige Felder, keine zu schmalen Felder, alle Tippziele gross genug, Tippen wird gespeichert, Vorschau-Umschalter, Abschnitt hinzufuegen.

## Session 22. August 2026 (Teil 6) - Filter komplett hinter einen Knopf + Dark Mode entfernt

### Filter jetzt auf JEDEM Geraet hinter einem Knopf
Wunsch des Nutzers: ein Knopf "Filter", der das Panel oeffnet - nicht nur auf dem Handy.
- Die feste Filterspalte auf dem Desktop ist weg. Stattdessen faehrt das Panel per Knopf **von links** ein (Desktop) bzw. **von unten** (Handy), jeweils mit abdunkelndem Hintergrund; Klick daneben und Escape schliessen es.
- Die Jobliste beginnt dadurch direkt unter Suche und Kategorien.
- Aktive Filter bleiben als Chips sichtbar, auch wenn das Panel zu ist - man sieht also weiterhin, wonach gefiltert wird, ohne es zu oeffnen.
- Gilt fuer beide Joblisten: `jobs.html` und die Jobs-Ansicht im Schueler-Dashboard.

### Dark Mode entfernt (nur noch heller Modus)
- Umschalter und Theme-Logik aus `js/gate.js` entfernt; `gate.js` enthaelt jetzt nur noch die Zugangssperre.
- Kompletten `:root[data-theme="dark"]`-Block aus `css/style.css` entfernt (rund 2.500 Zeichen) inkl. `.theme-toggle` und der beiden Chat-Regeln. **0 data-theme-Vorkommen** im CSS.
- Wichtig: Es gab **kein** `prefers-color-scheme` im CSS - Dark Mode wurde ausschliesslich ueber `data-theme` gesetzt. Damit reichte das Entfernen der JS-Logik, um es sicher abzuschalten; das CSS-Aufraeumen war reine Hygiene.
- `assets/logo-light.png` bleibt - das wird weiterhin fuer das Logo im dunklen Footer gebraucht.
- Test in `landing.spec.js` umgedreht: prueft jetzt, dass es KEINEN Umschalter gibt und kein dunkles Theme gesetzt ist.

### Endstand (gemessen)
| | vor allen Umbauten | jetzt |
|---|---|---|
| Desktop, erste Job-Karte | 525px (73%) | **395px (49%)** |
| Handy, erste Job-Karte | 718px (85%) | **450px (53%)** |

### Tests: 96 -> 97, alle gruen
Layout-Tests auf Panel-Verhalten umgestellt (oeffnen/schliessen, Escape, Klick daneben, Chips bleiben bei geschlossenem Panel sichtbar).

## Session 22. August 2026 (Teil 5) - Gleiches Filter-Layout im Schueler-Dashboard

**Missverstaendnis geklaert**: Beim Umbau (Teil 4) hatte ich `jobs.html` gemeint (oeffentliche Jobboerse), der Nutzer meinte aber die Jobs-Ansicht in **`dashboard-schueler.html`** - die Seite, die er als eingeloggter Nutzer tatsaechlich sieht. Beide haben eine eigene Jobliste mit eigenem Filter.

- Dashboard-Jobansicht auf dasselbe Muster umgebaut: grosse Suchleiste oben, `jobs-layout` mit sticky Filterspalte links, Ergebnisse rechts, auf dem Handy als einfahrendes Panel mit Zaehler-Blase.
- Beschriftungen: Ort / Umkreis / Bereich / Mindestlohn / Wann arbeiten?. Der **Umkreis-Regler** und **Nur Gemerkte** wandern mit in die Filterspalte (sind ja auch Filter).
- Aktive Filter als entfernbare Chips - inkl. Umkreis ("max. 20 km") und Merkliste.
- `alleFilterZuruecksetzen()` neu; Merkliste-Beschriftung vereinheitlicht auf "Nur Gemerkte".
- Achtung beim Umkreis: `radius-row` ist jetzt eine `.filter-gruppe`, die JS-Zeile setzt daher `display:block` statt `flex`.
- Alle Element-IDs unveraendert -> bestehende Dashboard-Tests gelten weiter.

### Tests: 90 -> 96, alle gruen
`tests/dashboard-filter.spec.js`: Filterspalte + sticky, Beschriftungen, Chips setzen/entfernen, Merkliste-Chip, Zuruecksetzen, Handy-Panel mit Zaehler.

## Session 22. August 2026 (Teil 4) - Jobboerse umgebaut: Layout + Filter
Auf Wunsch des Nutzers ("wie es angeordnet ist und wie es mit dem Filter ist gefaellt mir nicht").

### Vorher gemessen (nicht geraten)
- Desktop 1280x800: erste Job-Karte erst bei **525px** = 73% des Bildschirms nur Kopf und Filter. 11 Kategorie-Pills brachen auf 2 Zeilen um. 5 gleich aussehende Dropdowns OHNE Beschriftung nebeneinander.
- Handy 390x844: erste Karte bei **718px** = 0.8 Bildschirme; die 5 Filterfelder stapelten sich auf 256px Hoehe.
- Dazu: Sortierung steckte zwischen den Filtern (anderes Konzept), kein sichtbarer Aktiv-Zustand, Zuruecksetzen nur im Leerzustand erreichbar.

### Umgebaut
- **Zweispaltiges Layout** (`.jobs-layout`): Filterspalte 250px links (sticky, bleibt beim Scrollen stehen), Ergebnisse rechts. Filter kosten damit keine vertikale Hoehe mehr.
- **Handy**: Filter stecken hinter einem Knopf und fahren als Panel von unten ein (mit abdunkelndem Hintergrund, Escape/Klick daneben schliesst). Zaehler-Blase am Knopf zeigt die Anzahl aktiver Filter.
- **Beschriftungen** fuer jeden Filter (Ort / Dein Alter / Mindestlohn / Wann arbeiten?) statt gleich aussehender Dropdowns; Erklaerhinweis beim Alter.
- **Kategorie-Pills in EINER Zeile** als Wischleiste statt Umbruch ueber zwei Zeilen.
- **Aktive Filter als entfernbare Chips** ueber den Ergebnissen - man sieht sofort, warum weniger Jobs erscheinen, und kann einzeln zuruecknehmen.
- **Sortierung** von den Filtern getrennt, rechts ueber der Ergebnisliste.
- Kopfbereich gestrafft (Abstaende, h1 kleiner).

### Ergebnis (nachgemessen)
- Desktop: 525px -> **378px** (73% -> 47% des Bildschirms)
- Handy: 718px -> **418px** (rund 42% weniger Vorlauf)
- Alle Element-IDs blieben unveraendert, dadurch gelten die bestehenden Jobboersen-Tests unveraendert weiter.

### Nebenbei behoben: lokaler Cache-Aerger
`.claude/launch.json` startet die Vorschau jetzt mit `tests/server.js` statt `python -m http.server`. Der Node-Server sendet `Cache-Control: no-store` - das im Projekt dokumentierte "Browser cached lokal stark, Strg+Shift+R noetig" faellt damit weg. (Beim Pruefen mit der Vorschau trotzdem beachten: der Browser haelt bereits geladene ES-Module hartnaeckig fest; im Zweifel mit Cache-Buster-Parameter neu laden.)

### Wichtig fuer kuenftige Testlaeufe
Laeuft die Vorschau (preview_start) gleichzeitig zur Test-Suite, teilen sich beide Port 5500 - dabei fiel ein Dashboard-Test aus. Vorschau vor einem vollen Testlauf stoppen. Ohne Vorschau: zwei komplette Durchlaeufe hintereinander gruen.

### Tests: 80 -> 90, alle gruen
`tests/jobs-filter.spec.js`: Desktop-Zweispalter + sticky, Beschriftungen, Pills einzeilig, Chips setzen/einzeln entfernen/alles zuruecksetzen, Handy-Panel oeffnen/schliessen, Zaehler-Blase, und zwei Messungen gegen das alte Layout.

## Session 22. August 2026 (Teil 3) - Betreiber-Statistik + Test-Infrastruktur repariert

### Betreiber-Statistik (Admin-Reiter 4)
Frage vorab geklaert: Weder Resend (nur E-Mail-Zustellung) noch Vercel Analytics (nur Besucher) noch die Supabase-Reports (nur technische Werte) kennen Geschaeftszahlen - die stehen nur in der eigenen DB.
- **RPC `betreiber_statistik()`** (SECURITY DEFINER, prueft `ist_admin()` selbst, `revoke` fuer anon). Liefert **nur Summen als jsonb**, keine Inhalte.
- Bewusst eine aggregierende Funktion statt einer Admin-Lesepolicy auf `bewerbungen`: Admins brauchen Zahlen, keine Motivationsschreiben. Gleiche Linie wie beim Chat-Zitat der Melde-Funktion.
- Inhalt: Nutzer (Schueler/verifiziert/Firmen/freigegeben), Aktivitaet (aktive Jobs, Bewerbungen, Bewerbungen je Job, Zusagenquote), "Wartet auf dich" (offene Firmen + Meldungen, nur wenn > 0) und ein 8-Wochen-Verlauf.
- Wochenverlauf als reine CSS-Balken - kein Diagramm-Framework, passend zur Bauweise ohne Build-Tool.
- Live getestet: als Admin Zahlen, als normaler Schueler Fehler 42501.

### WICHTIG: Ursache der wackeligen Tests endlich gefunden
Ueber Wochen fielen einzelne Dashboard-Tests scheinbar zufaellig um. Per Browser-Diagnose (pageerror/requestfailed protokolliert) zeigte sich:
**`python -m http.server` wies unter Parallel-Last Verbindungen ab (ERR_CONNECTION_REFUSED).** Die Dashboard-Seiten laden rund 10 JS-Module gleichzeitig; der Verbindungs-Rueckstau des Python-Servers ist zu klein. Folge: einzelne Module luden nicht, die Modulkette brach ab, `init()` lief nie - erkennbar daran, dass die Seite die HTML-Standardwerte zeigte und KEINE Weiterleitung stattfand.
- **Fix**: eigener kleiner Node-Server `tests/server.js` (kein Fremdpaket), in `playwright.config.js` eingetragen. Zwei komplette Durchlaeufe hintereinander gruen.
- Frueherer Verdacht (CDNs) war nur ein Nebeneffekt. Die dabei entstandenen Verbesserungen bleiben: Fonts/jsPDF werden in Tests abgeklemmt, jsdelivr wird pro Worker gecacht - beides macht die Suite hermetischer und schneller.
- Zusaetzlich: Wartehilfen `warteAufDashboard` / `warteAufAdmin` im Test-Fake. Sie warten, bis das **asynchrone** `init()` durch ist - vorher gingen Klicks auf Sidebar und Reiter ins Leere, weil die Handler erst nach `requireAuth()` gesetzt werden.

### Tests: 75 -> 80, alle gruen (2x bestaetigt)
`tests/admin-statistik.spec.js` mit 5 Tests; der Fake bildet die RPC nach.

## Session 22. August 2026 (Teil 2) - Sicherheits-Hinweise im Chat
Der Chat ist die einzige Stelle, an der ein Schueler direkt mit einem Erwachsenen schreibt - entsprechend abgesichert.

- **Regel-Leiste** in jedem Chat (`sicherheitsLeisteHtml`, natives `<details>`): dauerhaft sichtbar, aufklappbar. Sechs Regeln: nie allein treffen, Eltern Bescheid sagen, keine privaten Daten, nie im Voraus zahlen, im Chat bleiben, Melden-Knopf nutzen.
- **Automatische Warnung** unter empfangenen Nachrichten (`warnungFuer`): drei Kategorien - kontakt (Handynummer oder Messenger-Name), geld (Vorkasse/Kaution/PayPal/Gutschein), treffen (Einladung zum Alleinkommen). Nur bei FREMDEN Nachrichten, Ton bewusst ruhig statt alarmierend.
- Muster bewusst zurueckhaltend: Die Ziffernpruefung entfernt nur Leerzeichen/Bindestriche, **nicht** Punkte - sonst haetten Datumsangaben wie 12.03.2026 falschen Alarm ausgeloest.
- **Zwei Fallen beim Bauen dokumentiert:**
  1. Beim Schreiben per Python-Skript wurden aus Regex-Wortgrenzen echte **Backspace-Zeichen (0x08)** in der Datei - im Terminal unsichtbar, die Erkennung haette nie getroffen. Gefunden per Binaer-Grep auf 0x08. Lehre: generierte Dateien mit Regex immer binaer gegenpruefen.
  2. JS-Wortgrenzen kennen nur ASCII und greifen **nicht vor Umlauten** - das Geld-Muster haette "ueberweisen" nie erkannt. Dort jetzt bewusst ohne Wortgrenze.
- Logik mit 17 Faellen geprueft (Treffer + Fehlalarm-Checks, u.a. loest "Installiere bitte nichts" dank Wortgrenze kein "insta" aus).

### Tests: 69 -> 75, alle gruen
`tests/chat-sicherheit.spec.js` deckt den Chat erstmals ab: Regel-Leiste, alle drei Warntypen, kein Fehlalarm bei normalen Nachrichten, und eigene Nachrichten bekommen weder Warnung noch Melden-Knopf.

## Session 22. August 2026 - Melden-Funktion (Trust & Safety)
Schueler koennen fragwuerdige Jobs und Chat-Nachrichten melden; Meldungen landen im Admin-Bereich.

### Datenbank
- Tabelle `meldungen` (melder_id, typ job/nachricht, job_id/nachricht_id, grund, beschreibung, status offen/geprueft/erledigt, notiz_admin, zitat, gemeldet_user_id) + RLS.
- CHECK-Constraint `meldung_ziel`: genau ein Ziel passend zum Typ. Zwei partielle Unique-Indizes -> dieselbe Sache kann man nur einmal melden (Spam-Schutz).
- RLS: INSERT nur in eigenem Namen; SELECT eigene + Admin; UPDATE/DELETE nur Admin.
- Schutz-Trigger `schuetze_meldung_felder` (Muster aus dem Security-Audit): Nicht-Admins koennen status/notiz_admin nicht selbst setzen - sonst haette man eine Meldung direkt als erledigt anlegen und unsichtbar machen koennen. **Live getestet.**

### Wichtige Design-Entscheidung: kein Admin-Zugriff auf Privatchats
Admins duerfen `nachrichten` bewusst NICHT lesen. Damit eine gemeldete Nachricht trotzdem pruefbar ist, kopiert der SECURITY-DEFINER-Trigger `meldung_zitat_setzen` beim Melden genau diesen einen Inhalt als `zitat` in die Meldung.
- **Dabei entdeckte und geschlossene Luecke**: Ohne Pruefung haette man eine beliebige fremde `nachricht_id` melden koennen und den Text dann ueber die eigene Meldung zurueckgelesen (die SELECT-Policy erlaubt eigene Meldungen). Der Trigger prueft jetzt, ob der Melder ueberhaupt Teil der Konversation ist, sonst Fehler 42501. **Beide Faelle live getestet** (fremder Chat blockiert, eigener Chat erlaubt).

### Frontend
- `js/melden.js`: gemeinsamer Dialog (5 Gruende als Auswahlkarten + Freitext bis 1000 Zeichen + Notfall-Hinweis Polizei 110), `meldeButtonHtml()` fuer einheitliche Buttons. Behandelt Fehler 23505 (schon gemeldet) freundlich.
- Job-Detail im Schueler-Dashboard + fremde Chat-Nachrichten (Button bei Hover, auf Touch dauerhaft).
- Admin: dritter Reiter Meldungen (Filter offen/geprueft/erledigt/alle, Badge mit offener Anzahl, Zitat, Melder, Betroffener, Statuswechsel). Tab-Logik in admin.js von fest-zwei auf generisch umgestellt.
- Datenschutzerklaerung um Meldungen ergaenzt (Datenarten + Speicherdauer), Stand auf 22.8. gesetzt.

### Tests: 60 -> 69, alle gruen
- 3 Tests Melde-Flow im Schueler-Dashboard, 6 Tests fuer den Admin-Reiter (`tests/admin-meldungen.spec.js`, neuer ADMIN-Testnutzer im Fake).
- **Flaky-Ursache gefunden und behoben**: Die Dashboard-Tests luden Google Fonts, jsPDF und pdf.js von echten CDNs. Unter Parallel-Last brach die Module-Kette gelegentlich ab -> `init()` lief nie, Job-Karten fehlten (erkennbar daran, dass die Sidebar die HTML-Standardwerte zeigte und KEINE Weiterleitung stattfand). Fix: `blockiereSchwereCdns()` in `setupDashboard` klemmt fonts.googleapis/gstatic + cdnjs ab. Suite damit hermetisch und rund 25% schneller.

## Session 28. Juli 2026 - Deutsche Auth-Mail-Vorlagen (LIVE)
- Die Supabase-Auth-Mails waren englisch ("Confirm your email address"). Jetzt alle 3 relevanten auf Deutsch im SchuelerMatch-Design (Verlaufsleiste, Typo, Footer wie bei mail-ereignis):
  - **Confirm sign up** -> "Bestaetige deine E-Mail-Adresse"
  - **Reset password** -> "Neues Passwort fuer SchuelerMatch"
  - **Change email address** -> "Bestaetige deine neue E-Mail-Adresse"
- Quelltexte versioniert in `supabase/mail-vorlagen-deutsch.md` (Commit be72aad).
- **Direkt im Dashboard eingetragen** (Claude via Chrome). Technischer Kniff: das Body-Feld ist ein **Monaco-Editor** - Tippen wuerde die HTML-Quotes durch Auto-Complete zerstoeren. Loesung: `window.monaco.editor.getModels()[0].setValue(html)`; der Betreff ist ein React-kontrolliertes Input -> nativer Value-Setter + `input`-Event, sonst merkt React die Aenderung nicht.
- Verifiziert nach komplettem Neuladen: alle 3 Betreffs + deutscher Body persistent, `{{ .ConfirmationURL }}` intakt. Preview-Ansicht geprueft.
- Button-Verlauf startet bei `#00795c` statt `#00c896` (weisse Schrift lesbar, AA) - gleiche Anpassung wie auf der Website.
- Nicht angefasst: Magic Link, Invite user, Reauthentication (werden von der App nicht genutzt).
- **Stolperfalle dokumentiert**: Das Supabase-Dashboard haengt bei schnellen Direkt-Navigationen auf Unterseiten im Skeleton-Ladezustand. Zuverlaessig ist Client-Routing (Breadcrumb "Emails" klicken -> Zeile klicken) statt Full-Page-Navigation.

## Session 26. Juli 2026 - Umfassender Security-Audit + Fixes (8/11 umgesetzt)
Audit gegen die echte Live-Config (Supabase MCP: RLS-Policies, Spalten-Rechte, Storage, Funktionen, Edge Functions) + Frontend-Code-Review.

### KRITISCH/HOCH behoben und verifiziert
- **#1 (KRITISCH) Privilege Escalation**: `profiles`-UPDATE-Policy hatte kein WITH CHECK + Spalten-Rechte auf ALLE Spalten -> jeder eingeloggte Nutzer konnte sich per `update profiles set ist_admin=true` selbst zum Admin machen (= Zugriff auf alle Schueler-PII + Ausweis-Dokumente), sich selbst verifizieren oder die Firmen-Moderation umgehen. **Fix**: BEFORE-UPDATE-Trigger `schuetze_profil_felder()` friert `ist_admin/verifiziert/firma_status/role` fuer Nicht-Admins ein (Ausnahme: `auth.uid() is null` = service_role/SQL-Editor, damit der Eigentuemer weiter Admins ernennen kann). Live getestet: Angreifer blockiert, Admin-Verifizierung funktioniert weiter.
- **#2 (HOCH) Mail-Function als offener Relay**: `mail-ereignis` vertraute im profiles-Zweig der eingehenden Payload (Empfaenger + Name) -> mit dem oeffentlichen anon-Key konnte jeder beliebige E-Mails inkl. HTML/Phishing von der verifizierten Domain versenden. **Fix**: Function laedt Empfaenger/Namen jetzt autoritativ aus der DB (Service-Role) statt aus der Payload; alle Nutzerwerte HTML-escaped. Version 6 deployed. (Kein Secret noetig.)

### MITTEL behoben
- **#3 Stored XSS** ueber `foto_url`/`bild_url` (unescaped in `style=...url()` bzw. `<img src>`), u.a. Schueler-Foto -> Firma-DOM. **Fix**: neuer Helfer `js/sicher.js` (`sichereMediaUrl`: nur http(s), Ausbruch-Zeichen entfernt), angewendet in dashboard-firma/schueler, lebenslauf, admin.
- **#4 Fehlende WITH CHECK** in UPDATE-Policies (nachrichten/bewertungen/bewerbungen) -> Chat-Nachrichten faelschbar, Bewertung auf fremde Firma verschiebbar. **Fix**: 3 BEFORE-UPDATE-Trigger, die alle Spalten ausser den legitim aenderbaren (`gelesen` / `sterne,kommentar` / `status`) einfrieren.
- **#5 Oeffentliche Buckets** (`avatars`, `lebenslauf-bilder`) ohne MIME-/Groessenlimit. **Fix**: nur Bild-MIME + 3 MB; private Buckets (zeugnisse/verifizierung) auf Bild/PDF + 6 MB.

### NIEDRIG behoben
- **#6 Security-Header**: `vercel.json` mit CSP (Fremd-Hosts whitelisted, `frame-ancestors 'none'`), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS (ohne preload/includeSubDomains -> Mail-Subdomain unberuehrt).
- **#8 SECURITY-DEFINER-Exposure**: `mail_ereignis_webhook` + die 4 neuen Trigger-Funktionen von RPC-Aufruf entzogen (`revoke execute`). Verbleibend by-design/notwendig: `ist_admin`/`firma_freigegeben` (in RLS-Policies genutzt), `job_aufruf_zaehlen` (anon-Zaehler gewollt).
- **#10 User-Enumeration**: Registrierung zeigt keine rohen Supabase-Fehler mehr, sondern eine generische Meldung.

### OFFEN (nur im Dashboard durch Eigentuemer machbar) -> siehe OFFENE-PUNKTE.md
- #7 Leaked-Password-Schutz aktivieren · #9 MFA fuer Admins · #11 Gate vor Launch aus.

### Positiv bestaetigt
RLS auf allen Tabellen aktiv · private Buckets korrekt · keine echten Secrets im Repo (nur oeffentlicher anon-Key) · `handle_new_user` validiert Rolle · keine SQL-Injection (PostgREST parametrisiert). Alle 60 E2E-Tests weiter gruen.

## Session 23. Juli 2026 (Teil 5) - Monitoring (Sentry + Uptime)
- **Sentry-Fehler-Tracking** eingebaut (`js/monitoring.js`, in allen 15 Seiten VOR gate.js geladen). Standardmaessig INAKTIV: `SENTRY_DSN = ''` -> tut nichts, kein Netzwerk. Sobald ein DSN gesetzt ist, laedt es den versions-unabhaengigen Sentry-Loader (`js.sentry-cdn.com/<publicKey>.min.js`, Public Key wird aus dem DSN gezogen). Datensparsam: sendDefaultPii:false, tracesSampleRate:0, kein Replay, ignoreErrors fuer Browser-Rauschen, beforeSend filtert das Gate-Passwort raus. Aktivierung + DSGVO-Schritte in OFFENE-PUNKTE.md.
- **Uptime-Monitor** als GitHub-Actions-Workflow (`.github/workflows/uptime.yml`): cron alle 10 Min + manuell ausloesbar, prueft HTTP 200 UND dass die Startseite "SchuelerMatch" enthaelt (3 Versuche gegen kurze Aussetzer). Bei Ausfall wird der Lauf failed -> GitHub mailt dem Owner. Kein Fremdanbieter, gehoert dem Nutzer selbst (besser fuer DSGVO als ein SaaS-Monitor). Caveat: GitHub pausiert geplante Workflows nach 60 Tagen Repo-Inaktivitaet.
- Warum GitHub-Actions statt UptimeRobot: der Nutzer wollte "bauen" - der GH-Workflow ist sofort einsatzbereit ohne Fremd-Signup. Fuer echte Unabhaengigkeit (Monitor ausserhalb des Stacks) waere ein externer Dienst wie UptimeRobot ein sinnvoller Zusatz.
- Alle 60 E2E-Tests weiter gruen (monitoring.js mit leerem DSN ist im "keine-Konsolen-Fehler"-Test unauffaellig).

- **Impeccable-Audit index.html: 15/20** -> alle Fixes umgesetzt (bd0432f, 1c086dc): --verlauf-tief (#00795c-Start) fuer weisse Button-Texte (5.4:1 AA); 'Echte Jobs, keine Platzhalter' -> 'Ein Blick in die Jobboerse'; '98% Match' -> 'Match gefunden!'; <main>-Landmark; pointer:coarse Touch-Ziele ~44px; Fonts via preconnect+<link> auf allen 15 Seiten statt @import; FAQ aria-expanded. Score jetzt ~18/20. P3 width->transform bewusst vertagt.
- Parallel vom Nutzer/anderer Session: og-Tags + canonical auf index.html.
