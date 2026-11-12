ALTER TABLE public.mac_setup_grants ADD COLUMN preview_only boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.mac_complete_setup(t text, u uuid, wallet_name text, application_name text, ga_name text, ga_username text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE invitation public.mac_setup_grants; wid uuid;
BEGIN
 SELECT * INTO invitation FROM public.mac_setup_grants WHERE token_hash=t FOR UPDATE;
 IF invitation.id IS NULL OR invitation.expires_at<=now() OR invitation.consumed_by IS NOT NULL THEN RAISE EXCEPTION 'Autorização de configuração inválida ou já utilizada.'; END IF;
 IF invitation.preview_only THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('mac-preview-reset',0));
  IF EXISTS(SELECT 1 FROM public.mac_wallets w JOIN public.mac_accounts a ON a.id=w.owner_id AND a.wallet_id=w.id AND a.role='admin' JOIN public.user_roles r ON r.user_id=a.id AND r.role='admin') THEN RAISE EXCEPTION 'O Gestor de Área já foi criado.'; END IF;
 END IF;
 IF wallet_name !~ '^[A-Z0-9_-]{1,20}$' OR length(trim(application_name)) NOT BETWEEN 2 AND 70 OR length(trim(ga_name)) NOT BETWEEN 2 AND 90 THEN RAISE EXCEPTION 'Preenche os campos obrigatórios.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(wallet_name,0));
 IF EXISTS(SELECT 1 FROM public.mac_wallets WHERE upper(trim(name))=wallet_name) THEN RAISE EXCEPTION 'Esta carteira já existe. Escolhe outro nome; os dados anteriores foram preservados.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=u) OR EXISTS(SELECT 1 FROM public.mac_accounts WHERE id=u) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u) THEN RAISE EXCEPTION 'Conta inválida para configuração.'; END IF;
 INSERT INTO public.mac_wallets(name,app_name,owner_id) VALUES(wallet_name,application_name,u) RETURNING id INTO wid;
 INSERT INTO public.mac_accounts(id,wallet_id,name,username,role) VALUES(u,wid,ga_name,ga_username,'admin');
 INSERT INTO public.user_roles(user_id,role) VALUES(u,'admin');
 UPDATE public.mac_setup_grants SET consumed_by=u,consumed_at=now() WHERE id=invitation.id;
 RETURN wid;
END $$;
REVOKE ALL ON FUNCTION public.mac_complete_setup(text,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mac_complete_setup(text,uuid,text,text,text,text) TO service_role;