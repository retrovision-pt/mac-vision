REVOKE ALL ON FUNCTION public.mac_create_profile() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mac_wallet_access(uuid),public.mac_wallet_admin(uuid),public.mac_store_access(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mac_wallet_access(uuid),public.mac_wallet_admin(uuid),public.mac_store_access(text) TO authenticated;
CREATE TABLE public.mac_chat_settings(store_id text PRIMARY KEY REFERENCES public.mac_stores(id), enabled boolean NOT NULL DEFAULT true);
GRANT SELECT,INSERT,UPDATE ON public.mac_chat_settings TO authenticated; GRANT ALL ON public.mac_chat_settings TO service_role; ALTER TABLE public.mac_chat_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_read ON public.mac_chat_settings FOR SELECT TO authenticated USING(public.mac_store_access(store_id));
CREATE POLICY settings_write ON public.mac_chat_settings FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM public.mac_memberships m WHERE m.store_id=mac_chat_settings.store_id AND m.user_id=auth.uid() AND m.role IN ('admin','gestor'))) WITH CHECK(EXISTS(SELECT 1 FROM public.mac_memberships m WHERE m.store_id=mac_chat_settings.store_id AND m.user_id=auth.uid() AND m.role IN ('admin','gestor')));
CREATE TABLE public.mac_presence(user_id uuid PRIMARY KEY, wallet_id uuid NOT NULL REFERENCES public.mac_wallets(id), last_seen timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.mac_presence TO authenticated; GRANT ALL ON public.mac_presence TO service_role; ALTER TABLE public.mac_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY presence_read ON public.mac_presence FOR SELECT TO authenticated USING(public.mac_wallet_access(wallet_id)); CREATE POLICY presence_write ON public.mac_presence FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND public.mac_wallet_access(wallet_id));
ALTER PUBLICATION supabase_realtime ADD TABLE public.mac_presence,public.mac_chat_settings;
CREATE FUNCTION public.mac_message_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP='UPDATE' AND (NEW.sender_id<>OLD.sender_id OR NEW.wallet_id<>OLD.wallet_id OR NEW.store_id<>OLD.store_id OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id) THEN RAISE EXCEPTION 'Não podes alterar participantes da mensagem'; END IF;
 IF char_length(NEW.body)>1000 OR char_length(trim(NEW.body))=0 THEN RAISE EXCEPTION 'Mensagem inválida'; END IF;
 IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM public.mac_chat_settings WHERE store_id=NEW.store_id AND enabled=false) AND NOT EXISTS(SELECT 1 FROM public.mac_memberships WHERE user_id=auth.uid() AND store_id=NEW.store_id AND role IN ('admin','gestor')) THEN RAISE EXCEPTION 'Chat desativado para colaboradores'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER mac_validate_message BEFORE INSERT OR UPDATE ON public.mac_messages FOR EACH ROW EXECUTE FUNCTION public.mac_message_guard();