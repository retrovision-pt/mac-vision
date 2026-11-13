DO $do$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.mac_shift_status(uuid,text,timestamptz)'::regprocedure);
  def := replace(def, 'found := true; d := (r->>''date'')::date;', 'd := (r->>''date'')::date; IF d = today THEN found := true; END IF;');
  EXECUTE def;
END $do$;