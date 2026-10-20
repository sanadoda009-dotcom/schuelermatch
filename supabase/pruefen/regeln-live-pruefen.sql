-- Prueft die Zugriffsregeln GEGEN DIE LAUFENDE DATENBANK - ohne etwas zu
-- veraendern (20.10.2026).
--
-- WARUM
-- Nach dem Einspielen der dreizehn SQL-Dateien sagte `pg_policies`, dass
-- die Regeln da sind. Ob sie fuer echte Nutzer WIRKEN, sagt das nicht -
-- und ob der normale Weg dabei noch geht, auch nicht. Dieses Skript
-- spielt beides mit den echten Konten durch.
--
-- WIE
-- Alles laeuft in EINER Transaktion, die am Ende zurueckgerollt wird.
-- Rollen werden per set_config('role', ...) und request.jwt.claims
-- gewechselt, genau wie PostgREST es fuer angemeldete Nutzer tut.
-- E-Mails gehen keine raus: pg_net verschickt nur, was committet ist.
--
-- FALLE (beim ersten Lauf passiert): Wer die Firma sperrt, waehrend noch
-- ein Nutzer "angemeldet" ist, wird vom Schutz-Trigger
-- schuetze_profil_felder still zurueckgesetzt - der Test sah dann eine
-- freigegebene Firma und meldete falsche Fehler. Gesperrt wird deshalb
-- mit leeren Claims.
--
-- Die Ids sind die Testkonten von Sanad (Stand 20.10.2026). Nachher
-- pruefen, dass die letzte Abfrage den alten Stand zeigt.
--
-- Erwartet: jede Zeile ohne "FEHLER".

begin;
create temp table _erg (fall text, ergebnis text) on commit drop;
grant all on _erg to authenticated;
do $$
declare
  s15   uuid := '21d9a7b8-fdde-4fd8-811e-d04555bdc723';  -- Schueler, 15, verifiziert
  s20   uuid := 'a7f82c3c-1a68-45c8-a462-e54bdcf6b321';  -- Schueler mit Bewerbungen
  firma uuid := 'c6501fbb-8d4e-49a4-aa9d-eebec021edf5';
  job15 uuid := 'ffa4c3df-d423-4195-9a06-62d9e17bd171';  -- ab 15
  job16 uuid := 'c29ab84e-f567-44bf-bf66-0fc7acb2ce79';  -- ab 16
  b_absage uuid := '94397208-39f1-481a-83f9-fffac75a1e4f';
  b_zusage uuid := 'e6b67555-b96d-4c9f-83bf-9f907b5c3fad';
  n int; t text;
