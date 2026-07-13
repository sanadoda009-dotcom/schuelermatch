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
