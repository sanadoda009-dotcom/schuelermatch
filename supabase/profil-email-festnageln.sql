-- Die E-Mail im Profil darf niemand frei setzen (4.9.2026)
--
-- WARUM
-- Ausgelesen aus der laufenden Datenbank:
--
--   Regel  "Eigenes Profil bearbeiten"   UPDATE  using (auth.uid() = id)
--   Trigger trg_schuetze_profil -> schuetze_profil_felder()
--
-- Der Trigger friert genau vier Spalten ein:
--
--   ist_admin, verifiziert, firma_status, role
--
-- `email` steht NICHT darunter. Und RLS wirkt auf ZEILEN, nicht auf
-- Spalten - wer seine Zeile aendern darf, aendert sie ganz. Ueber die API
-- mit dem oeffentlichen anon-Key kann also jeder angemeldete Nutzer
-- `profiles.email` auf eine BELIEBIGE Adresse setzen.
--
-- WARUM DAS ZAEHLT
-- Die Edge Function `mail-ereignis` laedt den Empfaenger seit dem
-- Security-Fix #2 bewusst AUTORITATIV aus der Datenbank statt aus der
-- eingehenden Payload:
--
--   .select('email, name, verifiziert, firma_status')
--
-- Genau diese Spalte. Der Fix hat die Payload dichtgemacht, aber die
-- Quelle, auf die er ausweicht, ist selbst beschreibbar. Damit gilt:
--
--   1. Die Bestaetigung der E-Mail-Adresse ist umgangen. Supabase laesst
--      eine Aenderung von `auth.users.email` nur mit Bestaetigungsmail
--      zu - `profiles.email` haengt da nicht dran.
--   2. Wer seine Profil-Adresse auf die eines Fremden setzt, laesst die
--      Plattform Mails von der verifizierten Domain an diesen Fremden
--      schicken. Der Inhalt ist zwar fest vorgegeben und escaped, aber
--      es sind unerwuenschte Mails von @mail.schuelermatch.de - das geht
--      auf den Ruf der Domain bei Resend.
--   3. Im Betreiber-Bereich steht dann eine Adresse, die dem Konto nicht
--      gehoert. Wer sich darauf verlaesst, schreibt an die falsche Person.
--
-- KEIN CODE BRAUCHT DAS
-- Keine Stelle im Frontend schreibt `profiles.email` - geprueft in
-- js/dashboard-schueler.js und js/dashboard-firma.js: `speichereProfil`
-- schreibt Name, Ort, Alter, Schule, Foto, Ueber-mich, Benachrichtigung.
-- Die Spalte wird beim Anlegen des Kontos gefuellt und danach nur gelesen.
--
-- WAS DIESE DATEI AENDERT
-- `email` kommt in dieselbe Liste wie ist_admin, verifiziert,
-- firma_status und role: Ein Aenderungsversuch wird still auf den alten
-- Wert zurueckgesetzt, genau wie dort. Admins duerfen weiterhin - der
-- Trigger laesst sie schon oben durch.

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
  -- Neu am 4.9.2026: Die Adresse, an die `mail-ereignis` verschickt.
  new.email        := old.email;
  return new;
end $$;

-- Der Trigger selbst bleibt, wie er ist:
--   CREATE TRIGGER trg_schuetze_profil BEFORE UPDATE ON public.profiles
--   FOR EACH ROW EXECUTE FUNCTION schuetze_profil_felder()

-- ------------------------------------------------------------
-- NACHHER PRUEFEN
-- ------------------------------------------------------------
--
-- 1) Die Funktion nennt jetzt fuenf Spalten:
--
--   select pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'schuetze_profil_felder';
--
--   Erwartet: eine Zeile `new.email := old.email;`
--
-- 2) Gegenprobe mit einem TESTKONTO (nie mit einem echten):
--    Angemeldet als Testschueler, ueber die API
--      update profiles set email = 'fremd@example.com' where id = <eigene id>;
--    Danach:
--      select email from profiles where id = <eigene id>;
--    Erwartet: die urspruengliche Adresse. Kein Fehler - der Trigger
--    setzt still zurueck, so wie bei den vier anderen Spalten auch.
--
-- 3) Der normale Weg muss weiter gehen: Im Schueler-Dashboard Name und
--    Ort aendern und speichern. Das muss klappen wie bisher.
--
-- WAS DAMIT NICHT GELOEST IST
-- Aendert jemand seine Adresse ueber Supabase Auth (mit Bestaetigung),
-- laeuft `profiles.email` danach der echten Adresse hinterher. Bisher
-- gibt es dafuer keinen Abgleich - und weil die Seite den Wechsel gar
-- nicht anbietet, ist das heute kein Problem. Sollte er dazukommen,
-- gehoert dazu ein Trigger auf `auth.users`, der `profiles.email`
-- nachzieht.
--
-- Rueckgaengig, falls noetig: dieselbe Funktion ohne die Zeile
--   new.email := old.email;
