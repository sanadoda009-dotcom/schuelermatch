-- ============================================================
-- SCHUTZ-TRIGGER DER DATENBANK
--
-- Diese Datei ist die Sicherungskopie der Regeln, die verhindern,
-- dass Nutzer Felder ändern, die ihnen nicht gehören.
--
-- WARUM ES SIE GIBT (angelegt am 25.8.2026):
-- Diese Trigger waren in der Datenbank aktiv, standen aber NIRGENDWO
-- im Repo. Wäre die Datenbank neu aufgesetzt worden – nach einem Umzug,
-- einer Wiederherstellung oder wenn Supabase das Projekt pausiert –,
-- hätte man sie schlicht vergessen. Und niemand hätte es gemerkt,
-- bis sich jemand selbst zum Administrator macht.
--
-- Der Security-Audit vom 26.7.2026 hatte als KRITISCHSTEN Befund:
-- Jeder eingeloggte Nutzer konnte per
--   update profiles set ist_admin = true where id = <eigene id>
-- Administrator werden. RLS allein reicht dagegen nicht, weil die
-- Zeile dem Nutzer ja gehört – die Regel muss also einzelne SPALTEN
-- schützen. Genau das tun diese Trigger.
--
-- ANWENDEN: Im Supabase SQL-Editor einfügen und ausführen.
-- Die Datei ist wiederholbar (drop ... if exists / create or replace).
-- ============================================================


-- ------------------------------------------------------------
-- Hilfsfunktion: Ist der aktuelle Nutzer Administrator?
-- SECURITY DEFINER, damit die Abfrage nicht selbst an RLS scheitert.
-- ------------------------------------------------------------
create or replace function public.ist_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((select ist_admin from public.profiles where id = auth.uid()), false);
$function$;


-- ------------------------------------------------------------
-- profiles: die wichtigste Regel überhaupt
--
-- Friert die Felder ein, über die man sich sonst selbst Rechte oder
-- einen Status verschaffen könnte. Administratoren dürfen sie ändern,
-- und `auth.uid() is null` lässt Änderungen aus dem SQL-Editor zu
-- (dort gibt es keinen eingeloggten Nutzer).
-- ------------------------------------------------------------
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
  return new;
end $function$;

drop trigger if exists trg_schuetze_profil on public.profiles;
create trigger trg_schuetze_profil
  before update on public.profiles
  for each row execute function public.schuetze_profil_felder();


-- ------------------------------------------------------------
-- bewerbungen: nur der Status darf sich ändern (durch die Firma).
-- Alles andere bleibt so, wie es abgeschickt wurde – sonst könnte man
-- sein Motivationsschreiben nachträglich austauschen.
-- ------------------------------------------------------------
create or replace function public.schuetze_bewerbung_felder()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return new; end if;
  new.id                   := old.id;
  new.job_id               := old.job_id;
  new.schueler_id          := old.schueler_id;
  new.motivationsschreiben := old.motivationsschreiben;
  new.zeugnis_url          := old.zeugnis_url;
  new.lebenslauf_url       := old.lebenslauf_url;
  new.erstellt_am          := old.erstellt_am;
  return new;
end $function$;

drop trigger if exists trg_schuetze_bewerbung on public.bewerbungen;
create trigger trg_schuetze_bewerbung
  before update on public.bewerbungen
  for each row execute function public.schuetze_bewerbung_felder();


-- ------------------------------------------------------------
-- bewertungen: Wer bewertet wurde und von wem, ist unveränderlich.
-- ------------------------------------------------------------
create or replace function public.schuetze_bewertung_felder()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return new; end if;
  new.id            := old.id;
  new.firma_id      := old.firma_id;
  new.schueler_id   := old.schueler_id;
  new.schueler_name := old.schueler_name;
  new.erstellt_am   := old.erstellt_am;
  return new;
end $function$;

drop trigger if exists trg_schuetze_bewertung on public.bewertungen;
create trigger trg_schuetze_bewertung
  before update on public.bewertungen
  for each row execute function public.schuetze_bewertung_felder();


-- ------------------------------------------------------------
-- nachrichten: Eine abgeschickte Nachricht lässt sich nicht mehr
-- umschreiben. Nur `gelesen` darf sich ändern.
-- ------------------------------------------------------------
create or replace function public.schuetze_nachricht_felder()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return new; end if;
  new.id           := old.id;
  new.bewerbung_id := old.bewerbung_id;
  new.absender_id  := old.absender_id;
  new.text         := old.text;
  new.erstellt_am  := old.erstellt_am;
  return new;
end $function$;

drop trigger if exists trg_schuetze_nachricht on public.nachrichten;
create trigger trg_schuetze_nachricht
  before update on public.nachrichten
  for each row execute function public.schuetze_nachricht_felder();


-- ------------------------------------------------------------
-- meldungen: Niemand darf seine eigene Meldung schon als "erledigt"
-- einreichen oder eine Admin-Notiz mitschicken.
-- ------------------------------------------------------------
create or replace function public.schuetze_meldung_felder()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or ist_admin() then
    return new;
  end if;
  new.status := 'offen';
  new.notiz_admin := null;
  new.erstellt_am := now();
  return new;
end $function$;

drop trigger if exists trg_schuetze_meldung on public.meldungen;
create trigger trg_schuetze_meldung
  before insert on public.meldungen
  for each row execute function public.schuetze_meldung_felder();


-- ------------------------------------------------------------
-- meldungen: Das Zitat wird serverseitig gesetzt, nicht vom Client.
--
-- Der Sinn: Administratoren bekommen KEINE Leserechte auf alle Chats.
-- Stattdessen wird genau die eine gemeldete Nachricht als Zitat
-- kopiert. Die Prüfung darauf, ob der Melder die Nachricht überhaupt
-- sehen darf, ist entscheidend – sonst könnte man über eine Meldung
-- fremde Privatchats auslesen (man liest die eigene Meldung ja wieder).
-- ------------------------------------------------------------
create or replace function public.meldung_zitat_setzen()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_text text;
  v_autor uuid;
  v_darf boolean;
begin
  if new.typ = 'nachricht' then
    select true into v_darf
    from public.nachrichten n
    join public.bewerbungen b on b.id = n.bewerbung_id
    join public.jobs j on j.id = b.job_id
    where n.id = new.nachricht_id
      and (auth.uid() is null or b.schueler_id = auth.uid() or j.firma_id = auth.uid())
    limit 1;

    if not coalesce(v_darf, false) then
      raise exception 'Diese Nachricht kannst du nicht melden.' using errcode = '42501';
    end if;

    select n.text, n.absender_id into v_text, v_autor
    from public.nachrichten n where n.id = new.nachricht_id;

  elsif new.typ = 'job' then
    select coalesce(j.titel, '') || case when j.beschreibung is null or j.beschreibung = ''
             then '' else E'\n\n' || j.beschreibung end,
           j.firma_id
      into v_text, v_autor
    from public.jobs j where j.id = new.job_id;
  end if;

  new.zitat := left(coalesce(v_text, ''), 3000);
  new.gemeldet_user_id := v_autor;
  return new;
end $function$;

drop trigger if exists trg_zitat_meldung on public.meldungen;
create trigger trg_zitat_meldung
  before insert on public.meldungen
  for each row execute function public.meldung_zitat_setzen();


-- ------------------------------------------------------------
-- Nach dem Ausführen prüfen: Es müssen sechs Zeilen erscheinen.
-- ------------------------------------------------------------
-- select event_object_table, trigger_name
-- from information_schema.triggers
-- where trigger_schema = 'public' and trigger_name like 'trg_%'
-- order by event_object_table;
