-- Der Stand einer Bewerbung (2.9.2026)
--
-- WARUM
-- Das Schueler-Dashboard zeigt eine Zeitleiste mit drei Schritten:
--   Eingereicht -> In Pruefung -> Antwort
-- Es gibt aber nur ZWEI Zustaende. "In Pruefung" wird abgehakt, sobald der
-- Status nicht mehr `ausstehend` ist - also erst, wenn die Entscheidung
-- schon gefallen ist. Der mittlere Schritt sagt dem Schueler nichts: Er
-- steht entweder auf "noch nichts passiert" oder direkt auf "vorbei".
--
-- Dazu kommt der Punkt, der in OFFENE-PUNKTE seit dem 26.8. steht: Wird
-- eine Bewerbung abgelehnt, erfaehrt der Schueler nur DASS, nie WARUM.
--
-- Diese drei Spalten schliessen beides. Alle nullbar, kein Nachtragen
-- noetig - vorhandene Bewerbungen bleiben unveraendert und zeigen
-- weiterhin das, was sie heute zeigen.
--
-- ZUM ABSAGEGRUND
-- Bewusst KEIN Freitext. Erstens ist es eine Nachricht von einem
-- Erwachsenen an ein Kind - ein offenes Feld ist derselbe Kanal wie der
-- Chat und braeuchte dieselbe Pruefung. Zweitens raten die Leitfaeden zu
-- wertschaetzenden Absagen ohnehin zu kurzen, klaren Gruenden. Die
-- erlaubten Werte stehen deshalb in einer CHECK-Regel, und der Satz dazu
-- steht im Browser.
--
-- VORHER PRUEFEN - die Spalten duerfen es noch nicht geben:
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'bewerbungen';

alter table public.bewerbungen
  add column if not exists angesehen_am   timestamptz,
  add column if not exists entschieden_am timestamptz,
  add column if not exists absage_grund   text;

alter table public.bewerbungen
  drop constraint if exists chk_absage_grund;

alter table public.bewerbungen
  add constraint chk_absage_grund
  check (absage_grund is null or absage_grund in
    ('anderer', 'zeit', 'entfernung', 'alter', 'vergeben'));

-- NACHHER PRUEFEN - muss DREI Zeilen liefern:
--
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'bewerbungen'
--     and column_name in ('angesehen_am', 'entschieden_am', 'absage_grund');
--
-- Und die Regel - muss GENAU EINE Zeile liefern:
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.bewerbungen'::regclass
--     and conname = 'chk_absage_grund';
--
-- HINWEIS ZU DEN SCHREIBRECHTEN
-- Die Firma muss `angesehen_am`, `entschieden_am` und `absage_grund` an
-- den Bewerbungen auf ihre eigenen Anzeigen setzen duerfen. Das darf sie
-- heute schon: Die UPDATE-Regel auf `bewerbungen` haengt am Job der Firma,
-- nicht an einzelnen Spalten. Zur Kontrolle:
--
--   select policyname, cmd, qual
--   from pg_policies
--   where schemaname = 'public' and tablename = 'bewerbungen' and cmd = 'UPDATE';
--
-- Rueckgaengig, falls noetig:
--   alter table public.bewerbungen drop constraint if exists chk_absage_grund;
--   alter table public.bewerbungen
--     drop column if exists angesehen_am,
--     drop column if exists entschieden_am,
--     drop column if exists absage_grund;
