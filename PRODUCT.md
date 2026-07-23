# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primär: Schüler (13–20 Jahre, Klasse 5–13)** in Deutschland, die ihren ersten oder nächsten Minijob suchen. Situation: nach der Schule am Handy, wenig bis keine Bewerbungserfahrung, kein fertiger Lebenslauf. Ihr Job-to-be-done: „Finde mir einen Nebenjob in meiner Nähe, der zu meinem Alter passt — und hilf mir, mich zum ersten Mal im Leben zu bewerben."

**Sekundär: Arbeitgeber** — bewusst zwei sehr unterschiedliche Gruppen: (a) kleine lokale Firmen (Eisdiele, Einzelhandel) und (b) **Privatpersonen/Familien** (Babysitten, Nachhilfe, Gassi gehen, Gartenhilfe). Viele Anbieter haben kein Gewerbe und keine HR-Erfahrung.

**Mitleser: Eltern.** Bei unter 16-Jährigen ist ihre Einwilligung Pflicht (Art. 8 DSGVO); ihr Vertrauen entscheidet mit, ob ein Schüler die Plattform nutzen darf.

## Product Purpose

SchülerMatch verbindet Schüler kostenlos mit lokalen Minijobs. Firmen und Privatleute posten gratis; Schüler bauen im integrierten Studio ihren ersten Lebenslauf und bewerben sich mit einem Klick (PDF wird automatisch erzeugt und angehängt). Erfolg heißt (bestätigt): **aktive Nutzer und ein stetig gefüllter Job-Katalog** — die Plattform lebt und wird regelmäßig genutzt.

## Positioning

**Ausschließlich für Schüler gebaut** (bestätigte Kern-Positionierung): Jugendschutz-Mindestalter an jedem Job (JArbSchG), Umkreissuche für Fahrrad-Distanzen, ein Lebenslauf-Studio für Menschen, die noch nie einen Lebenslauf hatten, einfache Du-Sprache. Erwachsenen-Jobbörsen (Indeed, Kleinanzeigen) können diesen Fokus nicht glaubwürdig kopieren, ohne ihr Kerngeschäft zu verleugnen. Die Sicherheitsarchitektur stützt diese Position: Schüler per Ausweis verifiziert, Anbieter vor Freigabe geprüft, Kontakt bleibt in der Plattform.

## Operating Context

- Schüler nutzen die Seite mobil (nachmittags, Handy); Bewerbung → Firma prüft im Dashboard (Bewerber-Ampel) → bei Zusage öffnet sich ein plattforminterner Chat; E-Mail-Benachrichtigungen bei Zusage/Absage/neuen Bewerbungen (einstellbar).
- Verifizierung: Schüler laden Schülerausweis/Schulbestätigung hoch; der Betreiber prüft im Admin-Bereich und schaltet frei; Dokumente werden nach der Prüfung automatisch gelöscht.
- Neue Anbieter werden vor Sichtbarkeit ihrer Jobs vom Betreiber freigegeben (Pre-Moderation).
- Betrieb: Ein-Personen-Betrieb (Betreiber ist Programmier-Anfänger und prüft Verifizierungen/Freigaben selbst).

## Capabilities and Constraints

- Stack (bewusste Entscheidung, beibehalten): reines HTML/CSS/JS ohne Framework/Build-Tool; Supabase (Postgres/Auth/Storage, RLS auf allen Tabellen); Vercel-Hosting; Resend für E-Mails (eigene Domain mail.schuelermatch.de); jsPDF für Lebenslauf-PDFs.
- Kein Tracking, keine Analytics, keine Werbe-Cookies (kein Cookie-Banner nötig) — bewusstes Datenschutz-Versprechen.
- Nur Deutsch; durchgehend „Du".
- Vor-Launch: Zugangs-Gate aktiv (`js/gate.js`); E-Mail-Bestätigung bei Registrierung aktiv.
- **Offen (nicht erfinden):** Start-Region (München-zuerst vs. bundesweit) ist bewusst unentschieden. Mechanismus der Elterneinwilligung (Häkchen vs. Eltern-Mail) wartet auf Rechtsprüfung. Monetarisierung ungeklärt — Kern bleibt kostenlos.

## Brand Commitments

- Name: **SchülerMatch**. Domain: schuelermatch.de.
- Logo: Teal→Indigo-Verlaufs-Monogramm „SM" + Wortmarke (`assets/logo.png`, helle Variante `assets/logo-light.png`, `assets/favicon.png`).
- Markengeschichte (bindend, durchgezogen): **Teal (#00c896) = Schüler, Indigo (#2b2f8f) = Arbeitgeber, der Verlauf = das Match.** Verlauf nur für Hauptaktionen und Signatur-Elemente („Match-Linie" auf Job-Karten).
- Typografie: Space Grotesk (Display), Inter (Text), IBM Plex Mono (Labels/Meta).
- Ton: freundlich, direkt, ermutigend — nie behördlich; Absagen werden tröstend formuliert.

## Evidence on Hand

- **Die vorhandenen Jobs/Konten sind Testdaten des Betreibers** (bewusst so, nicht verändern, nie als echte Nachfrage darstellen).
- Keine echten Testimonials, Nutzerzahlen, Presse oder Referenzen — **nicht erfinden**; Vertrauens-Elemente müssen aus echten Mechanismen kommen (Verifizierung, Freigabe-Prozess, Bewertungssystem).
- Rechtstexte (Impressum, Datenschutz, Jugendarbeitsschutz-Seite) vorhanden, juristisch noch ungeprüft.

## Product Principles

1. **Für einen 14-Jährigen ohne Anleitung verständlich** — jede Funktion, jeder Text.
2. **Sicherheit vor Wachstum** — nichts wird öffentlich, was nicht geprüft ist (Schüler-Verifizierung, Anbieter-Freigabe, Job-Sichtbarkeit per RLS).
3. **Eltern lesen mit** — Transparenz (z. B. „Was sieht der Arbeitgeber?") ist Produktfunktion, nicht Beiwerk.
4. **Erste Male ernst nehmen** — erster Lebenslauf, erste Bewerbung, erste Absage: immer Starthilfe anbieten, immer ermutigen.
5. **Kostenlos für beide Seiten** — Monetarisierung darf den Kernzweck nie blockieren.

## Accessibility & Inclusion

Einfache Sprache für junge Nutzer ist Produktanforderung. Technisch etabliert: sichtbare Fokus-Ringe (`:focus-visible`), `prefers-reduced-motion` wird respektiert, Dark Mode vorhanden. Kein darüber hinausgehender Standard festgelegt.
