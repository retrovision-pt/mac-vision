ALTER TABLE public.mac_stores ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.mac_memberships ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.mac_messages ADD COLUMN edited_at timestamptz;
CREATE POLICY reads_sender ON public.mac_reads FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.mac_messages m WHERE m.id=message_id AND m.sender_id=auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.mac_reads,public.profiles,public.mac_accounts,public.mac_wallets;
CREATE FUNCTION public.mac_save_registry(a uuid, items jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor public.mac_accounts; st jsonb; u jsonb; target public.mac_accounts; sid text; old_role text; new_role text; BEGIN
 SELECT * INTO actor FROM public.mac_accounts WHERE id=a;
 IF actor.id IS NULL OR actor.role NOT IN ('admin','gestor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 FOR st IN SELECT * FROM jsonb_array_elements(items) LOOP
 sid:=st->>'id'; IF sid IS NULL OR length(trim(st->>'name'))<2 THEN RAISE EXCEPTION 'Loja inválida'; END IF;
 IF EXISTS(SELECT 1 FROM public.mac_stores WHERE id=sid AND wallet_id<>actor.wallet_id) THEN RAISE EXCEPTION 'Outra carteira'; END IF;
 IF actor.role<>'admin' AND NOT EXISTS(SELECT 1 FROM public.mac_memberships WHERE user_id=a AND store_id=sid AND role='gestor') THEN RAISE EXCEPTION 'Sem acesso à loja'; END IF;
 INSERT INTO public.mac_stores(id,wallet_id,name,metadata) VALUES(sid,actor.wallet_id,st->>'name',st-'id'-'wallet_id'-'name'-'users') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,metadata=EXCLUDED.metadata;
 FOR u IN SELECT * FROM jsonb_array_elements(COALESCE(st->'users','[]'::jsonb)) LOOP
 SELECT * INTO target FROM public.mac_accounts WHERE id=(u->>'id')::uuid AND wallet_id=actor.wallet_id;
 IF target.id IS NULL THEN RAISE EXCEPTION 'Conta não reconhecida'; END IF;
 old_role:=target.role;new_role:=CASE WHEN old_role='admin' THEN 'admin' ELSE u->>'role' END;
 IF new_role NOT IN ('admin','gestor','colaborador') THEN RAISE EXCEPTION 'Função inválida'; END IF;
 IF actor.role<>'admin' AND (old_role<>'colaborador' AND target.id<>a OR new_role<>old_role) THEN
 IF NOT EXISTS(SELECT 1 FROM public.mac_memberships WHERE user_id=target.id AND store_id=sid AND role=old_role) THEN RAISE EXCEPTION 'Não podes atribuir este acesso'; END IF;
 CONTINUE; END IF;
 IF length(trim(u->>'name'))<2 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
 UPDATE public.mac_accounts SET name=u->>'name',role=new_role WHERE id=target.id;
 IF old_role<>new_role THEN UPDATE public.user_roles SET role=new_role WHERE user_id=target.id; END IF;
 INSERT INTO public.mac_memberships(user_id,store_id,role,metadata) VALUES(target.id,sid,new_role,u-'id'-'role'-'hash'-'salt'-'password'-'pbkdf2Iterations'-'isAreaMaster'-'adminRole') ON CONFLICT(user_id,store_id) DO UPDATE SET role=EXCLUDED.role,metadata=EXCLUDED.metadata;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.mac_memberships m WHERE m.user_id=a AND m.store_id=sid AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(st->'users') j WHERE j->>'id'=a::text)) THEN RAISE EXCEPTION 'Não podes remover o teu acesso'; END IF;
 IF EXISTS(SELECT 1 FROM public.mac_memberships m WHERE m.store_id=sid AND m.role='admin' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(st->'users') j WHERE j->>'id'=m.user_id::text)) THEN RAISE EXCEPTION 'Não podes remover administrador'; END IF;
 DELETE FROM public.mac_memberships m WHERE m.store_id=sid AND (actor.role='admin' OR m.role='colaborador') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(st->'users') j WHERE j->>'id'=m.user_id::text);
 END LOOP; END $$;
REVOKE ALL ON FUNCTION public.mac_save_registry(uuid,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.mac_save_registry(uuid,jsonb) TO service_role;
CREATE FUNCTION public.mac_delete_document(w uuid,k text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s text; BEGIN
 SELECT store_id INTO s FROM public.mac_documents WHERE wallet_id=w AND key=k;
 IF NOT public.mac_wallet_access(w) OR (s IS NULL AND NOT public.mac_wallet_admin(w)) OR (s IS NOT NULL AND NOT(public.mac_wallet_admin(w) OR EXISTS(SELECT 1 FROM public.mac_memberships WHERE user_id=auth.uid() AND store_id=s AND role='gestor'))) THEN RAISE EXCEPTION 'Sem permissão para eliminar'; END IF;
 IF k LIKE 'store:%' THEN RAISE EXCEPTION 'Elimina a loja através da gestão de lojas'; END IF;
 DELETE FROM public.mac_documents WHERE wallet_id=w AND key=k; END $$;
REVOKE ALL ON FUNCTION public.mac_delete_document(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.mac_delete_document(uuid,text) TO authenticated;
CREATE FUNCTION public.mac_set_preference(k text,v jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ UPDATE public.profiles SET preferences=CASE WHEN v IS NULL THEN preferences-k ELSE jsonb_set(preferences,ARRAY[k],v,true) END WHERE id=auth.uid() $$;
REVOKE ALL ON FUNCTION public.mac_set_preference(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.mac_set_preference(text,jsonb) TO authenticated;
CREATE FUNCTION public.mac_document_scope_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.key LIKE 'store:%' AND NEW.store_id IS DISTINCT FROM substring(NEW.key FROM 7) THEN RAISE EXCEPTION 'Âmbito inválido'; END IF;
 IF NEW.key LIKE 'status:%' AND NEW.store_id IS DISTINCT FROM substring(NEW.key FROM 8) THEN RAISE EXCEPTION 'Âmbito inválido'; END IF;
 IF NEW.store_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.mac_stores WHERE id=NEW.store_id AND wallet_id=NEW.wallet_id) THEN RAISE EXCEPTION 'Carteira inválida'; END IF;
 IF TG_OP='UPDATE' AND NEW.store_id IS DISTINCT FROM OLD.store_id THEN RAISE EXCEPTION 'Não podes alterar âmbito'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER mac_validate_document_scope BEFORE INSERT OR UPDATE ON public.mac_documents FOR EACH ROW EXECUTE FUNCTION public.mac_document_scope_guard();
CREATE FUNCTION public.mac_member_scope_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.mac_accounts a JOIN public.mac_stores s ON s.wallet_id=a.wallet_id WHERE a.id=NEW.user_id AND s.id=NEW.store_id AND a.role=NEW.role) THEN RAISE EXCEPTION 'Associação inválida'; END IF; RETURN NEW; END $$;
CREATE TRIGGER mac_validate_membership BEFORE INSERT OR UPDATE ON public.mac_memberships FOR EACH ROW EXECUTE FUNCTION public.mac_member_scope_guard();