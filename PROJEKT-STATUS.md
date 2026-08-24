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
