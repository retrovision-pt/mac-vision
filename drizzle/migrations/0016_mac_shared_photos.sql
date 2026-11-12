CREATE OR REPLACE FUNCTION public.mac_can_manage_photo(u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT u = auth.uid()
  OR EXISTS(SELECT 1 FROM public.mac_accounts a JOIN public.mac_accounts t ON t.wallet_id=a.wallet_id WHERE a.id=auth.uid() AND a.role='admin' AND t.id=u)
  OR EXISTS(SELECT 1 FROM public.mac_memberships g JOIN public.mac_memberships t ON t.store_id=g.store_id WHERE g.user_id=auth.uid() AND g.role='gestor' AND t.user_id=u)
$$;

CREATE OR REPLACE FUNCTION public.mac_can_view_photo(u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT EXISTS(SELECT 1 FROM public.mac_accounts a JOIN public.mac_accounts t ON t.wallet_id=a.wallet_id WHERE a.id=auth.uid() AND t.id=u)
$$;

CREATE OR REPLACE FUNCTION public.mac_wallet_photos()
RETURNS TABLE(user_id uuid, path text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT p.id, p.avatar_url FROM public.profiles p
 JOIN public.mac_accounts t ON t.id=p.id
 JOIN public.mac_accounts a ON a.wallet_id=t.wallet_id AND a.id=auth.uid()
 WHERE p.avatar_url IS NOT NULL AND p.avatar_url <> ''
$$;

CREATE OR REPLACE FUNCTION public.mac_set_photo(u uuid, p text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF NOT public.mac_can_manage_photo(u) THEN RAISE EXCEPTION 'Sem permissão para alterar esta fotografia'; END IF;
 IF p IS NOT NULL AND p <> '' AND p NOT LIKE u::text || '/%' THEN RAISE EXCEPTION 'Fotografia inválida'; END IF;
 UPDATE public.profiles SET avatar_url = NULLIF(p,'') WHERE id = u;
END $$;

REVOKE EXECUTE ON FUNCTION public.mac_set_photo(uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mac_wallet_photos() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mac_set_photo(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mac_wallet_photos() TO authenticated;

CREATE POLICY mac_photos_read ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='mac-photos' AND public.mac_can_view_photo(((storage.foldername(name))[1])::uuid));
CREATE POLICY mac_photos_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='mac-photos' AND public.mac_can_manage_photo(((storage.foldername(name))[1])::uuid));