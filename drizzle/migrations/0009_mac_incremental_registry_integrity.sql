CREATE TABLE public.mac_account_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, user_id uuid NOT NULL, event text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.mac_account_events TO authenticated; GRANT ALL ON public.mac_account_events TO service_role;
ALTER TABLE public.mac_account_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_events_admin_read ON public.mac_account_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.mac_accounts actor JOIN public.mac_accounts target ON target.wallet_id=actor.wallet_id WHERE actor.id=auth.uid() AND actor.role='admin' AND target.id=user_id));
CREATE OR REPLACE FUNCTION public.mac_save_registry(a uuid, items jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor public.mac_accounts; st jsonb; u jsonb; target public.mac_accounts; sid text; old_role text; new_role text;
BEGIN
 SELECT * INTO actor FROM public.mac_accounts WHERE id=a;
 IF actor.id IS NULL OR actor.role NOT IN ('admin','gestor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF jsonb_typeof(items)<>'array' THEN RAISE EXCEPTION 'Lista inválida'; END IF;
 FOR st IN SELECT * FROM jsonb_array_elements(items) LOOP
 sid:=st->>'id'; IF sid IS NULL OR length(trim(st->>'name'))<2 THEN RAISE EXCEPTION 'Loja inválida'; END IF;
 IF EXISTS(SELECT 1 FROM public.mac_stores WHERE id=sid AND wallet_id<>actor.wallet_id) THEN RAISE EXCEPTION 'Outra carteira'; END IF;
 IF actor.role<>'admin' AND NOT EXISTS(SELECT 1 FROM public.mac_memberships WHERE user_id=a AND store_id=sid AND role='gestor') THEN RAISE EXCEPTION 'Sem acesso à loja'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(st->'users','[]'::jsonb)) j GROUP BY j->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Identificador de utilizador duplicado'; END IF;
 INSERT INTO public.mac_stores(id,wallet_id,name,metadata) VALUES(sid,actor.wallet_id,st->>'name',st-'id'-'wallet_id'-'name'-'users') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,metadata=mac_stores.metadata||EXCLUDED.metadata WHERE (mac_stores.name,mac_stores.metadata) IS DISTINCT FROM (EXCLUDED.name,mac_stores.metadata||EXCLUDED.metadata);
 FOR u IN SELECT * FROM jsonb_array_elements(COALESCE(st->'users','[]'::jsonb)) LOOP
 SELECT * INTO target FROM public.mac_accounts WHERE id=(u->>'id')::uuid AND wallet_id=actor.wallet_id FOR UPDATE;
 IF target.id IS NULL THEN RAISE EXCEPTION 'Conta não reconhecida'; END IF;
 old_role:=target.role;
 new_role:=CASE WHEN old_role='admin' THEN 'admin' WHEN actor.role='admin' AND u->>'isAreaMaster'='true' THEN 'admin' ELSE u->>'role' END;
 IF new_role NOT IN ('admin','gestor','colaborador') THEN RAISE EXCEPTION 'Função inválida'; END IF;
 IF actor.role<>'admin' AND (old_role<>'colaborador' AND target.id<>a OR new_role<>old_role) THEN
 IF NOT EXISTS(SELECT 1 FROM public.mac_memberships WHERE user_id=target.id AND store_id=sid AND role=old_role) THEN RAISE EXCEPTION 'Não podes atribuir este acesso'; END IF; CONTINUE; END IF;
 IF length(trim(u->>'name'))<2 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
 IF old_role<>new_role THEN UPDATE public.mac_memberships SET role=new_role WHERE user_id=target.id; END IF;
 UPDATE public.mac_accounts SET name=u->>'name',role=new_role WHERE id=target.id AND (name,role) IS DISTINCT FROM (u->>'name',new_role);
 IF old_role<>new_role THEN UPDATE public.user_roles SET role=new_role WHERE user_id=target.id; END IF;
 INSERT INTO public.mac_memberships(user_id,store_id,role,metadata) VALUES(target.id,sid,new_role,u-'id'-'role'-'hash'-'salt'-'password'-'pbkdf2Iterations'-'isAreaMaster'-'adminRole') ON CONFLICT(user_id,store_id) DO UPDATE SET role=EXCLUDED.role,metadata=mac_memberships.metadata||EXCLUDED.metadata WHERE (mac_memberships.role,mac_memberships.metadata) IS DISTINCT FROM (EXCLUDED.role,mac_memberships.metadata||EXCLUDED.metadata);
 END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.mac_save_registry(uuid,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.mac_save_registry(uuid,jsonb) TO service_role;
CREATE FUNCTION public.mac_remove_access(a uuid, u uuid, s text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor public.mac_accounts; target public.mac_accounts;
BEGIN
 SELECT * INTO actor FROM public.mac_accounts WHERE id=a;
 SELECT * INTO target FROM public.mac_accounts WHERE id=u FOR UPDATE;
 IF actor.role IS DISTINCT FROM 'admin' OR target.id IS NULL OR actor.wallet_id<>target.wallet_id OR a=u OR target.role='admin' THEN RAISE EXCEPTION 'Só um administrador pode remover este acesso'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mac_stores WHERE id=s AND wallet_id=actor.wallet_id) THEN RAISE EXCEPTION 'Loja inválida'; END IF;
 DELETE FROM public.mac_memberships WHERE user_id=u AND store_id=s;
 INSERT INTO public.mac_account_events(actor_id,user_id,event,details) VALUES(a,u,'access_removed',jsonb_build_object('store_id',s));
END $$;
REVOKE ALL ON FUNCTION public.mac_remove_access(uuid,uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.mac_remove_access(uuid,uuid,text) TO service_role;