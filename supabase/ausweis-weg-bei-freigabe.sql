-- Der Schuelerausweis verschwindet mit der Freigabe - auch ohne den
-- Admin-Knopf (5.9.2026)
--
-- WARUM
-- Die Freischalt-Mail sagt einem Kind woertlich:
--
--   "Uebrigens: Dein hochgeladenes Dokument haben wir nach der Pruefung
--    direkt wieder geloescht."
--
-- Im Betreiber-Bereich stimmt das auch. js/admin.js loescht die Dateien
-- ZUERST und bricht ab, wenn das misslingt - erst danach wird
-- `verifiziert` gesetzt. Sauber gebaut.
--
-- ABER: Die Mail verschickt kein Knopf, sondern ein TRIGGER auf
-- `profiles` (profil_verifiziert_mail, AFTER UPDATE OF verifiziert).
-- Der feuert bei JEDEM Wechsel false -> true - auch wenn jemand
-- `verifiziert` direkt im SQL-Editor oder im Supabase-Dashboard setzt.
-- Dann geht die Zusage raus, und das Dokument bleibt liegen.
--
-- Genau das ist passiert. Am 5.9.2026 in der laufenden Datenbank
-- nachgezaehlt:
--
--   select o.bucket_id, count(*) from storage.objects o
--   join public.profiles p on p.id::text = split_part(o.name, '/', 1)
--   where o.bucket_id = 'verifizierung' group by 1;
--
--   -> 2 Dateien, beide bei bereits VERIFIZIERTEN Schuelern, hochgeladen
--      am 1. und 5. Juli 2026. `schuelerausweis_url` steht bei beiden
--      noch im Profil - der Admin-Knopf setzt ihn auf NULL, war hier
--      also nicht im Spiel.
--
-- Das ist dasselbe Muster wie viermal zuvor, nur eine Ebene hoeher: Die
-- Zusage haengt am Browser (Admin-Oberflaeche), die Mail, die sie
-- ausspricht, an der Datenbank.
--
-- WAS DIESE DATEI AENDERT
-- Ein Trigger auf `profiles`: Sobald `verifiziert` auf true geht, werden
-- die Dokumentzeilen aus `storage.objects` entfernt und die beiden
-- Pfadspalten geleert - egal, auf welchem Weg die Freigabe kam.
--
-- EHRLICHE EINSCHRAENKUNG
-- Ueber `storage.objects` verschwindet der Eintrag der Datei. Den
-- normalen Weg ersetzt das nicht: Der Admin-Knopf benutzt die
-- Storage-Schnittstelle und ist deshalb weiterhin der saubere Weg. Der
-- Trigger ist das Netz darunter, damit die Zusage aus der Mail nicht ins
-- Leere geht, wenn jemand an der Oberflaeche vorbei freischaltet.

create or replace function public.ausweis_weg_bei_freigabe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nur beim Wechsel auf "verifiziert", nicht bei jedem Speichern.
  if new.verifiziert is true and coalesce(old.verifiziert, false) is false then
    delete from storage.objects
     where bucket_id = 'verifizierung'
       and split_part(name, '/', 1) = new.id::text;

    new.schuelerausweis_url   := null;
    new.schulbestaetigung_url := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_ausweis_weg_bei_freigabe on public.profiles;
create trigger trg_ausweis_weg_bei_freigabe
  before update of verifiziert on public.profiles
  for each row execute function public.ausweis_weg_bei_freigabe();

-- ------------------------------------------------------------
-- DIE ZWEI ALTEN DATEIEN
-- ------------------------------------------------------------
-- Der Trigger greift erst bei kuenftigen Freigaben. Die beiden Dateien
-- vom Juli liegen weiter da. Ich habe sie NICHT angefasst: Es sind
-- Ausweisdokumente von Minderjaehrigen, das Loeschen ist endgueltig, und
-- die Entscheidung gehoert dir.
--
-- Erst ansehen, um wen es geht:
--
--   select p.id, p.name, p.email, p.verifiziert, o.name as datei,
--          o.created_at
--     from storage.objects o
--     join public.profiles p on p.id::text = split_part(o.name, '/', 1)
--    where o.bucket_id = 'verifizierung';
--
-- Wenn du sie loeschen willst - der saubere Weg ist der Admin-Bereich
-- (Konto zurueckziehen, dann neu freischalten). Direkt geht es so:
--
--   delete from storage.objects
--    where bucket_id = 'verifizierung'
--      and split_part(name, '/', 1) in (
--        select id::text from public.profiles where verifiziert is true);
--
--   update public.profiles
--      set schuelerausweis_url = null, schulbestaetigung_url = null
--    where verifiziert is true;
--
-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
-- 1) Der Trigger steht da:
--
--   select tgname from pg_trigger
--   where tgrelid = 'public.profiles'::regclass and not tgisinternal;
--
--   Erwartet: trg_ausweis_weg_bei_freigabe ist dabei.
--
-- 2) Gegenprobe mit einem TESTKONTO (nie mit einem echten): Ein
--    Testschueler laedt ein Dokument hoch, dann
--      update profiles set verifiziert = true where id = <testkonto>;
--    Danach:
--      select count(*) from storage.objects
--       where bucket_id = 'verifizierung'
--         and split_part(name,'/',1) = '<testkonto>';
--    Erwartet: 0. Und im Profil stehen beide Pfadspalten auf NULL.
--
-- 3) Der normale Weg muss weiter gehen: Im Betreiber-Bereich einen
--    wartenden Schueler freischalten - wie bisher, ohne Fehlermeldung.
--
-- Rueckgaengig, falls noetig:
--   drop trigger if exists trg_ausweis_weg_bei_freigabe on public.profiles;
--   drop function if exists public.ausweis_weg_bei_freigabe();
