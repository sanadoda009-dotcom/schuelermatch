-- Eine Meldung darf nicht mitgeloescht werden (2.9.2026)
--
-- WARUM
-- Am 27.8. wurde `meldungen.melder_id` von CASCADE auf SET NULL gestellt,
-- damit eine Meldung nicht mit dem Konto des MELDERS verschwindet. Die
-- andere Seite blieb offen:
--
--   meldungen.job_id        -> jobs         ON DELETE CASCADE
--   meldungen.nachricht_id  -> nachrichten  ON DELETE CASCADE
--
-- Und `jobs` hat die Loeschregel `auth.uid() = firma_id`: Eine Firma darf
-- ihre eigene Anzeige loeschen. Damit verschwindet JEDE Meldung darueber -
-- bevor jemand sie angesehen hat. Wer gemeldet wird, kann die Meldung also
-- selbst beseitigen.
--
-- Ueber `nachrichten.absender_id -> profiles ON DELETE CASCADE` gilt
-- dasselbe fuers eigene Konto: Konto loeschen -> Nachrichten weg ->
-- Meldungen darueber weg.
--
-- Der Wortlaut des gemeldeten Inhalts wird seit dem 2.9. beim Melden
-- mitgespeichert (`meldungen.zitat`). Diese Datei sorgt dafuer, dass die
-- Meldung SELBST bestehen bleibt; die Verweise werden dann leer und der
-- Betreiber-Bereich zeigt keinen toten Link mehr an.
--
-- VORHER PRUEFEN - beide muessen heute CASCADE sein:
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.meldungen'::regclass and contype = 'f';
--
-- Beide Spalten sind bereits nullbar, es ist also keine Spaltenaenderung
-- noetig.

alter table public.meldungen
  drop constraint if exists meldungen_job_id_fkey;
alter table public.meldungen
  add constraint meldungen_job_id_fkey
  foreign key (job_id) references public.jobs(id) on delete set null;

alter table public.meldungen
  drop constraint if exists meldungen_nachricht_id_fkey;
alter table public.meldungen
  add constraint meldungen_nachricht_id_fkey
  foreign key (nachricht_id) references public.nachrichten(id) on delete set null;

-- NACHHER PRUEFEN - beide muessen SET NULL zeigen, und es muss von jedem
-- GENAU EINE Zeile geben:
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.meldungen'::regclass and contype = 'f'
--   order by conname;
--
-- Erwartet:
--   meldungen_gemeldet_user_id_fkey ... ON DELETE SET NULL
--   meldungen_job_id_fkey           ... ON DELETE SET NULL
--   meldungen_melder_id_fkey        ... ON DELETE SET NULL
--   meldungen_nachricht_id_fkey     ... ON DELETE SET NULL
