DO $migration$
DECLARE original_definition text; updated_definition text;
BEGIN
 SELECT pg_get_functiondef('public.mac_put_document(uuid,text,text,jsonb,integer)'::regprocedure) INTO original_definition;
 updated_definition := replace(original_definition,
  '''macScheduleExcludedByMonth'',''macScheduleHoursVersion''',
  '''macScheduleExcludedByMonth'',''macScheduleHiddenByMonth'',''macScheduleAliasesByMonth'',''macScheduleHoursVersion''');
 IF updated_definition = original_definition THEN
  RAISE EXCEPTION 'A regra existente da escala mudou; nenhuma permissão foi alterada.';
 END IF;
 EXECUTE updated_definition;
END $migration$;