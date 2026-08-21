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
- Cache: Stammbesucher bekommen neue CSS/JS erst nach Revalidierung/Hard-Refresh (statische Dateinamen).
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
