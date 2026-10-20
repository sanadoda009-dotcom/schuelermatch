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
--
-- NACHTRAG 20.10.2026 (beim Einspielen gefunden): Die Regel `meldung_ziel`
-- verlangte bei typ='job' ein job_id IS NOT NULL (und bei 'nachricht'
-- entsprechend). Mit SET NULL waere jedes Loeschen einer gemeldeten Anzeige
-- und jedes Konto-Loeschen mit gemeldeter Nachricht an dieser Regel
-- GESCHEITERT. Sie erlaubt jetzt ein leeres Ziel; dass eine Meldung nie
-- auf Anzeige UND Nachricht zugleich zeigt, bleibt erhalten. Der Wortlaut
-- steht ohnehin in `zitat`.

alter table public.meldungen drop constraint if exists meldung_ziel;
alter table public.meldungen
  add constraint meldung_ziel check (
    (typ = 'job' and nachricht_id is null)
    or (typ = 'nachricht' and job_id is null)
  );

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

-- Rueckgaengig, falls noetig - aber NUR mit Bedacht: Danach kann die
-- gemeldete Seite die Meldung wieder selbst beseitigen, indem sie ihre
-- Anzeige oder ihr Konto loescht. Genau dafuer gibt es diese Datei.
--
--   alter table public.meldungen drop constraint if exists meldungen_job_id_fkey;
--   alter table public.meldungen add constraint meldungen_job_id_fkey
--     foreign key (job_id) references public.jobs(id) on delete cascade;
--
--   alter table public.meldungen drop constraint if exists meldungen_nachricht_id_fkey;
--   alter table public.meldungen add constraint meldungen_nachricht_id_fkey
--     foreign key (nachricht_id) references public.nachrichten(id) on delete cascade;
--
-- Die Spalten muessen dafuer nullable bleiben - das sind sie bereits.
