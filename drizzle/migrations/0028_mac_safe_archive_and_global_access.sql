ALTER TABLE public.mac_accounts ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.mac_stores ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE OR REPLACE FUNCTION public.mac_wallet_access(w uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.mac_accounts WHERE id=auth.uid() AND wallet_id=w AND NOT disabled) $$;
CREATE OR REPLACE FUNCTION public.mac_wallet_admin(w uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.mac_accounts WHERE id=auth.uid() AND wallet_id=w AND role='admin' AND NOT disabled) $$;
CREATE OR REPLACE FUNCTION public.mac_store_access(s text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.mac_stores st WHERE st.id=s AND (public.mac_wallet_admin(st.wallet_id) OR (st.archived_at IS NULL AND EXISTS(SELECT 1 FROM public.mac_memberships m JOIN public.mac_accounts a ON a.id=m.user_id WHERE m.user_id=auth.uid() AND m.store_id=s AND NOT a.disabled)))) $$;
CREATE OR REPLACE FUNCTION public.mac_delete_store(a uuid,s text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor public.mac_accounts;
BEGIN
 SELECT * INTO actor FROM public.mac_accounts WHERE id=a AND NOT disabled;
 IF actor.role IS DISTINCT FROM 'admin' OR NOT EXISTS(SELECT 1 FROM public.mac_stores WHERE id=s AND wallet_id=actor.wallet_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'Só um administrador pode arquivar esta loja'; END IF;
 PERFORM 1 FROM public.mac_wallets WHERE id=actor.wallet_id FOR UPDATE;
 IF (SELECT count(*) FROM public.mac_stores WHERE wallet_id=actor.wallet_id AND archived_at IS NULL)<=1 THEN RAISE EXCEPTION 'É necessário manter pelo menos uma loja ativa.'; END IF;
 UPDATE public.mac_stores SET archived_at=now() WHERE id=s;
 INSERT INTO public.mac_account_events(actor_id,user_id,event,details) VALUES(a,a,'store_archived',jsonb_build_object('store_id',s));
END $$;
CREATE OR REPLACE FUNCTION public.mac_remove_access(a uuid,u uuid,s text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor public.mac_accounts; target public.mac_accounts; owner uuid;
BEGIN
 SELECT * INTO actor FROM public.mac_accounts WHERE id=a AND NOT disabled;
 SELECT * INTO target FROM public.mac_accounts WHERE id=u AND NOT disabled FOR UPDATE;
 IF actor.role IS DISTINCT FROM 'admin' OR target.id IS NULL OR actor.wallet_id<>target.wallet_id OR a=u THEN RAISE EXCEPTION 'Só um administrador pode remover este acesso; não podes remover a própria sessão.'; END IF;
 SELECT owner_id INTO owner FROM public.mac_wallets WHERE id=actor.wallet_id FOR UPDATE;
 IF target.id=owner THEN RAISE EXCEPTION 'O dono da carteira não pode ser removido.'; END IF;
 IF target.role='admin' AND actor.admin_type<>'mac' AND actor.id<>owner THEN RAISE EXCEPTION 'Só o Gestor MAC Vision pode remover administradores.'; END IF;
 IF s='' THEN
  IF actor.admin_type<>'mac' AND actor.id<>owner THEN RAISE EXCEPTION 'Só o Gestor MAC Vision pode desativar contas globalmente.'; END IF;
  IF target.role='admin' AND ((SELECT count(*) FROM public.mac_accounts WHERE wallet_id=actor.wallet_id AND role='admin' AND NOT disabled)<=1 OR (target.admin_type='mac' AND (SELECT count(*) FROM public.mac_accounts WHERE wallet_id=actor.wallet_id AND role='admin' AND admin_type='mac' AND NOT disabled)<=1)) THEN RAISE EXCEPTION 'É necessário manter o último administrador global.'; END IF;
  UPDATE public.mac_accounts SET disabled=true WHERE id=u;
  DELETE FROM public.mac_permissions WHERE user_id=u;
  DELETE FROM public.mac_memberships WHERE user_id=u;
  DELETE FROM public.user_roles WHERE user_id=u;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.mac_stores WHERE id=s AND wallet_id=actor.wallet_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'Loja inválida'; END IF;
  DELETE FROM public.mac_permissions WHERE user_id=u AND store_id=s;
  DELETE FROM public.mac_memberships WHERE user_id=u AND store_id=s;
 END IF;
 INSERT INTO public.mac_account_events(actor_id,user_id,event,details) VALUES(a,u,CASE WHEN s='' THEN 'account_disabled' ELSE 'access_removed' END,jsonb_build_object('store_id',s));
END $$;
CREATE OR REPLACE FUNCTION public.mac_save_registry(a uuid,items jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor public.mac_accounts; st jsonb; u jsonb; target public.mac_accounts; sid text; old_role text; new_role text; owner uuid;
BEGIN
 SELECT * INTO actor FROM public.mac_accounts WHERE id=a AND NOT disabled;
 IF actor.id IS NULL OR actor.role NOT IN ('admin','gestor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF jsonb_typeof(items)<>'array' THEN RAISE EXCEPTION 'Lista inválida'; END IF;
 SELECT owner_id INTO owner FROM public.mac_wallets WHERE id=actor.wallet_id FOR UPDATE;
 FOR st IN SELECT * FROM jsonb_array_elements(items) LOOP
 sid:=st->>'id'; IF sid IS NULL OR length(trim(st->>'name'))<2 THEN RAISE EXCEPTION 'Loja inválida'; END IF;
 IF EXISTS(SELECT 1 FROM public.mac_stores WHERE id=sid AND (wallet_id<>actor.wallet_id OR archived_at IS NOT NULL)) THEN RAISE EXCEPTION 'Loja de outra carteira ou arquivada'; END IF;
 IF actor.role<>'admin' AND NOT EXISTS(SELECT 1 FROM public.mac_memberships WHERE user_id=a AND store_id=sid AND role='gestor') THEN RAISE EXCEPTION 'Sem acesso à loja'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(st->'users','[]'::jsonb)) j GROUP BY j->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Identificador de utilizador duplicado'; END IF;
 INSERT INTO public.mac_stores(id,wallet_id,name,metadata) VALUES(sid,actor.wallet_id,st->>'name',st-'id'-'wallet_id'-'name'-'users'-'archived_at') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,metadata=mac_stores.metadata||EXCLUDED.metadata WHERE (mac_stores.name,mac_stores.metadata) IS DISTINCT FROM (EXCLUDED.name,mac_stores.metadata||EXCLUDED.metadata);
 FOR u IN SELECT * FROM jsonb_array_elements(COALESCE(st->'users','[]'::jsonb)) LOOP
 SELECT * INTO target FROM public.mac_accounts WHERE id=(u->>'id')::uuid AND wallet_id=actor.wallet_id AND NOT disabled FOR UPDATE;
 IF target.id IS NULL THEN RAISE EXCEPTION 'Conta não reconhecida ou desativada'; END IF;
 old_role:=target.role;
 new_role:=CASE WHEN actor.role='admin' AND actor.admin_type='mac' AND u ? 'isAreaMaster' THEN CASE WHEN u->>'isAreaMaster'='true' THEN 'admin' ELSE u->>'role' END WHEN old_role='admin' THEN 'admin' WHEN actor.role='admin' AND u->>'isAreaMaster'='true' THEN 'admin' ELSE u->>'role' END;
 IF new_role NOT IN ('admin','gestor','colaborador') THEN RAISE EXCEPTION 'Função inválida'; END IF;
 IF old_role='admin' AND new_role<>'admin' AND (target.id=owner OR target.id=a OR (target.admin_type='mac' AND (SELECT count(*) FROM public.mac_accounts WHERE wallet_id=actor.wallet_id AND role='admin' AND admin_type='mac' AND NOT disabled)<=1)) THEN RAISE EXCEPTION 'Não podes retirar o último administrador global, o dono da carteira ou o próprio acesso.'; END IF;
 IF actor.role<>'admin' AND (old_role<>'colaborador' AND target.id<>a OR new_role<>old_role) THEN
 IF NOT EXISTS(SELECT 1 FROM public.mac_memberships WHERE user_id=target.id AND store_id=sid AND role=old_role) THEN RAISE EXCEPTION 'Não podes atribuir este acesso'; END IF; CONTINUE; END IF;
 IF length(trim(u->>'name'))<2 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
 UPDATE public.mac_accounts SET name=u->>'name',role=new_role WHERE id=target.id AND (name,role) IS DISTINCT FROM (u->>'name',new_role);
 IF old_role<>new_role THEN UPDATE public.mac_memberships SET role=new_role WHERE user_id=target.id; UPDATE public.user_roles SET role=new_role WHERE user_id=target.id; END IF;
 INSERT INTO public.mac_memberships(user_id,store_id,role,metadata) VALUES(target.id,sid,new_role,u-'id'-'role'-'hash'-'salt'-'password'-'pbkdf2Iterations'-'isAreaMaster'-'adminRole'-'disabled') ON CONFLICT(user_id,store_id) DO UPDATE SET role=EXCLUDED.role,metadata=mac_memberships.metadata||EXCLUDED.metadata WHERE (mac_memberships.role,mac_memberships.metadata) IS DISTINCT FROM (EXCLUDED.role,mac_memberships.metadata||EXCLUDED.metadata);
 END LOOP;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.mac_active_write_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.mac_accounts WHERE id=auth.uid() AND disabled) THEN RAISE EXCEPTION 'Conta desativada'; END IF;
 IF NEW.store_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.mac_stores WHERE id=NEW.store_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Loja arquivada; histórico protegido contra alterações.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mac_active_sales_guard BEFORE INSERT OR UPDATE ON public.mac_sales FOR EACH ROW EXECUTE FUNCTION public.mac_active_write_guard();
CREATE TRIGGER mac_active_document_guard BEFORE INSERT OR UPDATE ON public.mac_documents FOR EACH ROW EXECUTE FUNCTION public.mac_active_write_guard();
REVOKE ALL ON FUNCTION public.mac_delete_store(uuid,text),public.mac_remove_access(uuid,uuid,text),public.mac_save_registry(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mac_delete_store(uuid,text),public.mac_remove_access(uuid,uuid,text),public.mac_save_registry(uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mac_active_write_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mac_active_write_guard() TO service_role;