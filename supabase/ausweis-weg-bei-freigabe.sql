-- Keine Freigabe, solange der Schuelerausweis noch in der Ablage liegt
-- (5.9.2026, umgebaut und eingespielt am 20.10.2026)
--
-- WARUM
-- Die Freischalt-Mail sagt einem Kind woertlich:
--
--   "Uebrigens: Dein hochgeladenes Dokument haben wir nach der Pruefung
--    direkt wieder geloescht."
--
-- Im Betreiber-Bereich stimmt das: js/admin.js loescht die Dateien ZUERST
-- ueber die Storage-Schnittstelle und bricht ab, wenn das misslingt - erst
-- danach wird `verifiziert` gesetzt.
--
-- ABER: Die Mail verschickt kein Knopf, sondern ein TRIGGER auf `profiles`
-- (profil_verifiziert_mail, AFTER UPDATE OF verifiziert). Der feuert bei
-- JEDEM Wechsel false -> true - auch wenn jemand `verifiziert` direkt im
-- SQL-Editor oder im Supabase-Dashboard setzt. Dann geht die Zusage raus,
-- und das Dokument bleibt liegen. Am 5.9.2026 genau so vorgefunden: zwei
-- Dateien vom Juli bei bereits verifizierten Schuelern.
--
-- ERSTE FASSUNG (5.9.) - NICHT MEHR MOEGLICH
-- Sie loeschte die Zeilen in storage.objects selbst. Inzwischen hat
-- Supabase dort den Trigger `protect_objects_delete` (FOR EACH STATEMENT,
-- "Direct deletion from storage tables is not allowed"). Er feuert auch,
-- wenn nichts zu loeschen ist - die erste Fassung haette JEDE Freigabe mit
-- einem Fehler abgebrochen. Am 20.10.2026 vor dem Einspielen bemerkt.
--
-- WAS DIESE FASSUNG TUT
-- Sie loescht nichts, sie PRUEFT: Geht `verifiziert` auf true und liegt in
-- der Ablage `verifizierung` noch ein Dokument dieses Schuelers, wird die
-- Freigabe abgelehnt. Damit kann die Mail nur rausgehen, wenn ihr Satz
-- stimmt. Der normale Weg (Betreiber-Bereich) laeuft unveraendert, weil
-- der Knopf vorher loescht. Die beiden Pfadspalten werden bei der Freigabe
-- geleert.
--
-- Bereits verifizierte Konten sind nicht betroffen - der Trigger greift
-- nur beim Wechsel false -> true.

create or replace function public.ausweis_weg_bei_freigabe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rest int;
begin
  -- Nur beim Wechsel auf "verifiziert", nicht bei jedem Speichern.
  if new.verifiziert is true and coalesce(old.verifiziert, false) is false then
    -- Loeschen darf hier niemand mehr (Supabase: protect_objects_delete).
    -- Also wird geprueft: Die Freischalt-Mail verspricht "Dokument
    -- geloescht" - liegt noch eins da, gibt es keine Freigabe.
    select count(*) into rest
      from storage.objects
     where bucket_id = 'verifizierung'
       and split_part(name, '/', 1) = new.id::text;
    if rest > 0 then
      raise exception 'Freigabe abgelehnt: In der Ablage "verifizierung" liegen noch % Dokument(e) dieses Schuelers. Bitte ueber den Betreiber-Bereich freischalten - der Knopf loescht sie zuerst.', rest
        using errcode = '23514';
    end if;
    new.schuelerausweis_url   := null;
    new.schulbestaetigung_url := null;
  end if;
  return new;
end $$;

-- Reine Trigger-Funktion: von aussen nicht aufrufbar
revoke all on function public.ausweis_weg_bei_freigabe() from public, anon, authenticated;

drop trigger if exists trg_ausweis_weg_bei_freigabe on public.profiles;
create trigger trg_ausweis_weg_bei_freigabe
  before update of verifiziert on public.profiles
  for each row execute function public.ausweis_weg_bei_freigabe();

-- ------------------------------------------------------------
-- DIE ZWEI ALTEN DATEIEN
-- ------------------------------------------------------------
-- Der Trigger greift erst bei kuenftigen Freigaben. Die beiden Dateien
-- vom Juli liegen weiter da. NICHT angefasst: Es sind Ausweisdokumente
-- von Minderjaehrigen, das Loeschen ist endgueltig, und die Entscheidung
-- gehoert Sanad. Loeschen geht nur noch ueber die Storage-Schnittstelle
-- (Supabase-Dashboard -> Storage -> verifizierung), nicht per SQL.
--
-- Ansehen, um wen es geht:
--
--   select p.id, p.name, p.verifiziert, o.name as datei, o.created_at
--     from storage.objects o
--     join public.profiles p on p.id::text = split_part(o.name, '/', 1)
--    where o.bucket_id = 'verifizierung';

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
-- 2) Gegenprobe mit einem TESTKONTO (nie mit einem echten): Testschueler
--    laedt ein Dokument hoch, dann im SQL-Editor
--      update profiles set verifiziert = true where id = '<testkonto>';
--    Erwartet: Fehler "Freigabe abgelehnt ...".
--
-- 3) Der normale Weg: im Betreiber-Bereich einen wartenden Schueler
--    freischalten - wie bisher, ohne Fehlermeldung.
--
-- Rueckgaengig, falls noetig:
--   drop trigger if exists trg_ausweis_weg_bei_freigabe on public.profiles;
--   drop function if exists public.ausweis_weg_bei_freigabe();
