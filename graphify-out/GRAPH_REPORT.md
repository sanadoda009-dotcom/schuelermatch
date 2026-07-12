# Graph Report - C:\Users\sanad\OneDrive\Desktop\schuelermatch  (2026-07-12)

## Corpus Check
- Corpus is ~18,631 words - fits in a single context window. You may not need a graph.

## Summary
- 184 nodes · 388 edges · 18 communities (15 shown, 3 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Website Pages & Features
- Company Dashboard & PDF Logic
- Auth, Forms & Supabase Client
- Student CV Data & Autosave
- Job Board Filtering & Sorting
- Student Profile & Application
- CV Block Editor
- Job Detail & Geo Distance
- Brand Identity & Logo
- Notifications Bell
- Student Messaging / Chat
- CV Progress & Achievements
- Student Verification Documents
- Navigation Bar
- Scroll Reveal Animation
- Design Roadmap (Deferred)

## God Nodes (most connected - your core abstractions)
1. `init()` - 25 edges
2. `ladeEigeneJobs()` - 13 edges
3. `renderCvPreview()` - 13 edges
4. `supabase` - 12 edges
5. `toast()` - 11 edges
6. `renderBlockEditor()` - 10 edges
7. `Landing Page (index.html)` - 10 edges
8. `init()` - 9 edges
9. `renderJobs()` - 8 edges
10. `escapeHtml()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `In-Platform Messaging System` --semantically_similar_to--> `Company Chat Modal`  [INFERRED] [semantically similar]
  PROJEKT-STATUS.md → dashboard-firma.html
- `Parental Consent (Art. 8 DSGVO)` --semantically_similar_to--> `JArbSchG (Youth Labor Protection Law)`  [INFERRED] [semantically similar]
  register.html → jugendarbeitsschutz.html
- `So schuetzen wir dich (Safety Section)` --conceptually_related_to--> `Trust & Safety (Minor Protection)`  [INFERRED]
  index.html → PROJEKT-STATUS.md
- `Job Posting Form` --shares_data_with--> `Public Job Board (jobs.html)`  [INFERRED]
  dashboard-firma.html → jobs.html
- `SchuelerMatch Project` --references--> `Single Job Detail Page (job.html)`  [INFERRED]
  PROJEKT-STATUS.md → job.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Student Onboarding Flow** — index_landing_page, register_register_page, login_login_page, dashboard_schueler_student_dashboard, dashboard_schueler_verification_view [INFERRED 0.85]
- **Legal & Compliance Pages** — impressum_legal_notice, datenschutz_privacy_policy, jugendarbeitsschutz_youth_labor_page [INFERRED 0.85]
- **Application & Messaging Flow** — dashboard_schueler_bewerbung_modal, dashboard_firma_job_post_form, dashboard_firma_chat_modal, dashboard_schueler_messages_view, projekt_status_notification_bell [INFERRED 0.75]

## Communities (18 total, 3 thin omitted)

### Community 0 - "Website Pages & Features"
Cohesion: 0.07
Nodes (42): Company Chat Modal, Company Dashboard (dashboard-firma.html), Job Posting Form, Achievements (Abzeichen) View, Application (Bewerbung) Modal, CV Builder View, Student Messages View, Student Dashboard (dashboard-schueler.html) (+34 more)

### Community 1 - "Company Dashboard & PDF Logic"
Cohesion: 0.14
Nodes (25): ladeChat(), antwortMailAnbieten(), beendeBearbeitung(), bewerberAmpel(), escapeHtml(), init(), ladeEigeneJobs(), loescheJob() (+17 more)

### Community 2 - "Auth, Forms & Supabase Client"
Cohesion: 0.14
Nodes (11): removeMsg(), showError(), showSuccess(), form, ICONS, escapeHtml(), ladeJob(), escapeHtml() (+3 more)

### Community 3 - "Student CV Data & Autosave"
Cohesion: 0.17
Nodes (13): alleJobs, autoSave(), autoSaveKey(), bewerbungsStatus, beworbenIds, bloecke, CEFR_NIVEAUS, CV_VORLAGEN (+5 more)

### Community 4 - "Job Board Filtering & Sorting"
Cohesion: 0.35
Nodes (11): alleJobs, escapeHtml(), istNeu(), ladeJobs(), lieseUrlParameter(), oeffneDetail(), passtZurSuche(), renderJobs() (+3 more)

### Community 5 - "Student Profile & Application"
Cohesion: 0.39
Nodes (9): aktualisiereSidebarUser(), init(), ladeFotoHoch(), ladeJobs(), renderStats(), schliesseModal(), sendeBewerbung(), setzePhotoPreview() (+1 more)

### Community 6 - "CV Block Editor"
Cohesion: 0.39
Nodes (9): cryptoId(), ladeBlockBildHoch(), loescheBlock(), neuerBlock(), renderBlockEditor(), renderCvPreview(), typLabel(), verschiebeBlock() (+1 more)

### Community 7 - "Job Detail & Geo Distance"
Cohesion: 0.33
Nodes (8): oeffneBewerbungsModal(), oeffneDetail(), renderJobs(), schuelerStatusLabel(), toggleMerken(), wendeJobFilterAn(), distanzKm(), geocode()

### Community 8 - "Brand Identity & Logo"
Cohesion: 0.53
Nodes (6): SchuelerMatch Brand Identity, Logo Design Rationale, Teal-to-Blue Gradient Visual Style, SchuelerMatch Logo (Image File), Interlocking S+M Monogram Mark, SchuelerMatch Wordmark

### Community 9 - "Notifications Bell"
Cohesion: 0.60
Nodes (5): escapeHtml(), gesehenKey(), ladeGesehen(), sammle(), speichereGesehen()

### Community 10 - "Student Messaging / Chat"
Cohesion: 0.50
Nodes (5): zaehleUngelesen(), aktualisiereNachrichtenBadge(), escapeHtml(), oeffneChat(), renderKonversationen()

### Community 11 - "CV Progress & Achievements"
Cohesion: 0.40
Nodes (5): aktualisiereFortschritt(), blockHatInhalt(), lebenslaufVollstaendig(), renderAbzeichen(), zeigeView()

### Community 12 - "Student Verification Documents"
Cohesion: 0.67
Nodes (4): ladeVerifizierungsDokument(), loescheDokument(), renderVerifyStatus(), setzeDokStatus()

## Knowledge Gaps
- **22 isolated node(s):** `bloecke`, `alleJobs`, `beworbenIds`, `gemerkteIds`, `bewerbungsStatus` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `supabase` connect `Auth, Forms & Supabase Client` to `Company Dashboard & PDF Logic`, `Student CV Data & Autosave`, `Job Board Filtering & Sorting`, `Notifications Bell`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `ICONS` connect `Auth, Forms & Supabase Client` to `Company Dashboard & PDF Logic`, `Student CV Data & Autosave`, `Job Board Filtering & Sorting`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `init()` (e.g. with `ladeFotoHoch()` and `renderCvPreview()`) actually correct?**
  _`init()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `bloecke`, `alleJobs`, `beworbenIds` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Website Pages & Features` be split into smaller, more focused modules?**
  _Cohesion score 0.07084785133565621 - nodes in this community are weakly interconnected._
- **Should `Company Dashboard & PDF Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.14482758620689656 - nodes in this community are weakly interconnected._
- **Should `Auth, Forms & Supabase Client` be split into smaller, more focused modules?**
  _Cohesion score 0.1383399209486166 - nodes in this community are weakly interconnected._