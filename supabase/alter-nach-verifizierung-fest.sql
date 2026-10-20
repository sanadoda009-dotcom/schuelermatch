-- Nach der Verifizierung ist das Alter fest (20.10.2026, eingespielt)
--
-- SETZT VORAUS: profil-email-festnageln.sql
-- (ersetzt dieselbe Funktion und uebernimmt deren Zeile fuer `email`)
--
-- WARUM
-- Bei der Verifizierung gleicht der Betreiber den Schuelerausweis mit dem
-- Profil ab - auch das Alter. Danach war `profiles.alter_jahre` aber
-- wieder eine frei aenderbare Zahl: Das Profilformular bietet 13 bis 20
-- an, und der Schutz-Trigger schuetze_profil_felder friert die Spalte
-- nicht ein. Am 20.10.2026 aus der laufenden Datenbank ausgelesen.
--
-- Genau diese Zahl entscheidet seit heute in der Datenbank, worauf sich
-- jemand bewerben darf (ist_alt_genug, bewerben-nur-alt-genug.sql). Ein
-- verifizierter Vierzehnjaehriger konnte sich also auf 18 setzen und sich
-- auf eine "ab 18"-Anzeige bewerben - mit dem Haken "verifiziert", der
-- der Firma sagt, das Alter sei geprueft. Die Altersgrenze einer Anzeige
-- steht wegen des Jugendarbeitsschutzgesetzes da.
--
-- Dritter Fall desselben Musters nach profiles.email (4.9.) und
-- bewerbungen.job_titel (20.10.): Eine Pruefung legt einen Wert fest, und
-- danach darf ihn jeder wieder aendern.
--
-- WAS DIESE DATEI AENDERT
-- 1) `alter_jahre` ist eingefroren, sobald das Konto verifiziert ist. Vor
--    der Verifizierung bleibt es aenderbar (Tippfehler bei der
--    Registrierung). Danach aendert es nur der Betreiber - der Trigger
--    laesst Admins wie bisher durch.
-- 2) Die beiden Dokumentpfade duerfen nur in den EIGENEN Ordner zeigen
--    (`<eigene id>/...`). Bisher konnte ein Schueler dort jeden Pfad
--    eintragen - auch den eines anderen wartenden Schuelers. Der
--    Betreiber haette dann ein fremdes Dokument fuer dieses Konto
--    geprueft.
--
-- EHRLICHE FOLGE
-- Hat ein verifizierter Schueler Geburtstag, bleibt die alte Zahl stehen,
-- bis der Betreiber sie aendert. Das Profilformular sagt das und wie man
-- sich meldet. Die saubere Loesung waere ein Geburtsdatum statt eines
-- Alters - das ist eine groessere Umstellung (Registrierung, Anzeige,
-- Filter) und steht in OFFENE-PUNKTE.md.

create or replace function public.schuetze_profil_felder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or ist_admin() then
    return new;
  end if;
  new.ist_admin    := old.ist_admin;
  new.verifiziert  := old.verifiziert;
  new.firma_status := old.firma_status;
  new.role         := old.role;
  -- 4.9.2026: Die Adresse, an die `mail-ereignis` verschickt.
  new.email        := old.email;
  -- 20.10.2026: Das geprueft Alter bleibt, was geprueft wurde.
  if old.verifiziert is true then
    new.alter_jahre := old.alter_jahre;
  end if;
  -- 20.10.2026: Dokumente nur aus dem eigenen Ordner.
  if new.schuelerausweis_url is not null
     and split_part(new.schuelerausweis_url, '/', 1) <> new.id::text then
    new.schuelerausweis_url := old.schuelerausweis_url;
  end if;
  if new.schulbestaetigung_url is not null
     and split_part(new.schulbestaetigung_url, '/', 1) <> new.id::text then
    new.schulbestaetigung_url := old.schulbestaetigung_url;
  end if;
  return new;
end $$;

-- Der Trigger selbst bleibt, wie er ist (trg_schuetze_profil).

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
-- 1) Bestehende Pfade passen alle zur eigenen Id (sonst wuerde der
--    naechste Speichervorgang sie auf den alten Wert zuruecksetzen):
--
--   select count(*) from public.profiles
--    where (schuelerausweis_url is not null and split_part(schuelerausweis_url,'/',1) <> id::text)
--       or (schulbestaetigung_url is not null and split_part(schulbestaetigung_url,'/',1) <> id::text);
--
--   Erwartet: 0
--
-- 2) Gegenprobe ohne Spuren (Transaktion + rollback), als verifizierter
--    Schueler:  update profiles set alter_jahre = 20 where id = auth.uid();
--    Danach steht das alte Alter da. Siehe supabase/pruefen/regeln-live-pruefen.sql.
--
-- Rueckgaengig, falls noetig: die Fassung aus profil-email-festnageln.sql
-- wieder einspielen.
