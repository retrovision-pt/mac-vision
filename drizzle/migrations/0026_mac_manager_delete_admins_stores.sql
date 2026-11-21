CREATE OR REPLACE FUNCTION public.mac_remove_access(a uuid, u uuid, s text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE actor public.mac_accounts; target public.mac_accounts; owner uuid;
BEGIN
 SELECT * INTO actor FROM public.mac_accounts WHERE id=a;
 SELECT * INTO target FROM public.mac_accounts WHERE id=u FOR UPDATE;
 IF actor.role IS DISTINCT FROM 'admin' OR target.id IS NULL OR actor.wallet_id<>target.wallet_id OR a=u THEN RAISE EXCEPTION 'Só um administrador pode remover este acesso'; END IF;
 SELECT owner_id INTO owner FROM public.mac_wallets WHERE id=actor.wallet_id;
 IF target.role='admin' AND (target.id=owner OR (actor.admin_type<>'mac' AND actor.id<>owner)) THEN RAISE EXCEPTION 'Só o Gestor MAC Vision pode remover administradores; o dono da carteira não pode ser removido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mac_stores WHERE id=s AND wallet_id=actor.wallet_id) THEN RAISE EXCEPTION 'Loja inválida'; END IF;
 DELETE FROM public.mac_permissions WHERE user_id=u AND store_id=s;
 DELETE FROM public.mac_memberships WHERE user_id=u AND store_id=s;
 INSERT INTO public.mac_account_events(actor_id,user_id,event,details) VALUES(a,u,'access_removed',jsonb_build_object('store_id',s));
END $function$;

CREATE OR REPLACE FUNCTION public.mac_delete_store(a uuid, s text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE actor public.mac_accounts;
BEGIN
 SELECT * INTO actor FROM public.mac_accounts WHERE id=a;
 IF actor.role IS DISTINCT FROM 'admin' OR NOT EXISTS(SELECT 1 FROM public.mac_stores WHERE id=s AND wallet_id=actor.wallet_id) THEN RAISE EXCEPTION 'Só um administrador pode apagar esta loja'; END IF;
 IF (SELECT count(*) FROM public.mac_stores WHERE wallet_id=actor.wallet_id)<=1 THEN RAISE EXCEPTION 'É necessário manter pelo menos uma loja.'; END IF;
 DELETE FROM public.mac_reads WHERE message_id IN (SELECT id FROM public.mac_messages WHERE store_id=s);
 DELETE FROM public.mac_messages WHERE store_id=s;
 DELETE FROM public.mac_chat_settings WHERE store_id=s;
 DELETE FROM public.mac_permissions WHERE store_id=s;
 DELETE FROM public.mac_memberships WHERE store_id=s;
 DELETE FROM public.mac_sales WHERE store_id=s;
 DELETE FROM public.mac_import_files WHERE store_id=s;
 DELETE FROM public.mac_documents WHERE store_id=s;
 DELETE FROM public.mac_stores WHERE id=s;
 INSERT INTO public.mac_account_events(actor_id,user_id,event,details) VALUES(a,a,'store_deleted',jsonb_build_object('store_id',s));
END $function$;
REVOKE ALL ON FUNCTION public.mac_delete_store(uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mac_delete_store(uuid,text) TO service_role;