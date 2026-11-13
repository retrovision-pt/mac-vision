CREATE TABLE public.mac_permissions(
 user_id uuid NOT NULL,
 store_id text NOT NULL REFERENCES public.mac_stores(id) ON DELETE CASCADE,
 perm text NOT NULL CHECK (perm IN ('all','dashboard.view','history.view','tickets.view','ios.view','imports.view','imports.moviik','sales.edit','sales.delete','schedule.edit','employees.manage','weights.manage','data.export')),
 granted_by uuid NOT NULL,
 granted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,store_id,perm)
);
GRANT SELECT ON public.mac_permissions TO authenticated;
GRANT ALL ON public.mac_permissions TO service_role;
ALTER TABLE public.mac_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mac_can_manage_perms(s text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.mac_stores st JOIN public.mac_accounts a ON a.wallet_id=st.wallet_id WHERE st.id=s AND a.id=auth.uid() AND a.role='admin')
 OR EXISTS(SELECT 1 FROM public.mac_memberships m JOIN public.mac_accounts a ON a.id=m.user_id WHERE m.user_id=auth.uid() AND m.store_id=s AND m.role='gestor' AND a.role='gestor')
$$;

CREATE OR REPLACE FUNCTION public.mac_can(p text, s text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.mac_can_manage_perms(s) OR EXISTS(
  SELECT 1 FROM public.mac_memberships m JOIN public.mac_accounts a ON a.id=m.user_id JOIN public.mac_stores st ON st.id=m.store_id AND st.wallet_id=a.wallet_id
  JOIN public.mac_permissions x ON x.user_id=m.user_id AND x.store_id=m.store_id AND x.perm IN (p,'all')
  WHERE m.user_id=auth.uid() AND m.store_id=s AND a.role='colaborador')
$$;

CREATE POLICY permissions_read ON public.mac_permissions FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.mac_can_manage_perms(store_id));

CREATE OR REPLACE FUNCTION public.mac_set_permissions(u uuid, stores text[], perms text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid text; target public.mac_accounts; before text[]; after text[];
BEGIN
 IF u=auth.uid() THEN RAISE EXCEPTION 'Não podes alterar as tuas próprias permissões'; END IF;
 SELECT * INTO target FROM public.mac_accounts WHERE id=u;
 IF target.id IS NULL OR target.role<>'colaborador' THEN RAISE EXCEPTION 'Só é possível delegar permissões a colaboradores'; END IF;
 IF COALESCE(array_length(stores,1),0)=0 THEN RAISE EXCEPTION 'Escolhe pelo menos uma loja'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(COALESCE(perms,ARRAY[]::text[])) x WHERE x NOT IN ('all','dashboard.view','history.view','tickets.view','ios.view','imports.view','imports.moviik','sales.edit','sales.delete','schedule.edit','employees.manage','weights.manage','data.export')) THEN RAISE EXCEPTION 'Permissão inválida'; END IF;
 FOREACH sid IN ARRAY stores LOOP
  IF NOT public.mac_can_manage_perms(sid) THEN RAISE EXCEPTION 'Sem autorização para gerir permissões nesta loja'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mac_memberships m JOIN public.mac_stores st ON st.id=m.store_id WHERE m.user_id=u AND m.store_id=sid AND st.wallet_id=target.wallet_id) THEN RAISE EXCEPTION 'O colaborador não está associado a uma das lojas'; END IF;
  SELECT COALESCE(array_agg(perm ORDER BY perm),ARRAY[]::text[]) INTO before FROM public.mac_permissions WHERE user_id=u AND store_id=sid;
  DELETE FROM public.mac_permissions WHERE user_id=u AND store_id=sid AND NOT (perm = ANY(COALESCE(perms,ARRAY[]::text[])));
  INSERT INTO public.mac_permissions(user_id,store_id,perm,granted_by) SELECT u,sid,x,auth.uid() FROM unnest(COALESCE(perms,ARRAY[]::text[])) x ON CONFLICT DO NOTHING;
  SELECT COALESCE(array_agg(perm ORDER BY perm),ARRAY[]::text[]) INTO after FROM public.mac_permissions WHERE user_id=u AND store_id=sid;
  IF before IS DISTINCT FROM after THEN
   INSERT INTO public.mac_account_events(actor_id,user_id,event,details) VALUES(auth.uid(),u,'permissions',jsonb_build_object('store',sid,'before',to_jsonb(before),'after',to_jsonb(after)));
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.mac_set_permissions(uuid,text[],text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mac_set_permissions(uuid,text[],text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.mac_can(text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mac_can(text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.mac_can_manage_perms(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mac_can_manage_perms(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mac_put_document(w uuid, k text, s text, v jsonb, r integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE next_rev integer; actual_store text:=NULLIF(s,''); actor_role text; actor_name text; old_value jsonb; fk text; need text;
BEGIN
 SELECT role,name INTO actor_role,actor_name FROM public.mac_accounts WHERE id=auth.uid() AND wallet_id=w;
 IF actor_role IS NULL THEN RAISE EXCEPTION 'Sem acesso à carteira'; END IF;
 IF actual_store IS NULL THEN IF actor_role<>'admin' THEN RAISE EXCEPTION 'Apenas administrador'; END IF; ELSE IF NOT public.mac_store_access(actual_store) OR NOT EXISTS(SELECT 1 FROM public.mac_stores WHERE id=actual_store AND wallet_id=w) THEN RAISE EXCEPTION 'Sem acesso à loja'; END IF; END IF;
 SELECT value INTO old_value FROM public.mac_documents WHERE wallet_id=w AND key=k;
 IF actor_role='colaborador' THEN
  IF k NOT LIKE 'store:%' THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  FOR fk IN SELECT x FROM (SELECT jsonb_object_keys(v) x UNION SELECT jsonb_object_keys(COALESCE(old_value,'{}'::jsonb))) q
   WHERE x NOT IN ('sales','tickets','imports','selectedDate','__macWriteRevision') AND (v->x) IS DISTINCT FROM (old_value->x) LOOP
   need:=CASE WHEN fk IN ('schedules','codeTimes','macScheduleExcludedByMonth','macScheduleHoursVersion','macSchedulePalette','macShiftNames') THEN 'schedule.edit'
    WHEN fk='employees' THEN 'employees.manage' WHEN fk='weights' THEN 'weights.manage' WHEN fk='moviikStoreCandidates' THEN 'imports.moviik' ELSE NULL END;
   IF need IS NULL THEN RAISE EXCEPTION 'Colaborador não pode alterar configurações de segurança ou permissões'; END IF;
   IF NOT public.mac_can(need,actual_store) THEN RAISE EXCEPTION 'Sem permissão delegada para alterar esta secção (%)', need; END IF;
  END LOOP;
  IF NOT public.mac_can('sales.edit',actual_store) AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(v->'sales','[]'::jsonb)) n WHERE n->>'employee'<>actor_name AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(old_value->'sales','[]'::jsonb)) o WHERE o=n)) THEN RAISE EXCEPTION 'Só podes alterar as tuas vendas'; END IF;
  IF NOT (public.mac_can('sales.edit',actual_store) OR public.mac_can('sales.delete',actual_store)) AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(old_value->'sales','[]'::jsonb)) o WHERE o->>'employee'<>actor_name AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(v->'sales','[]'::jsonb)) n WHERE n=o)) THEN RAISE EXCEPTION 'Só podes alterar as tuas vendas'; END IF;
 END IF;
 INSERT INTO public.mac_documents(wallet_id,key,store_id,value,revision) VALUES(w,k,actual_store,v,1) ON CONFLICT(wallet_id,key) DO UPDATE SET value=v, revision=mac_documents.revision+1,updated_at=now() WHERE mac_documents.revision=r RETURNING revision INTO next_rev;
 IF next_rev IS NULL THEN RAISE EXCEPTION 'CONFLICT'; END IF; RETURN next_rev;
