CREATE OR REPLACE FUNCTION public.mac_put_document(w uuid,k text,s text,v jsonb,r integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE next_rev integer; actual_store text:=NULLIF(s,''); actor_role text; actor_name text; old_value jsonb; BEGIN
 SELECT role,name INTO actor_role,actor_name FROM public.mac_accounts WHERE id=auth.uid() AND wallet_id=w;
 IF actor_role IS NULL THEN RAISE EXCEPTION 'Sem acesso à carteira'; END IF;
 IF actual_store IS NULL THEN IF actor_role<>'admin' THEN RAISE EXCEPTION 'Apenas administrador'; END IF; ELSE IF NOT public.mac_store_access(actual_store) OR NOT EXISTS(SELECT 1 FROM public.mac_stores WHERE id=actual_store AND wallet_id=w) THEN RAISE EXCEPTION 'Sem acesso à loja'; END IF; END IF;
 SELECT value INTO old_value FROM public.mac_documents WHERE wallet_id=w AND key=k;
 IF actor_role='colaborador' THEN
 IF k NOT LIKE 'store:%' THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF (v-'sales'-'tickets'-'imports'-'selectedDate'-'__macWriteRevision') IS DISTINCT FROM (old_value-'sales'-'tickets'-'imports'-'selectedDate'-'__macWriteRevision') THEN RAISE EXCEPTION 'Colaborador não pode alterar configurações, escalas ou permissões'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(v->'sales','[]'::jsonb)) n WHERE n->>'employee'<>actor_name AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(old_value->'sales','[]'::jsonb)) o WHERE o=n)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(old_value->'sales','[]'::jsonb)) o WHERE o->>'employee'<>actor_name AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(v->'sales','[]'::jsonb)) n WHERE n=o)) THEN RAISE EXCEPTION 'Só podes alterar as tuas vendas'; END IF;
 END IF;
 INSERT INTO public.mac_documents(wallet_id,key,store_id,value,revision) VALUES(w,k,actual_store,v,1) ON CONFLICT(wallet_id,key) DO UPDATE SET value=v, revision=mac_documents.revision+1,updated_at=now() WHERE mac_documents.revision=r RETURNING revision INTO next_rev;
 IF next_rev IS NULL THEN RAISE EXCEPTION 'CONFLICT'; END IF; RETURN next_rev; END $$;
GRANT UPDATE ON public.mac_reads TO authenticated;
CREATE POLICY reads_update ON public.mac_reads FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());