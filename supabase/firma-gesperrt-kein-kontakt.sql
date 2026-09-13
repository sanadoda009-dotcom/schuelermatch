-- Eine gesperrte Firma erreicht keine Schueler mehr
-- (13.9.2026)
--
-- WARUM
-- Im Betreiber-Bereich meldet "Sperren": "gesperrt – Jobs nicht mehr
-- sichtbar". Genau das - und nur das - bewirkt es. Am 13.9.2026 aus der
-- laufenden Datenbank ausgelesen: Keine einzige Regel fragt nach
-- `firma_status = 'gesperrt'`. Die oeffentliche Lese-Regel fuer `jobs`
-- verlangt eine freigegebene Firma; alles andere nicht.
--
-- Eine gesperrte Firma kann deshalb weiterhin:
--   * Schuelern schreiben, deren Bewerbung sie angenommen hat
--     (nachrichten, INSERT: nur "Absender ist beteiligt")
--   * alle Bewerbungen auf ihre Anzeigen lesen - samt Anschreiben
--     (bewerbungen, SELECT "Firma sieht Bewerbungen auf eigene Jobs")
--   * die Profile ihrer Bewerber lesen - mit E-Mail-Adresse, Alter,
--     Schule, Lebenslauf (profiles, SELECT "Firma sieht Profil von Bewerbern")
--   * deren Zeugnisse herunterladen (storage, "Firma sieht Zeugnis von Bewerbern")
--   * Bewerbungen annehmen oder ablehnen (bewerbungen, UPDATE)
--
-- Gesperrt wird eine Firma, wenn etwas nicht stimmt - etwa nach einer
-- Meldung, weil sie im Chat nach der Handynummer eines Minderjaehrigen
-- fragt. Genau dann darf sie ihn nicht mehr erreichen.
--
-- WIE
-- Zusaetzliche, EINSCHRAENKENDE Regeln (`as restrictive`). PostgreSQL
-- verknuepft sie mit UND mit allen erlaubenden Regeln - egal, wann und in
-- welcher Fassung diese eingespielt sind. Deshalb fasst diese Datei keine
-- bestehende Regel an, und es gibt keine Reihenfolge zu den anderen
-- Dateien (chat-erst-nach-zusage.sql und zeugnis-nur-eigene-anzeige.sql
-- ersetzen Regeln auf denselben Tabellen - das bleibt davon unberuehrt).
--
-- Betroffen ist NUR, wer als gesperrte Firma angemeldet ist. Schueler,
-- freigegebene und neue Firmen, der Betreiber und die Mail-Funktionen
-- (Service-Rolle) merken nichts.
--
-- Die eigene Profilzeile bleibt lesbar: Sonst koennte die gesperrte Firma
-- sich nicht einmal anmelden und saehe den Hinweis "Dein Konto ist
-- gesperrt" nicht.
--
-- STAND VORHER (13.9.2026, aus pg_policies)
--   nachrichten:  3 Regeln, keine nennt firma_status
--   bewerbungen:  4 Regeln, keine nennt firma_status
--   profiles:     5 Regeln, keine nennt firma_status
--   storage.objects "Firma sieht Zeugnis von Bewerbern": ohne firma_status

-- Hilfsfunktion wie `firma_freigegeben` und `ist_admin`: SECURITY DEFINER,
-- damit die Regel auf `profiles` sich nicht selbst im Kreis liest.
create or replace function public.ist_gesperrte_firma(u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'firma' and firma_status = 'gesperrt' from public.profiles where id = u),
    false)
$$;

revoke all on function public.ist_gesperrte_firma(uuid) from public;
grant execute on function public.ist_gesperrte_firma(uuid) to anon, authenticated;

-- Nachrichten: weder lesen noch schreiben.
drop policy if exists "Gesperrte Firma: keine Nachrichten" on public.nachrichten;
create policy "Gesperrte Firma: keine Nachrichten" on public.nachrichten
  as restrictive
  for all
  to authenticated
  using (not public.ist_gesperrte_firma(auth.uid()))
  with check (not public.ist_gesperrte_firma(auth.uid()));

-- Bewerbungen: weder lesen noch entscheiden.
drop policy if exists "Gesperrte Firma: keine Bewerbungen" on public.bewerbungen;
create policy "Gesperrte Firma: keine Bewerbungen" on public.bewerbungen
  as restrictive
  for all
  to authenticated
  using (not public.ist_gesperrte_firma(auth.uid()))
  with check (not public.ist_gesperrte_firma(auth.uid()));

-- Profile: nur noch das eigene.
drop policy if exists "Gesperrte Firma: nur eigenes Profil" on public.profiles;
create policy "Gesperrte Firma: nur eigenes Profil" on public.profiles
  as restrictive
  for select
  to authenticated
  using (id = auth.uid() or not public.ist_gesperrte_firma(auth.uid()));

-- Zeugnisse und Lebenslauf-PDFs der Bewerber.
drop policy if exists "Gesperrte Firma: keine Zeugnisse" on storage.objects;
create policy "Gesperrte Firma: keine Zeugnisse" on storage.objects
  as restrictive
  for select
  to authenticated
  using (bucket_id <> 'zeugnisse' or not public.ist_gesperrte_firma(auth.uid()));


-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
-- 1) Die vier Regeln gibt es, und sie sind einschraenkend
--    (permissive = 'RESTRICTIVE'):
--
--   select schemaname, tablename, policyname, permissive, cmd
--   from pg_policies
--   where policyname like 'Gesperrte Firma:%'
--   order by tablename;
--
--   Erwartet: 4 Zeilen, alle mit permissive = RESTRICTIVE.
--
-- 2) Die Funktion erkennt eine gesperrte Firma - und NUR sie:
--
--   select role, firma_status, public.ist_gesperrte_firma(id) as gesperrt, count(*)
--   from public.profiles group by 1, 2, 3 order by 1, 2;
--
--   Erwartet: gesperrt = true genau bei role = firma, firma_status = gesperrt.
--
-- 3) Nichts anderes ist betroffen: Schueler und freigegebene Firmen melden
--    sich an wie vorher und sehen ihre Bewerbungen und Chats.


-- ------------------------------------------------------------
-- Rueckgaengig machen
-- ------------------------------------------------------------
--
--   drop policy if exists "Gesperrte Firma: keine Nachrichten" on public.nachrichten;
--   drop policy if exists "Gesperrte Firma: keine Bewerbungen" on public.bewerbungen;
--   drop policy if exists "Gesperrte Firma: nur eigenes Profil" on public.profiles;
--   drop policy if exists "Gesperrte Firma: keine Zeugnisse" on storage.objects;
--   drop function if exists public.ist_gesperrte_firma(uuid);