END $function$;

CREATE OR REPLACE FUNCTION public.mac_put_sales(w uuid, s text, upserts jsonb, deletes text[]) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE actor_role text; actor_name text; item jsonb; old public.mac_sales; n integer:=0; did text;
BEGIN
 SELECT role,name INTO actor_role,actor_name FROM public.mac_accounts WHERE id=auth.uid() AND wallet_id=w;
 IF actor_role IS NULL THEN RAISE EXCEPTION 'Sem acesso à carteira'; END IF;
 IF NOT public.mac_store_access(s) OR NOT EXISTS(SELECT 1 FROM public.mac_stores WHERE id=s AND wallet_id=w) THEN RAISE EXCEPTION 'Sem acesso à loja'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(upserts,'[]'::jsonb)) LOOP
  IF COALESCE(item->>'id','')='' THEN RAISE EXCEPTION 'Venda sem identificador'; END IF;
  SELECT * INTO old FROM public.mac_sales WHERE store_id=s AND id=item->>'id' FOR UPDATE;
  IF FOUND THEN
   IF old.data=item AND old.deleted_at IS NULL THEN CONTINUE; END IF;
   IF actor_role='colaborador' AND lower(old.employee)<>lower(actor_name) AND old.created_by IS DISTINCT FROM auth.uid() AND NOT public.mac_can('sales.edit',s) THEN RAISE EXCEPTION 'Só podes alterar as tuas vendas'; END IF;
   UPDATE public.mac_sales SET data=item, employee=COALESCE(item->>'employee',''), deleted_at=NULL, updated_at=now() WHERE store_id=s AND id=item->>'id';
  ELSE
   INSERT INTO public.mac_sales(store_id,id,wallet_id,employee,data,created_by) VALUES(s,item->>'id',w,COALESCE(item->>'employee',''),item,auth.uid());
  END IF;
  n:=n+1;
 END LOOP;
 FOREACH did IN ARRAY COALESCE(deletes,ARRAY[]::text[]) LOOP
  SELECT * INTO old FROM public.mac_sales WHERE store_id=s AND id=did FOR UPDATE;
  IF NOT FOUND OR old.deleted_at IS NOT NULL THEN CONTINUE; END IF;
  IF actor_role='colaborador' AND lower(old.employee)<>lower(actor_name) AND old.created_by IS DISTINCT FROM auth.uid() AND NOT public.mac_can('sales.delete',s) THEN RAISE EXCEPTION 'Só podes eliminar as tuas vendas'; END IF;
  UPDATE public.mac_sales SET deleted_at=now(), updated_at=now() WHERE store_id=s AND id=did;
  n:=n+1;
 END LOOP;
 RETURN n;
