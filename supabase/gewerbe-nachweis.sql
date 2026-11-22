-- Abzeichen "Gewerbe nachgewiesen" fuer Firmen (22.11.2026, eingespielt)
--
-- SETZT VORAUS: admin-zwei-faktor.sql
-- (ersetzt schuetze_profil_felder; ist_admin() verlangt dort den
-- zweiten Faktor - die Freigabe des Abzeichens ist ein Admin-Recht)
--
-- WARUM
-- "Von SchuelerMatch geprueft" heisst bisher: Jemand hat Name, Ort und
-- E-Mail angesehen und die Firma freigegeben. Eltern wollen mehr wissen,
-- bevor ihr Kind irgendwo arbeitet. Wer ein Gewerbe hat, kann es jetzt
-- belegen (Gewerbeanmeldung oder Handelsregisterauszug). Privatleute -
-- die Nachbarin, die einen Babysitter sucht - haben keins und brauchen
-- keins; ohne Abzeichen bleibt alles wie bisher.
--
-- WAS DIESE DATEI AENDERT
-- 1) profiles.gewerbe_url: Pfad des hochgeladenen Nachweises in der
--    privaten Ablage `verifizierung` (<id>/gewerbe.<endung>). Dieselbe
--    Ablage wie der Schuelerausweis - ihre Regeln passen schon: jeder nur
--    im eigenen Ordner, lesen und loeschen sonst nur Admins.
-- 2) profiles.gewerbe_geprueft: das Abzeichen. Setzen darf es nur ein
--    Admin (eingefroren in schuetze_profil_felder).
-- 3) Wie beim Ausweis: Das Abzeichen gibt es erst, wenn der Nachweis
--    geloescht ist (gewerbe_weg_bei_pruefung). Wir brauchen ihn zum
--    Pruefen, nicht zum Aufbewahren.
-- 4) Die Sicht firmen_oeffentlich zeigt das Abzeichen (Spalte am Ende -
--    create or replace view darf nur hinten anfuegen).

-- 1) + 2)
alter table public.profiles
  add column if not exists gewerbe_url text;
alter table public.profiles
  add column if not exists gewerbe_geprueft boolean not null default false;

create or replace function public.schuetze_profil_felder()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  -- 20.10.2026: Der geprueft Firmenname bleibt, was geprueft wurde.
  if old.role = 'firma' and old.firma_status = 'freigegeben' then
    new.name := old.name;
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
  -- 22.11.2026: Das Abzeichen vergibt nur der Betreiber, der Nachweis
  -- liegt nur im eigenen Ordner.
  new.gewerbe_geprueft := old.gewerbe_geprueft;
  if new.gewerbe_url is not null
     and split_part(new.gewerbe_url, '/', 1) <> new.id::text then
    new.gewerbe_url := old.gewerbe_url;
  end if;
  return new;
end $function$;

-- 3)
create or replace function public.gewerbe_weg_bei_pruefung()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rest int;
begin
  if new.gewerbe_geprueft is true and coalesce(old.gewerbe_geprueft, false) is false then
    select count(*) into rest
      from storage.objects
     where bucket_id = 'verifizierung'
       and name like new.id::text || '/gewerbe.%';
    if rest > 0 then
      raise exception 'Abzeichen abgelehnt: Der Gewerbenachweis liegt noch in der Ablage. Bitte ueber den Betreiber-Bereich bestaetigen - der Knopf loescht ihn zuerst.'
        using errcode = '23514';
    end if;
    new.gewerbe_url := null;
  end if;
  return new;
end $function$;

revoke all on function public.gewerbe_weg_bei_pruefung() from public, anon, authenticated;

drop trigger if exists trg_wache_gewerbe_weg on public.profiles;
create trigger trg_wache_gewerbe_weg
  before update on public.profiles
  for each row execute function public.gewerbe_weg_bei_pruefung();

-- 4)
create or replace view public.firmen_oeffentlich as
  select
    p.id,
    p.name,
    p.ort,
    p.foto_url,
    p.ueber_mich,
    p.erstellt_am,
    p.gewerbe_geprueft
  from public.profiles p
  where p.role = 'firma'
    and p.firma_status = 'freigegeben';

grant select on public.firmen_oeffentlich to anon, authenticated;

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--   select column_name from information_schema.columns
--    where table_name = 'profiles' and column_name like 'gewerbe%';   -- 2 Zeilen
--   select gewerbe_geprueft from public.firmen_oeffentlich limit 1;   -- geht
-- Gegenprobe (Transaktion + rollback): als Firma
--   update profiles set gewerbe_geprueft = true where id = auth.uid();
--   -> bleibt false
--
-- Rueckgaengig, falls noetig:
--   drop trigger if exists trg_wache_gewerbe_weg on public.profiles;
--   Sicht ohne die letzte Spalte neu anlegen (drop view + create, siehe
--   firma-oeffentlich.sql), Trigger-Funktion aus alter-nach-verifizierung-fest.sql
--   bzw. firmenname-fest.sql. Die Spalten koennen bleiben.
