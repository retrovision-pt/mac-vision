ALTER TABLE public.mac_accounts ADD COLUMN admin_type text NOT NULL DEFAULT 'area';
CREATE FUNCTION public.mac_admin_type_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.admin_type NOT IN ('area','beta','mac') THEN RAISE EXCEPTION 'Cargo administrativo inválido'; END IF; RETURN NEW; END $$;
CREATE TRIGGER mac_validate_admin_type BEFORE INSERT OR UPDATE ON public.mac_accounts FOR EACH ROW EXECUTE FUNCTION public.mac_admin_type_guard();
CREATE FUNCTION public.mac_set_admin_type(a uuid,u uuid,t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF t NOT IN ('area','beta','mac') OR NOT EXISTS(SELECT 1 FROM public.mac_accounts actor JOIN public.mac_accounts target ON actor.wallet_id=target.wallet_id WHERE actor.id=a AND actor.role='admin' AND target.id=u AND target.role='admin') THEN RAISE EXCEPTION 'Sem permissão para atribuir este cargo'; END IF;
 UPDATE public.mac_accounts SET admin_type=t WHERE id=u AND admin_type IS DISTINCT FROM t;
END $$;
REVOKE ALL ON FUNCTION public.mac_set_admin_type(uuid,uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.mac_set_admin_type(uuid,uuid,text) TO service_role;