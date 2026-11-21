CREATE OR REPLACE FUNCTION public.mac_active_write_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid text;
BEGIN
 IF auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.mac_accounts WHERE id=auth.uid() AND disabled) THEN RAISE EXCEPTION 'Conta desativada'; END IF;
 IF TG_OP='DELETE' THEN sid:=OLD.store_id; ELSE sid:=NEW.store_id; END IF;
 IF sid IS NOT NULL AND EXISTS(SELECT 1 FROM public.mac_stores WHERE id=sid AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Loja arquivada; histórico protegido contra alterações.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mac_archived_sales_delete_guard BEFORE DELETE ON public.mac_sales FOR EACH ROW EXECUTE FUNCTION public.mac_active_write_guard();
CREATE TRIGGER mac_archived_documents_delete_guard BEFORE DELETE ON public.mac_documents FOR EACH ROW EXECUTE FUNCTION public.mac_active_write_guard();
CREATE TRIGGER mac_archived_messages_delete_guard BEFORE DELETE ON public.mac_messages FOR EACH ROW EXECUTE FUNCTION public.mac_active_write_guard();