begin
  perform set_config('role', 'authenticated', true);

  perform set_config('request.jwt.claims', json_build_object('sub', s15, 'role','authenticated')::text, true);
  begin insert into public.bewerbungen(job_id, schueler_id, status) values (job16, s15, 'ausstehend');
    insert into _erg values ('15J auf ab-16 bewerben', 'ERLAUBT (FEHLER)');
  exception when others then insert into _erg values ('15J auf ab-16 bewerben', 'abgelehnt ' || sqlstate); end;
  begin insert into public.bewerbungen(job_id, schueler_id, status) values (job15, s15, 'ausstehend');
    insert into _erg values ('15J auf ab-15 bewerben', 'erlaubt');
  exception when others then insert into _erg values ('15J auf ab-15 bewerben', 'ABGELEHNT (FEHLER) ' || sqlerrm); end;
  begin insert into public.bewerbungen(job_id, schueler_id, status) values (job15, s15, 'ausstehend');
    insert into _erg values ('dieselbe Bewerbung nochmal', 'ERLAUBT (FEHLER)');
  exception when others then insert into _erg values ('dieselbe Bewerbung nochmal', 'abgelehnt ' || sqlstate); end;
  select email into t from public.profiles where id = s15;
  update public.profiles set email = 'fremd@example.com' where id = s15;
  select case when email = t then 'bleibt' else 'GEAENDERT (FEHLER)' end into t from public.profiles where id = s15;
  insert into _erg values ('eigene E-Mail per API aendern', t);
  -- alter-nach-verifizierung-fest.sql (20.10.2026): s15 ist verifiziert und 15
  update public.profiles set alter_jahre = 20 where id = s15;
  insert into _erg select 'verifiziert: Alter 15 -> 20',
    case when alter_jahre = 15 then 'bleibt' else 'GEAENDERT (FEHLER)' end
    from public.profiles where id = s15;

  perform set_config('request.jwt.claims', json_build_object('sub', s20, 'role','authenticated')::text, true);
  begin insert into public.nachrichten(bewerbung_id, absender_id, text) values (b_absage, s20, 'test');
    insert into _erg values ('Chat bei Absage', 'ERLAUBT (FEHLER)');
  exception when others then insert into _erg values ('Chat bei Absage', 'abgelehnt ' || sqlstate); end;
  begin insert into public.nachrichten(bewerbung_id, absender_id, text) values (b_zusage, s20, 'test');
    insert into _erg values ('Chat bei Zusage', 'erlaubt');
  exception when others then insert into _erg values ('Chat bei Zusage', 'ABGELEHNT (FEHLER) ' || sqlerrm); end;

  perform set_config('request.jwt.claims', json_build_object('sub', firma, 'role','authenticated')::text, true);
  update public.bewerbungen set angesehen_am = now() where id = b_absage;
  get diagnostics n = row_count;
  insert into _erg values ('Firma setzt angesehen_am', case when n = 1 then 'erlaubt' else 'KEINE ZEILE (FEHLER)' end);
  -- bewerbung-titel-festnageln.sql (20.10.2026)
  select job_titel into t from public.bewerbungen where id = b_absage;
  update public.bewerbungen set job_titel = 'Umgeschrieben', angesehen_am = now() + interval '1 day' where id = b_absage;
  insert into _erg select 'Firma schreibt Titel-Kopie / angesehen_am um',
    case when job_titel is not distinct from t and angesehen_am < now() + interval '1 hour' then 'bleibt'
         else 'GEAENDERT (FEHLER)' end
    from public.bewerbungen where id = b_absage;

  -- firmenname-fest.sql (20.10.2026)
  update public.profiles set name = 'Andere Firma' where id = firma;
  insert into _erg select 'freigegeben: Firmenname aendern',
    case when name <> 'Andere Firma' then 'bleibt' else 'GEAENDERT (FEHLER)' end
    from public.profiles where id = firma;
  update public.jobs set firma_name = 'Polizei' where id = job15;
  insert into _erg select 'fremder Name auf der Anzeige',
    case when firma_name is distinct from 'Polizei' then 'Profilname' else 'UEBERNOMMEN (FEHLER)' end
    from public.jobs where id = job15;

  -- Sperren ohne Anmeldung (siehe FALLE oben)
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  update public.profiles set firma_status = 'gesperrt' where id = firma;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', firma, 'role','authenticated')::text, true);
  select count(*) into n from public.bewerbungen;
  insert into _erg values ('gesperrt: Bewerbungen sichtbar', case when n = 0 then '0' else n || ' (FEHLER)' end);
  select count(*) into n from public.nachrichten;
  insert into _erg values ('gesperrt: Nachrichten sichtbar', case when n = 0 then '0' else n || ' (FEHLER)' end);
  select count(*) into n from public.profiles;
  insert into _erg values ('gesperrt: Profile sichtbar', case when n = 1 then '1 (das eigene)' else n || ' (FEHLER)' end);
  select count(*) into n from storage.objects where bucket_id = 'zeugnisse';
  insert into _erg values ('gesperrt: Zeugnisse sichtbar', case when n = 0 then '0' else n || ' (FEHLER)' end);
  begin insert into public.nachrichten(bewerbung_id, absender_id, text) values (b_zusage, firma, 'test');
    insert into _erg values ('gesperrt: Nachricht schreiben', 'ERLAUBT (FEHLER)');
  exception when others then insert into _erg values ('gesperrt: Nachricht schreiben', 'abgelehnt ' || sqlstate); end;
end $$;
select * from _erg;
rollback;

-- Danach: alles wie vorher?
select (select firma_status from public.profiles where id = 'c6501fbb-8d4e-49a4-aa9d-eebec021edf5') as firma_status,
       (select count(*) from public.bewerbungen where angesehen_am is not null) as angesehen,
       (select count(*) from net.http_request_queue) as mail_warteschlange;
