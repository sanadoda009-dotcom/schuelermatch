# Was schützt gerade was

**Stand: 5.9.2026, aus der laufenden Datenbank ausgelesen — nicht aus der
Historie abgeschrieben.**

## Warum es diese Datei gibt

`PROJEKT-STATUS.md` hat 3021 Zeilen und ist chronologisch: Sie erzählt,
**was wann passiert ist**. Für die Frage „was gilt gerade?" ist sie
unbrauchbar — man müsste sie ganz lesen und im Kopf verrechnen, welche
spätere Zeile eine frühere aufhebt.

Am 2.9.2026 habe ich deshalb eine Lücke gemeldet, die es nicht gab: Eine
Firma könne den Text einer fremden Bewerbung ändern. Der Schutz dagegen
stand seit dem 27.8. in `PROJEKT-STATUS.md` unter „Security-Fix #4" — ich
hatte die RLS-Regel gelesen, aber weder die Trigger noch die eigene
Dokumentation. Diese Datei ist die Antwort darauf: **eine Seite, die den
Ist-Zustand nennt**, nicht seine Geschichte.

Sie ersetzt `PROJEKT-STATUS.md` nicht. Das *Warum* einer Entscheidung
steht weiter dort und in den Kommentaren der SQL-Dateien.

## Die vier Schichten

Wer prüfen will, ob etwas erlaubt ist, muss **alle vier** ansehen. Genau
das war mein Fehler: Schicht 1 gelesen, Schicht 2 übersehen.

| # | Schicht | Wo nachsehen |
|---|---|---|
| 1 | **RLS-Regeln** — welche ZEILEN jemand sehen/ändern darf | `select * from pg_policies where schemaname='public'` |
| 2 | **Trigger** — welche SPALTEN dabei eingefroren sind | `pg_trigger` + `pg_get_functiondef` |
| 3 | **Constraints** — welche WERTE überhaupt zulässig sind | `pg_constraint`, contype `u` und `c` |
| 4 | **Fremdschlüssel** — was beim Löschen mit verschwindet | `information_schema.referential_constraints` |

Dazu getrennt: **Storage** (`storage.buckets` und die Regeln auf
`storage.objects`) — dort gilt Schicht 1 sinngemäß auf Pfad-Segmenten.

## Schicht 2: Die Schutz-Trigger

Der am leichtesten zu übersehende Teil. Alle heißen
`schuetze_<tabelle>_felder()` und **setzen still auf den alten Wert
zurück**, statt einen Fehler zu werfen. Sie greifen nur für angemeldete
Nutzer (`auth.uid() is not null`); die Service-Rolle geht vorbei — das
brauchen die Edge Functions.

| Tabelle | eingefroren | also änderbar bleibt |
|---|---|---|
| `bewerbungen` | `id`, `job_id`, `schueler_id`, `motivationsschreiben`, `zeugnis_url`, `lebenslauf_url`, `erstellt_am` | **nur `status`** |
| `nachrichten` | `id`, `bewerbung_id`, `absender_id`, `text`, `erstellt_am` | **nur `gelesen`** |
| `profiles` | `ist_admin`, `verifiziert`, `firma_status`, `role` (Admins ausgenommen) | Name, Ort, Alter, Schule, Foto, … |
| `bewertungen` | über `schuetze_bewertung_felder()` | Sterne, Kommentar |
| `jobs` | über `schuetze_job_felder()` | die Anzeigenfelder |
| `job_alarme` | über `schuetze_job_alarm_felder()` | die Suchkriterien |
| `meldungen` | `schuetze_meldung_felder()` + `meldung_zitat_setzen()` **bei INSERT** | — |

**Deshalb ist die weite UPDATE-Regel auf `bewerbungen` kein Loch:** Die
Firma darf die Zeile anfassen, aber der Trigger lässt nur `status` durch.

**Bekannte Lücke in dieser Schicht:** `profiles.email` ist **nicht**
eingefroren — und genau diese Spalte lädt `mail-ereignis` als
Empfängeradresse. `supabase/profil-email-festnageln.sql` schließt das,
ist aber noch nicht eingespielt.

## Schicht 1: Wer darf welche Zeilen?

Kurzfassung dessen, was `pg_policies` sagt:

- **`jobs`** öffentlich lesbar nur `aktiv = true AND firma_freigegeben(firma_id)`.
  Schreiben/Löschen nur die eigene Firma. Admin liest alles.
- **`profiles`** nur das eigene Profil — plus „Firma sieht Profil von
  Bewerbern" (eingeschränkt auf die eigenen Anzeigen) und Admin.
  Öffentliche Firmendaten sollen über die Sicht `firmen_oeffentlich`
  laufen (`supabase/firma-oeffentlich.sql`, noch nicht eingespielt) —
  **eine Sicht und keine RLS-Regel, weil RLS auf ZEILEN wirkt und in
  derselben Zeile `email` steht.**
- **`bewerbungen`** der eigene Schüler; die Firma nur für ihre Anzeigen.
  Einfügen nur verifizierte Schüler (`ist_verifiziert(auth.uid())`).
- **`nachrichten`** beide Seiten der Bewerbung. **Ohne Prüfung des
  Stands** — die Zusage gilt bisher nur im Browser
  (`supabase/chat-erst-nach-zusage.sql`, noch nicht eingespielt).
- **`bewertungen`** öffentlich lesbar; schreiben nur, wer bei dieser Firma
  `status = 'angenommen'` hat. Eine je Firma und Schüler.
- **`meldungen`** nur die eigenen — und Admin.
- **`job_alarme`, `gemerkte_jobs`** ausschließlich die eigenen Zeilen.

