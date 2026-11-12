CREATE OR REPLACE FUNCTION public.mac_moderate_message(m uuid, b text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE msg public.mac_messages%ROWTYPE;
BEGIN
  SELECT * INTO msg FROM public.mac_messages WHERE id = m AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mensagem não encontrada.'; END IF;
  IF NOT (msg.sender_id = auth.uid() OR (public.mac_wallet_admin(msg.wallet_id) AND public.mac_store_access(msg.store_id))) THEN
    RAISE EXCEPTION 'Sem permissão para gerir esta mensagem.';
  END IF;
  IF b IS NULL THEN
    UPDATE public.mac_messages SET deleted_at = now() WHERE id = m;
  ELSE
    IF length(trim(b)) = 0 THEN RAISE EXCEPTION 'A mensagem não pode ficar vazia.'; END IF;
    UPDATE public.mac_messages SET body = left(trim(b),1000), edited_at = now() WHERE id = m;
  END IF;
  INSERT INTO public.mac_account_events(actor_id,user_id,event,details)
  VALUES (auth.uid(), msg.sender_id, CASE WHEN b IS NULL THEN 'chat_message_deleted' ELSE 'chat_message_edited' END,
          jsonb_build_object('message_id', m, 'store_id', msg.store_id, 'previous_body', msg.body));
END $$;
REVOKE ALL ON FUNCTION public.mac_moderate_message(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mac_moderate_message(uuid,text) TO authenticated;