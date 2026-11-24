-- Schülerbilder privat (24.11.2026)
--
-- WARUM
-- Profilfotos lagen in `avatars`, Lebenslauf-Bilder in `lebenslauf-bilder`
-- - beides öffentliche Ablagen. Wer die Adresse kannte, sah das Foto eines
-- Minderjährigen ohne Anmeldung, auf Dauer: Eine Firma, die eine Bewerbung
-- bekam, behielt die Adresse auch nach der Absage. Die Startseite verspricht
-- das Gegenteil ("Firmen sehen deinen Lebenslauf erst, nachdem du dich
-- beworben hast").
--
-- JETZT
-- 1) Neue PRIVATE Ablage `profilfotos` für Schüler-Profilfotos.
-- 2) `lebenslauf-bilder` wird privat (war beim Umstellen leer).
-- 3) Lesen dürfen: der Schüler selbst, eine Firma, bei der er sich
--    beworben hat, und der Betreiber (mit zweitem Faktor, siehe ist_admin()).
--    Eine gesperrte Firma sieht nichts - wie bei den Zeugnissen.
-- 4) `avatars` bleibt öffentlich, ist aber nur noch für FIRMENLOGOS:
--    Hochladen dürfen dort nur noch Firmen. Schüler können ihr altes Foto
--    dort weiter löschen.
--
-- Die Seite speichert statt einer Adresse einen Verweis
-- (speicher:profilfotos/<id>/avatar.jpg?v=...) und holt beim Anzeigen eine
-- signierte Adresse, die nach einer Stunde verfällt (js/bilder.js).

-- 1) + 2) Ablagen
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profilfotos', 'profilfotos', false, 3145728,
        array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets set public = false where id = 'lebenslauf-bilder';

-- 3) Regeln für profilfotos: eigener Ordner
drop policy if exists "Profilfoto Upload eigene Datei" on storage.objects;
create policy "Profilfoto Upload eigene Datei" on storage.objects
  for insert with check (bucket_id = 'profilfotos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Profilfoto Update eigene Datei" on storage.objects;
create policy "Profilfoto Update eigene Datei" on storage.objects
  for update using (bucket_id = 'profilfotos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Profilfoto eigenes lesen" on storage.objects;
create policy "Profilfoto eigenes lesen" on storage.objects
  for select using (bucket_id = 'profilfotos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Profilfoto eigenes loeschen" on storage.objects;
create policy "Profilfoto eigenes loeschen" on storage.objects
  for delete using (bucket_id = 'profilfotos' and auth.uid()::text = (storage.foldername(name))[1]);

-- Firma, bei der sich der Schüler beworben hat (egal welcher Stand -
-- sie muss die Bewerbung ja ansehen können, um zu entscheiden).
drop policy if exists "Firma sieht Bilder von Bewerbern" on storage.objects;
create policy "Firma sieht Bilder von Bewerbern" on storage.objects
  for select to authenticated using (
    bucket_id in ('profilfotos', 'lebenslauf-bilder')
    and exists (
      select 1 from public.bewerbungen b
      join public.jobs j on j.id = b.job_id
      where b.schueler_id::text = (storage.foldername(name))[1]
        and j.firma_id = auth.uid()
    )
  );

drop policy if exists "Admin sieht Schuelerbilder" on storage.objects;
create policy "Admin sieht Schuelerbilder" on storage.objects
  for select to authenticated using (bucket_id in ('profilfotos', 'lebenslauf-bilder') and public.ist_admin());

-- Gesperrte Firma: keine Schülerbilder (einschränkend, wie bei Zeugnissen)
drop policy if exists "Gesperrte Firma: keine Schuelerbilder" on storage.objects;
create policy "Gesperrte Firma: keine Schuelerbilder" on storage.objects
  as restrictive for select to authenticated using (
    bucket_id not in ('profilfotos', 'lebenslauf-bilder') or not public.ist_gesperrte_firma(auth.uid())
  );

-- 4) avatars nur noch für Firmenlogos
drop policy if exists "Avatar Upload eigene Datei" on storage.objects;
create policy "Avatar Upload eigene Datei" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'firma')
  );

drop policy if exists "Avatar Update eigene Datei" on storage.objects;
create policy "Avatar Update eigene Datei" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'firma')
  );

-- NACHHER PRUEFEN
--   select id, public from storage.buckets where id in ('profilfotos','lebenslauf-bilder','avatars');
--     -- profilfotos false, lebenslauf-bilder false, avatars true
--   select policyname, permissive from pg_policies
--    where schemaname = 'storage' and (policyname like 'Profilfoto%' or policyname like '%Schuelerbilder%'
--          or policyname = 'Firma sieht Bilder von Bewerbern');   -- 7 Zeilen
--
-- Rueckgaengig, falls noetig:
--   update storage.buckets set public = true where id = 'lebenslauf-bilder';
--   drop policy "Firma sieht Bilder von Bewerbern" on storage.objects;
--   drop policy "Admin sieht Schuelerbilder" on storage.objects;
--   drop policy "Gesperrte Firma: keine Schuelerbilder" on storage.objects;
--   (Avatar-Regeln: die Fassung aus rls-stand.sql wieder einspielen.)
--   Die Ablage profilfotos erst leeren, dann: delete from storage.buckets where id = 'profilfotos';
