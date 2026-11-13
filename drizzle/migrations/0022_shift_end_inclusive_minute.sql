DO $do$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.mac_shift_status(uuid,text,timestamptz)'::regprocedure);
  def := replace(def, 'at < t_end + interval ''15 minutes''', 'at < t_end + interval ''16 minutes''');
  EXECUTE def;
END $do$;