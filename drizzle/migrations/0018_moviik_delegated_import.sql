CREATE OR REPLACE FUNCTION public.mac_moviik_importer(w uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT EXISTS(SELECT 1 FROM public.mac_accounts a WHERE a.id=auth.uid() AND a.wallet_id=w AND (
  a.role IN ('admin','gestor') OR EXISTS(SELECT 1 FROM public.mac_permissions p JOIN public.mac_stores s ON s.id=p.store_id
   WHERE p.user_id=a.id AND s.wallet_id=w AND p.perm IN ('imports.moviik','all') AND public.mac_store_access(p.store_id))))
$$;
REVOKE ALL ON FUNCTION public.mac_moviik_importer(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mac_moviik_importer(uuid) TO authenticated;

CREATE POLICY documents_moviik_pending_read ON public.mac_documents FOR SELECT TO authenticated
 USING (store_id IS NULL AND key='mac-vision-moviik-pending-v3' AND public.mac_moviik_importer(wallet_id));

CREATE OR REPLACE FUNCTION public.mac_put_document(w uuid, k text, s text, v jsonb, r integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE next_rev integer; actual_store text:=NULLIF(s,''); actor_role text; actor_name text; old_value jsonb; fk text; need text; before_n int; after_n int;
BEGIN
 SELECT role,name INTO actor_role,actor_name FROM public.mac_accounts WHERE id=auth.uid() AND wallet_id=w;
 IF actor_role IS NULL THEN RAISE EXCEPTION 'Sem acesso à carteira'; END IF;
 IF actual_store IS NULL THEN
  IF k='mac-vision-moviik-pending-v3' THEN
   IF NOT public.mac_moviik_importer(w) THEN RAISE EXCEPTION 'Sem permissão delegada para importar senhas MOVIIK'; END IF;
  ELSIF actor_role<>'admin' THEN RAISE EXCEPTION 'Apenas administrador'; END IF;
 ELSE IF NOT public.mac_store_access(actual_store) OR NOT EXISTS(SELECT 1 FROM public.mac_stores WHERE id=actual_store AND wallet_id=w) THEN RAISE EXCEPTION 'Sem acesso à loja'; END IF; END IF;
 SELECT value INTO old_value FROM public.mac_documents WHERE wallet_id=w AND key=k;
 IF actor_role='colaborador' AND k<>'mac-vision-moviik-pending-v3' THEN
  IF k NOT LIKE 'store:%' THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  FOR fk IN SELECT x FROM (SELECT jsonb_object_keys(v) x UNION SELECT jsonb_object_keys(COALESCE(old_value,'{}'::jsonb))) q
   WHERE x NOT IN ('sales','imports','selectedDate','__macWriteRevision') AND (v->x) IS DISTINCT FROM (old_value->x) LOOP
   need:=CASE WHEN fk IN ('schedules','codeTimes','macScheduleExcludedByMonth','macScheduleHoursVersion','macSchedulePalette','macShiftNames') THEN 'schedule.edit'
    WHEN fk='employees' THEN 'employees.manage' WHEN fk='weights' THEN 'weights.manage' WHEN fk IN ('moviikStoreCandidates','tickets') THEN 'imports.moviik' ELSE NULL END;
   IF need IS NULL THEN RAISE EXCEPTION 'Colaborador não pode alterar configurações de segurança ou permissões'; END IF;
   IF NOT public.mac_can(need,actual_store) THEN RAISE EXCEPTION 'Sem permissão delegada para alterar esta secção (%)', need; END IF;
  END LOOP;
  IF NOT public.mac_can('sales.edit',actual_store) AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(v->'sales','[]'::jsonb)) n WHERE n->>'employee'<>actor_name AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(old_value->'sales','[]'::jsonb)) o WHERE o=n)) THEN RAISE EXCEPTION 'Só podes alterar as tuas vendas'; END IF;
  IF NOT (public.mac_can('sales.edit',actual_store) OR public.mac_can('sales.delete',actual_store)) AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(old_value->'sales','[]'::jsonb)) o WHERE o->>'employee'<>actor_name AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(v->'sales','[]'::jsonb)) n WHERE n=o)) THEN RAISE EXCEPTION 'Só podes alterar as tuas vendas'; END IF;
 END IF;
 INSERT INTO public.mac_documents(wallet_id,key,store_id,value,revision) VALUES(w,k,actual_store,v,1) ON CONFLICT(wallet_id,key) DO UPDATE SET value=v, revision=mac_documents.revision+1,updated_at=now() WHERE mac_documents.revision=r RETURNING revision INTO next_rev;
 IF next_rev IS NULL THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 IF k LIKE 'store:%' AND (v->'tickets') IS DISTINCT FROM (old_value->'tickets') THEN
  before_n:=COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(old_value->'tickets')='array' THEN old_value->'tickets' END),0);
  after_n:=COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(v->'tickets')='array' THEN v->'tickets' END),0);
  INSERT INTO public.mac_account_events(actor_id,user_id,event,details) VALUES(auth.uid(),auth.uid(),'moviik.import',jsonb_build_object('store',actual_store,'before',before_n,'after',after_n,'created',GREATEST(after_n-before_n,0)));
 END IF;
 RETURN next_rev;
END $function$;