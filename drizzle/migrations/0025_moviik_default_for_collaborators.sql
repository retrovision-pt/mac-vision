CREATE OR REPLACE FUNCTION public.mac_can(p text, s text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
 SELECT public.mac_can_manage_perms(s) OR EXISTS(
  SELECT 1 FROM public.mac_memberships m JOIN public.mac_accounts a ON a.id=m.user_id JOIN public.mac_stores st ON st.id=m.store_id AND st.wallet_id=a.wallet_id
  WHERE m.user_id=auth.uid() AND m.store_id=s AND a.role='colaborador' AND (
   EXISTS(SELECT 1 FROM public.mac_permissions x WHERE x.user_id=m.user_id AND x.store_id=m.store_id AND x.perm IN (p,'all'))
   OR (p='imports.moviik' AND NOT EXISTS(SELECT 1 FROM public.mac_permissions x WHERE x.user_id=m.user_id AND x.store_id=m.store_id AND x.perm='deny:imports.moviik'))))
$function$;

CREATE OR REPLACE FUNCTION public.mac_moviik_importer(w uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.mac_accounts a WHERE a.id=auth.uid() AND a.wallet_id=w AND (
  a.role IN ('admin','gestor') OR EXISTS(SELECT 1 FROM public.mac_stores s
   WHERE s.wallet_id=w AND public.mac_store_access(s.id) AND public.mac_can('imports.moviik',s.id))))
$function$;

CREATE OR REPLACE FUNCTION public.mac_set_permissions(u uuid, stores text[], perms text[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sid text; target public.mac_accounts; before text[]; after text[];
BEGIN
 IF u=auth.uid() THEN RAISE EXCEPTION 'Não podes alterar as tuas próprias permissões'; END IF;
 SELECT * INTO target FROM public.mac_accounts WHERE id=u;
 IF target.id IS NULL OR target.role<>'colaborador' THEN RAISE EXCEPTION 'Só é possível delegar permissões a colaboradores'; END IF;
 IF COALESCE(array_length(stores,1),0)=0 THEN RAISE EXCEPTION 'Escolhe pelo menos uma loja'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(COALESCE(perms,ARRAY[]::text[])) x WHERE x NOT IN ('all','dashboard.view','history.view','tickets.view','ios.view','imports.view','imports.moviik','deny:imports.moviik','sales.edit','sales.delete','schedule.edit','employees.manage','weights.manage','data.export')) THEN RAISE EXCEPTION 'Permissão inválida'; END IF;
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
END $function$;