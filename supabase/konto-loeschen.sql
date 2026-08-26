-- =====================================================================
-- Konto vollständig löschen (Art. 17 DSGVO, „Recht auf Löschung")
-- =====================================================================
--
-- WARUM ES DIESE DATEI GIBT
-- Die Datenschutzerklärung sagt zu: „Wenn dein Kind unter 16 Jahre alt
-- ist und du der Verarbeitung widersprechen oder die Löschung verlangen
-- möchtest, schreib uns einfach an die oben genannte E-Mail-Adresse. Wir
-- löschen den Account dann zeitnah."
--
-- In der Anwendung selbst gibt es KEINE Konto-Löschung. Der Betreiber
-- muss das von Hand tun. Diese Datei ist die Anleitung dafür.
--
-- DAS WICHTIGSTE VORWEG
-- In der Datenbank hängt fast alles an `profiles` mit ON DELETE CASCADE.
-- EINE Löschzeile räumt Bewerbungen, Nachrichten, Bewertungen, gemerkte
-- Jobs und (bei Firmen) die Jobs samt deren Bewerbungen mit ab.
--
-- Der Storage tut das NICHT. Und dort liegt das Heikle:
--
--   * Das Profilfoto liegt in `avatars` — einer ÖFFENTLICHEN Ablage.
--     Wird nur die Datenbankzeile gelöscht, bleibt das Foto des Kindes
--     unter seiner Adresse für jeden abrufbar. Genau das darf nach einer
--     Löschanfrage nicht passieren.
--   * Die Bilder im Lebenslauf liegen ebenfalls öffentlich, ihre
--     Adressen stecken in der JSON-Spalte `profiles.lebenslauf_bloecke`.
--     Ist das Profil gelöscht, ist der Verweis weg — die Dateien nicht.
--   * Ausweis, Schulbestätigung und Zeugnisse liegen privat, müssen
--     aber trotzdem weg.
--
-- Deshalb: ERST die Dateien, DANN die Datenbank.
--
-- Schritt 1 und 2 lesen nur. Nichts läuft automatisch — das ist Absicht.
--
-- Stand: 26.8.2026


-- ---------------------------------------------------------------------
-- SCHRITT 1: Wen genau löschen wir? (nur lesen)
-- ---------------------------------------------------------------------
-- E-Mail eintragen. Es muss genau EINE Zeile kommen, und Name, Rolle und
-- Alter müssen zur Anfrage passen.

select id, role, name, ort, alter_jahre, email, erstellt_am, verifiziert
from public.profiles
where lower(email) = lower('HIER_EMAIL_EINTRAGEN@example.com');


-- ---------------------------------------------------------------------
-- SCHRITT 2: Was hängt daran? (nur lesen)
-- ---------------------------------------------------------------------
-- Die Nutzer-Id aus Schritt 1 überall dort eintragen, wo unten
-- HIER_NUTZER_ID steht. (Im SQL-Editor: Strg+H, alles ersetzen.)

with ziel as (select 'HIER_NUTZER_ID'::uuid as uid)
select 'bewerbungen'            as tabelle, count(*) from public.bewerbungen   b, ziel z where b.schueler_id = z.uid
union all select 'nachrichten',            count(*) from public.nachrichten   n, ziel z where n.absender_id = z.uid
union all select 'bewertungen',            count(*) from public.bewertungen   v, ziel z where v.schueler_id = z.uid or v.firma_id = z.uid
union all select 'gemerkte_jobs',          count(*) from public.gemerkte_jobs g, ziel z where g.schueler_id = z.uid
union all select 'jobs (als Firma)',       count(*) from public.jobs          j, ziel z where j.firma_id = z.uid
union all select 'meldungen (gestellt)',   count(*) from public.meldungen     m, ziel z where m.melder_id = z.uid
union all select 'meldungen (gegen ihn)',  count(*) from public.meldungen     m, ziel z where m.gemeldet_user_id = z.uid;


-- Die Dateien im Storage. Der erste Ordner ist immer die Nutzer-Id.
-- DIESE LISTE AUSDRUCKEN ODER KOPIEREN — nach dem Löschen des Profils
-- lässt sie sich nicht mehr erzeugen.
select o.bucket_id, o.name as datei, o.created_at
from storage.objects o
where (storage.foldername(o.name))[1] = 'HIER_NUTZER_ID'
order by o.bucket_id, o.name;


-- Die Bilder im Lebenslauf. Ihre Adressen stehen NUR in der JSON-Spalte,
-- deshalb tauchen sie in der Liste oben zwar auf, sind dort aber nicht
-- als Lebenslauf-Bild erkennbar. Hier zur Kontrolle:
select b->>'bild_url' as bild_im_lebenslauf
from public.profiles p,
     lateral jsonb_array_elements(coalesce(p.lebenslauf_bloecke, '[]'::jsonb)) b
where p.id = 'HIER_NUTZER_ID'::uuid
  and b->>'bild_url' is not null;


-- ---------------------------------------------------------------------
-- SCHRITT 3a: Dateien löschen (im Dashboard, nicht per SQL)
-- ---------------------------------------------------------------------
-- Supabase-Dashboard > Storage. In ALLEN VIER Ablagen den Ordner mit der
-- Nutzer-Id löschen:
--
--     avatars · lebenslauf-bilder · verifizierung · zeugnisse
--
-- Nicht per SQL: `delete from storage.objects` entfernt nur den Eintrag,
-- nicht zuverlässig die Datei dahinter.


-- ---------------------------------------------------------------------
-- SCHRITT 3b: Datenbank löschen
-- ---------------------------------------------------------------------
-- Läuft in EINER Transaktion. Am Ende steht `rollback`, damit ein
-- Probelauf möglich ist — erst wenn die Ausgabe stimmt, auf `commit`
-- ändern und erneut ausführen.

begin;

-- MELDUNGEN ZUERST — und zwar anonymisieren statt löschen.
--
-- Grund: `meldungen.melder_id` zeigt mit ON DELETE CASCADE auf
-- `profiles`. Würde man das Profil einfach löschen, VERSCHWÄNDE JEDE
-- MELDUNG, DIE DIESE PERSON GESTELLT HAT. Ein Schüler, der Belästigung
-- meldet und danach sein Konto löscht, nähme den Vorgang mit.
--
-- Die Datenschutzerklärung deckt das Aufbewahren ab: Meldungen bleiben,
-- „so lange, wie es zur Sicherheit der Plattform nötig ist". Der
-- Personenbezug fällt weg, der Sicherheitsvorgang bleibt.
--
-- Damit das geht, muss `melder_id` nullbar sein und der Fremdschlüssel
-- auf SET NULL stehen. Beides ändert supabase/meldungen-fk.sql.
-- SOLANGE DAS NICHT EINGESPIELT IST, schlägt der nächste Befehl fehl —
-- das ist gewollt, sonst löschte man unbemerkt Meldungen mit.
update public.meldungen
set melder_id = null
where melder_id = 'HIER_NUTZER_ID'::uuid;

-- Bei der gemeldeten Person steht der Fremdschlüssel bereits auf
-- SET NULL. Das Zitat aus dem Chat ist trotzdem Personenbezug.
update public.meldungen
set gemeldet_user_id = null,
    zitat = case when zitat is null then null else '[Konto gelöscht]' end
where gemeldet_user_id = 'HIER_NUTZER_ID'::uuid;

-- Und jetzt das Profil. Der Rest kaskadiert:
--   bewerbungen · nachrichten · bewertungen · gemerkte_jobs · jobs
--   (und über jobs: die Bewerbungen anderer darauf samt Chatverlauf)
delete from public.profiles
where id = 'HIER_NUTZER_ID'::uuid;

-- Probelauf: `rollback` stehen lassen, danach Schritt 2 erneut
-- ausführen. Erst wenn alles stimmt, hier `commit` eintragen.
rollback;


-- ---------------------------------------------------------------------
-- SCHRITT 3c: Anmeldekonto löschen
-- ---------------------------------------------------------------------
-- Geht nicht per SQL. Supabase-Dashboard > Authentication > Users, den
-- Eintrag löschen.
--
-- WICHTIG: Solange der bleibt, kann sich die Person weiter anmelden —
-- und `handle_new_user` legt beim nächsten Login ein NEUES, leeres
-- Profil an. Die Löschung wäre damit halb zurückgenommen.


-- ---------------------------------------------------------------------
-- SCHRITT 4: Nachkontrolle (nur lesen)
-- ---------------------------------------------------------------------
-- Findet Dateien im Storage, zu denen es kein Profil mehr gibt — egal
-- bei welchem Konto. Sollte leer sein. Ist sie es nicht, wurde bei einer
-- früheren Löschung der Storage vergessen.

select o.bucket_id, o.name as datei_ohne_profil, o.created_at
from storage.objects o
where (storage.foldername(o.name))[1] ~ '^[0-9a-f-]{36}$'
  and not exists (
    select 1 from public.profiles p
    where p.id::text = (storage.foldername(o.name))[1]
  )
order by o.bucket_id, o.created_at;


-- ---------------------------------------------------------------------
-- NOCH OFFEN
-- ---------------------------------------------------------------------
-- * `job_alarme` fehlt hier, weil die Tabelle noch nicht angelegt ist
--   (siehe supabase/job-alarm.sql). Sobald sie steht, gehört ein
--   `delete from public.job_alarme where nutzer_id = …` dazu — sonst
--   bekäme ein gelöschtes Konto weiter E-Mails.
-- * Eine Konto-Löschung in der Anwendung selbst wäre der saubere Weg.
--   Solange es sie nicht gibt, ist diese Datei die Anleitung.
