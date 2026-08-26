-- =====================================================================
-- Bewerben nur nach der Verifizierung
-- =====================================================================
--
-- DER BEFUND (26.8.2026)
-- `fuer-firmen.html` verspricht den Arbeitgebern wörtlich:
--
--   „Nur Schüler. Wer sich bewirbt, hat einen Schülerausweis oder eine
--    Schulbescheinigung hochgeladen, die wir geprüft haben."
--
-- Erzwungen wurde das nur im Browser (`js/dashboard-schueler.js`:
-- `if (!profile.verifiziert)` in `oeffneBewerbungsModal`). Die
-- Zugriffsregel der Datenbank verlangte lediglich:
--
--   for insert with check (auth.uid() = schueler_id)
--
-- Wer die Schnittstelle direkt anspricht, konnte sich also unverifiziert
-- bewerben — und der Arbeitgeber hätte darauf vertraut, dass jemand die
-- Unterlagen gesehen hat.
--
-- Dieselbe Klasse wie beim Mindestalter (supabase/mindestalter-grenze.sql):
-- eine Zusage, die nur im Browser gilt, ist keine Zusage.
--
-- STAND BEIM SCHREIBEN
-- 3 Bewerbungen in der Datenbank, davon 0 von unverifizierten Schülern.
-- Es ist also nichts durchgerutscht, und die Regel trifft keine
-- bestehende Zeile.
--
-- ANWENDUNG
-- Im Supabase-SQL-Editor ausführen. Wiederholtes Ausführen ist
-- unschädlich.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Vorher prüfen (nur lesen)
-- ---------------------------------------------------------------------
-- Muss 0 ergeben. Kommt hier etwas, erst klären, was mit diesen
-- Bewerbungen geschehen soll — die neue Regel gilt zwar nur für NEUE
-- Zeilen, aber die bestehenden hätte trotzdem niemand geprüft.

select count(*) as bewerbungen_von_unverifizierten
from public.bewerbungen b
join public.profiles p on p.id = b.schueler_id
where not coalesce(p.verifiziert, false);


-- ---------------------------------------------------------------------
-- Hilfsfunktion
-- ---------------------------------------------------------------------
-- SECURITY DEFINER wie `firma_freigegeben` und `ist_admin`: Die Regel
-- muss `verifiziert` auch dann lesen können, wenn die Zugriffsregeln
-- auf `profiles` das im jeweiligen Zusammenhang nicht hergäben.

create or replace function public.ist_verifiziert(u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select verifiziert from public.profiles where id = u), false);
$$;

-- Wie bei den anderen Hilfsfunktionen: Das Ausführungsrecht kommt von
-- PUBLIC, nicht von den Rollen. `revoke ... from anon, authenticated`
-- wäre wirkungslos — diese Falle steckte schon einmal in rls-stand.sql.
comment on function public.ist_verifiziert(uuid) is
  'Ist dieses Profil als Schueler verifiziert? Fuer die Bewerbungs-Regel. '
  'Siehe supabase/bewerbung-verifiziert.sql.';


-- ---------------------------------------------------------------------
-- Die Regel
-- ---------------------------------------------------------------------

-- ACHTUNG, hier steckte eine Falle (aufgefallen erst durch die
-- Kontrollabfrage nach dem Einspielen am 27.8.):
-- Die bestehende Regel hiess **"Bewerben"**, nicht "Schueler bewirbt
-- sich". Sie wurde also nicht ersetzt, sondern stand DANEBEN - und
-- PostgreSQL verknuepft mehrere erlaubende Regeln mit ODER. Die
-- grosszuegigere gewinnt, die neue Pruefung war wirkungslos.
--
-- Deshalb wird hier ausdruecklich BEIDES entfernt.
drop policy if exists "Bewerben" on public.bewerbungen;
drop policy if exists "Schueler bewirbt sich" on public.bewerbungen;
create policy "Schueler bewirbt sich" on public.bewerbungen
  for insert with check (
    auth.uid() = schueler_id
    and public.ist_verifiziert(auth.uid())
  );


-- ---------------------------------------------------------------------
-- Prüfen
-- ---------------------------------------------------------------------
-- Erwartet: die Regel enthaelt `ist_verifiziert`.

-- WICHTIG: Es darf GENAU EINE Zeile kommen. Stehen zwei da, gilt die
-- grosszuegigere - mehrere erlaubende Regeln werden mit ODER verknuepft.
select polname as regel,
       pg_get_expr(polwithcheck, polrelid) as with_check
from pg_policy
where polrelid = 'public.bewerbungen'::regclass
  and polcmd = 'a';   -- 'a' = INSERT


-- Gegenprobe: Als unverifizierter Schueler muss ein INSERT scheitern.
-- Nur mit einem echten Konto sinnvoll durchzufuehren, deshalb hier als
-- Anleitung statt als Abfrage:
--
--   1. Ein Testkonto anlegen, NICHT verifizieren.
--   2. Damit einloggen und im Browser versuchen:
--        await supabase.from('bewerbungen')
--          .insert({ job_id: '<eine Job-Id>', schueler_id: '<eigene Id>' })
--   3. Erwartet: "new row violates row-level security policy".
--   4. Danach das Konto verifizieren und denselben Aufruf wiederholen —
--      jetzt muss er durchgehen.
--
-- WICHTIG: Testkonten danach wieder entfernen, siehe
-- supabase/konto-loeschen.sql.


-- ---------------------------------------------------------------------
-- WAS DIESE REGEL NICHT LEISTET
-- ---------------------------------------------------------------------
-- Sie prueft, ob jemand verifiziert IST — nicht, ob die Verifizierung
-- inhaltlich richtig war. Das bleibt die Handarbeit im Betreiber-Bereich.
--
-- Und sie greift beim EINFUEGEN. Wird eine Verifizierung spaeter
-- zurueckgezogen, bleiben bereits gestellte Bewerbungen bestehen. Das ist
-- so gewollt: Eine laufende Bewerbung samt Chatverlauf einfach
-- verschwinden zu lassen, waere fuer beide Seiten schlechter als sie
-- stehen zu lassen. Der Betreiber sieht den Fall im Bereich „Schueler".