## Storage

| Bucket | öffentlich | Grenzen | wer liest |
|---|---|---|---|
| `avatars` | **ja** | 3 MB, nur Bild | jeder mit der Adresse |
| `lebenslauf-bilder` | **ja** | 3 MB, nur Bild | jeder mit der Adresse |
| `verifizierung` | nein | 6 MB, Bild/PDF | der Schüler selbst, Admin |
| `zeugnisse` | nein | 6 MB, Bild/PDF | der Schüler selbst; die Firma seiner Bewerbung |

**Zwei offene Punkte hier**, beide in `supabase/zeugnis-nur-eigene-anzeige.sql`:

1. Die Firmen-Leseregel prüft nur das **erste** Pfad-Segment (die
   Schüler-Id). Der Pfad ist aber `<schueler_id>/<job_id>/…` — eine
   Bewerbung bei Firma A genügt, danach ist der ganze Ordner für A offen,
   **einschließlich Zeugnis und Lebenslauf für Firma B.**
2. Für `zeugnisse` gibt es **gar keine Löschregel**. Ein Schüler wird ein
   falsch hochgeladenes Zeugnis nur mit dem ganzen Konto los.

**Merksatz:** Eine Storage-Regel prüft Pfad-SEGMENTE. Ist der Pfad tiefer
als die Regel, ist alles darunter offen.

## Schicht 4: Was beim Löschen mitgeht

`ON DELETE CASCADE` ist gefährlich, wo die **Gegenseite** löschen darf.

| Kaskade | Folge | Stand |
|---|---|---|
| `bewerbungen.job_id → jobs` | Firma löscht Anzeige → alle Bewerbungen und (über `nachrichten.bewerbung_id`) alle Chats weg | offen, `bewerbung-bleibt.sql` |
| `meldungen.job_id → jobs` | Gemeldete Firma löscht die Anzeige → Meldung weg | offen, `meldungen-bleiben.sql` |
| `meldungen.nachricht_id → nachrichten` | dasselbe über den Chat | offen, dieselbe Datei |
| `meldungen.melder_id → profiles` | **behoben am 27.8.** → SET NULL | erledigt |
| `bewerbungen.schueler_id → profiles` | eigenes Konto weg → eigene Bewerbung weg | **so gewollt** |

## Was Edge Functions dürfen

`mail-ereignis`, `mail-digest`, `mail-job-alarm` und `konto-loeschen`
laufen mit der **Service-Rolle**: Sie gehen an RLS *und* an den
Schutz-Triggern vorbei. Deshalb gilt dort:

- **Der Payload nie trauen.** `mail-ereignis` lädt Empfänger und Namen
  seit dem Security-Fix #2 autoritativ aus der Datenbank; die Payload
  liefert nur die betroffene Id.
- **Aber die Quelle prüfen, auf die man ausweicht.** Genau daran hakt es
  bei `profiles.email` (siehe oben). Wenn ein Fix von „Eingabe" auf „aus
  der Datenbank laden" ausweicht, gehört die Frage dazu: **wer darf diese
  Spalte schreiben?**

## Die Schicht, die keine Datenbankschicht ist: der Browser

Die vier Schichten oben regeln, **wer welchen Wert lesen und schreiben
darf**. Sie sagen nichts darüber, was passiert, wenn dieser Wert dann
angezeigt wird — und genau dort saß der Fund vom 11.9.2026.

`js/toast.js` baute seine Meldung mit `innerHTML` und dem übergebenen
Text mittendrin. In `js/dashboard-schueler.js` geht in zwei Meldungen der
**Titel einer Anzeige** ein, und den Titel schreibt die Firma. Gemessen
mit dem Titel `Aushilfe <img src=x onerror="window.__xss=1">`: Der Code
lief im angemeldeten Schülerkonto. Der Weg dahin ist ein Klick auf einen
geteilten Link.

RLS hat dabei alles richtig gemacht — die Firma *darf* ihren
Anzeigentitel schreiben, und der Schüler *darf* ihn lesen. Die Lücke lag
danach.

**Die Regel im Projekt lautet deshalb:** Fremder Text geht nie roh in
`innerHTML`. Entweder durch `escapeHtml()` (so machen es
`js/job-karte.js`, `js/chat.js`, `js/firma.js`, `js/admin.js`) oder gar
nicht erst als Zeichenkette, sondern als `textContent` an einem Element —
so jetzt der Toast.

Am 11.9. daraufhin durchgesehen: 28 Stellen, an denen ein Datenbankfeld
in eine Vorlage mit `innerHTML` geht. **Der Toast war der einzige Fund**;
alle übrigen gehen durch `escapeHtml` oder tragen eigene Konstanten.
Adressen für Bilder laufen zusätzlich über `sichereMediaUrl()` in
`js/sicher.js`, das das Protokoll prüft und Ausbruchzeichen kodiert.

Zu beachten: Die Inhaltsregeln in `vercel.json` fangen das **nicht** ab —
`script-src` erlaubt `'unsafe-inline'`, und ein `onerror` ist genau das.

`tests/toast-ist-text.spec.js` hält es fest, bewusst über das Verhalten
statt über den Quelltext: Wer `toast.js` umbaut, darf das — es darf nur
kein HTML mehr ausgeführt werden.

## So bringst du diese Datei auf den neuesten Stand

Die fünf Abfragen aus der Tabelle oben ausführen und die Abschnitte
danach richten. `tests/sicherheit-stand.spec.js` hält fest, dass hier
keine Schicht und kein Bucket fehlt — es ersetzt aber nicht das
Nachzählen in der echten Datenbank.
