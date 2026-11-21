CREATE OR REPLACE FUNCTION public.mac_can_manage_perms(s text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.mac_stores st JOIN public.mac_accounts a ON a.wallet_id=st.wallet_id WHERE st.id=s AND st.archived_at IS NULL AND a.id=auth.uid() AND a.role='admin' AND NOT a.disabled) OR EXISTS(SELECT 1 FROM public.mac_memberships m JOIN public.mac_accounts a ON a.id=m.user_id JOIN public.mac_stores st ON st.id=m.store_id WHERE m.user_id=auth.uid() AND m.store_id=s AND m.role='gestor' AND a.role='gestor' AND NOT a.disabled AND st.archived_at IS NULL) $$;
CREATE OR REPLACE FUNCTION public.mac_set_admin_type(a uuid,u uuid,t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor public.mac_accounts; target public.mac_accounts;
BEGIN
 SELECT * INTO actor FROM public.mac_accounts WHERE id=a AND NOT disabled;
 SELECT * INTO target FROM public.mac_accounts WHERE id=u AND NOT disabled FOR UPDATE;
 IF t NOT IN ('area','beta','mac') OR actor.role IS DISTINCT FROM 'admin' OR target.role IS DISTINCT FROM 'admin' OR actor.wallet_id IS DISTINCT FROM target.wallet_id THEN RAISE EXCEPTION 'Sem permissão para atribuir este cargo'; END IF;
 PERFORM 1 FROM public.mac_wallets WHERE id=actor.wallet_id FOR UPDATE;
 IF target.admin_type='mac' AND t<>'mac' AND (SELECT count(*) FROM public.mac_accounts WHERE wallet_id=actor.wallet_id AND role='admin' AND admin_type='mac' AND NOT disabled)<=1 THEN RAISE EXCEPTION 'É necessário manter o último administrador global.'; END IF;
 UPDATE public.mac_accounts SET admin_type=t WHERE id=u AND admin_type IS DISTINCT FROM t;
END $$;
CREATE TRIGGER mac_active_message_guard BEFORE INSERT OR UPDATE ON public.mac_messages FOR EACH ROW EXECUTE FUNCTION public.mac_active_write_guard();
REVOKE ALL ON FUNCTION public.mac_set_admin_type(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mac_set_admin_type(uuid,uuid,text) TO service_role;