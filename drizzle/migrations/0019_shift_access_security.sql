CREATE OR REPLACE FUNCTION public.mac_norm_name(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT upper(regexp_replace(translate(coalesce(t,''),
    'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'), '[^A-Za-z0-9]', '', 'g'))
$$;

-- Server-side schedule access rule (Europe/Lisbon): [start-15min, end+15min).
CREATE OR REPLACE FUNCTION public.mac_shift_status(u uuid, s text, at timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acc record; doc jsonb; person text; alias text; r jsonb; code text; st text; en text;
  d date; t_start timestamptz; t_end timestamptz; nxt timestamptz; found boolean := false;
  today date := (at AT TIME ZONE 'Europe/Lisbon')::date;
  defaults jsonb := '{"A":["09:00","18:00"],"B":["09:45","18:45"],"C":["10:00","19:00"],"D":["11:00","20:00"],"E":["12:00","21:00"],"G":["13:00","22:00"],"H":["14:00","23:00"],"I":["15:00","00:00"]}';
BEGIN
  SELECT a.id, a.role, a.name, m.metadata->>'employee' AS employee INTO acc
    FROM mac_accounts a JOIN mac_memberships m ON m.user_id = a.id AND m.store_id = s WHERE a.id = u;
  IF acc.id IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'store'); END IF;
  IF acc.role <> 'colaborador' THEN RETURN jsonb_build_object('allowed', true, 'reason', 'manager'); END IF;
  SELECT value INTO doc FROM mac_documents WHERE store_id = s AND key = 'store:' || s;
  IF doc IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'none'); END IF;
  IF doc->'macRequireScheduledShift' = 'false'::jsonb THEN RETURN jsonb_build_object('allowed', true, 'reason', 'disabled'); END IF;
  person := mac_norm_name(acc.name); alias := mac_norm_name(nullif(acc.employee, ''));
  FOR r IN SELECT x FROM jsonb_array_elements(coalesce(doc->'schedules', '[]')) x LOOP
    IF (r->>'date') NOT IN (today::text, (today - 1)::text) THEN CONTINUE; END IF;
    IF mac_norm_name(r->>'employee') NOT IN (person, coalesce(alias, person)) THEN CONTINUE; END IF;
    code := upper(trim(coalesce(r->>'code', '')));
    IF code NOT IN ('A','B','C','D','E','G','H','I') THEN CONTINUE; END IF;
    st := coalesce(nullif(doc->'codeTimes'->code->>'start', ''), nullif(r->>'start', ''), defaults->code->>0);
    en := coalesce(nullif(doc->'codeTimes'->code->>'end', ''), nullif(r->>'end', ''), defaults->code->>1);
    IF st !~ '^\d{1,2}:\d{2}$' OR en !~ '^\d{1,2}:\d{2}$' THEN CONTINUE; END IF;
    found := true; d := (r->>'date')::date;
    t_start := (d + st::interval) AT TIME ZONE 'Europe/Lisbon';
    t_end := (d + en::interval) AT TIME ZONE 'Europe/Lisbon';
    IF t_end <= t_start THEN t_end := ((d + 1) + en::interval) AT TIME ZONE 'Europe/Lisbon'; END IF;
    IF at >= t_start - interval '15 minutes' AND at < t_end + interval '15 minutes' THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'shift', 'until', t_end + interval '15 minutes');
    END IF;
    IF at < t_start - interval '15 minutes' AND (nxt IS NULL OR t_start < nxt) THEN nxt := t_start - interval '15 minutes'; END IF;
  END LOOP;
  IF nxt IS NOT NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'before', 'opens', nxt); END IF;
  RETURN jsonb_build_object('allowed', false, 'reason', CASE WHEN found THEN 'after' ELSE 'none' END);
END $$;
REVOKE ALL ON FUNCTION public.mac_shift_status(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mac_shift_status(uuid, text, timestamptz) TO authenticated, service_role;

-- Own status only, for the open session.
CREATE OR REPLACE FUNCTION public.mac_my_shift_status(s text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.mac_shift_status(auth.uid(), s, now()) $$;
REVOKE ALL ON FUNCTION public.mac_my_shift_status(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mac_my_shift_status(text) TO authenticated;

-- Backend block: collaborators outside their access window cannot write protected data.
CREATE OR REPLACE FUNCTION public.mac_shift_write_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ok boolean;
BEGIN
  IF uid IS NULL OR NOT EXISTS (SELECT 1 FROM mac_accounts WHERE id = uid AND role = 'colaborador') THEN RETURN NEW; END IF;
  IF NEW.store_id IS NOT NULL THEN
    ok := coalesce((public.mac_shift_status(uid, NEW.store_id)->>'allowed')::boolean, false);
  ELSE
    SELECT bool_or(coalesce((public.mac_shift_status(uid, m.store_id)->>'allowed')::boolean, false)) INTO ok
      FROM mac_memberships m WHERE m.user_id = uid;
  END IF;
  IF NOT coalesce(ok, false) THEN RAISE EXCEPTION 'MAC_SHIFT_CLOSED'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mac_shift_guard_sales ON public.mac_sales;
CREATE TRIGGER mac_shift_guard_sales BEFORE INSERT OR UPDATE ON public.mac_sales FOR EACH ROW EXECUTE FUNCTION public.mac_shift_write_guard();
DROP TRIGGER IF EXISTS mac_shift_guard_documents ON public.mac_documents;
CREATE TRIGGER mac_shift_guard_documents BEFORE INSERT OR UPDATE ON public.mac_documents FOR EACH ROW EXECUTE FUNCTION public.mac_shift_write_guard();