END $function$;

CREATE OR REPLACE FUNCTION public.mac_put_commission(w uuid, meta jsonb, data jsonb, r integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  files_key  text := 'commission:files';
  data_key   text := 'commission:data:' || (meta->>'id');
  actor_role text;
  cur_rev    integer := 0;
  cur_value  jsonb := '{"files":[]}'::jsonb;
  cur_files  jsonb;
  new_files  jsonb;
  next_rev   integer;
  old_data   jsonb;
  old_rev    integer := 0;
  old_entry  jsonb;
  new_rev    integer := COALESCE((meta->>'version')::integer, 0);
BEGIN
  SELECT role INTO actor_role FROM public.mac_accounts WHERE id = auth.uid() AND wallet_id = w;
  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'Sem permissão para alterar o ficheiro de comissionamento';
  END IF;
  IF meta->>'id' IS NULL OR meta->>'id' = '' THEN RAISE EXCEPTION 'Identificador do ficheiro em falta'; END IF;
  IF jsonb_typeof(meta->'storeIds') <> 'array' OR jsonb_array_length(meta->'storeIds') = 0 THEN
    RAISE EXCEPTION 'Escolhe pelo menos uma loja';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(meta->'storeIds') AS t(sid)
            WHERE NOT EXISTS(SELECT 1 FROM public.mac_stores s WHERE s.id = t.sid AND s.wallet_id = w)
               OR (actor_role <> 'admin' AND NOT public.mac_store_access(t.sid))
               OR (actor_role = 'colaborador' AND NOT public.mac_can('weights.manage', t.sid))) THEN
    RAISE EXCEPTION 'Sem autorização para associar uma das lojas selecionadas';
  END IF;

  SELECT revision, value INTO cur_rev, cur_value FROM public.mac_documents WHERE wallet_id = w AND key = files_key;
  IF cur_rev IS NULL THEN
    cur_rev := 0;
    cur_value := '{"files":[]}'::jsonb;
  END IF;
  IF r IS DISTINCT FROM cur_rev THEN RAISE EXCEPTION 'CONFLICT'; END IF;

  SELECT fe INTO old_entry FROM jsonb_array_elements(COALESCE(cur_value->'files','[]'::jsonb)) fe WHERE fe->>'id' = meta->>'id';
  old_rev := COALESCE((old_entry->>'version')::integer, 0);

  IF old_rev > new_rev THEN RAISE EXCEPTION 'CONFLICT'; END IF;
  IF old_rev = new_rev AND old_entry IS NOT NULL
     AND COALESCE(old_entry->>'checksum','') <> COALESCE(meta->>'checksum','') THEN RAISE EXCEPTION 'CONFLICT'; END IF;

  cur_files := COALESCE(cur_value->'files','[]'::jsonb);
  SELECT COALESCE(jsonb_agg(fe), '[]'::jsonb) INTO new_files
    FROM (SELECT jsonb_array_elements(cur_files) AS fe) s
   WHERE s.fe->>'id' <> meta->>'id';
  new_files := new_files || jsonb_build_array(meta);

  INSERT INTO public.mac_documents(wallet_id,key,store_id,value,revision)
    VALUES (w, files_key, NULL, jsonb_set(cur_value,'{files}',new_files,true), 1)
  ON CONFLICT (wallet_id,key) DO UPDATE
    SET value = jsonb_set(COALESCE(mac_documents.value,'{"files":[]}'::jsonb),'{files}',new_files,true),
        revision = mac_documents.revision + 1,
        updated_at = now()
  WHERE mac_documents.revision = cur_rev
  RETURNING revision INTO next_rev;
  IF next_rev IS NULL THEN RAISE EXCEPTION 'CONFLICT'; END IF;

  IF new_rev > old_rev THEN
    SELECT value INTO old_data FROM public.mac_documents WHERE wallet_id = w AND key = data_key;
    INSERT INTO public.mac_documents(wallet_id,key,store_id,value,revision)
      VALUES (w, data_key, NULL, jsonb_build_object(
          'id', meta->>'id',
          'version', new_rev,
          'catalog', COALESCE(data->'catalog','{"products":[],"mobiles":[]}'::jsonb),
          'source', data->'source',
          'previous', CASE WHEN old_data IS NULL THEN 'null'::jsonb
                           ELSE jsonb_build_object('catalog', old_data->'catalog', 'source', old_data->'source') END,
          'updatedAt', meta->'updatedAt',
          'updatedBy', meta->'updatedBy'
        ), 1)
    ON CONFLICT (wallet_id,key) DO UPDATE
      SET value = EXCLUDED.value, revision = mac_documents.revision + 1, updated_at = now();
  END IF;

  RETURN next_rev;
END
$function$;