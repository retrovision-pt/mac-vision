CREATE TABLE public.mac_sales(
 store_id text NOT NULL REFERENCES public.mac_stores(id) ON DELETE CASCADE,
 id text NOT NULL,
 wallet_id uuid NOT NULL REFERENCES public.mac_wallets(id) ON DELETE CASCADE,
 employee text NOT NULL DEFAULT '',
 data jsonb NOT NULL,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 PRIMARY KEY(store_id,id)
);
GRANT SELECT ON public.mac_sales TO authenticated;
GRANT ALL ON public.mac_sales TO service_role;
ALTER TABLE public.mac_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_read ON public.mac_sales FOR SELECT TO authenticated USING (public.mac_store_access(store_id) AND public.mac_wallet_access(wallet_id));
ALTER TABLE public.mac_sales REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mac_sales;

-- Idempotent: an id that already exists with identical data is a no-op, so retries never duplicate.
CREATE OR REPLACE FUNCTION public.mac_put_sales(w uuid, s text, upserts jsonb, deletes text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE actor_role text; actor_name text; item jsonb; old public.mac_sales; n integer:=0; did text;
BEGIN
 SELECT role,name INTO actor_role,actor_name FROM public.mac_accounts WHERE id=auth.uid() AND wallet_id=w;
 IF actor_role IS NULL THEN RAISE EXCEPTION 'Sem acesso à carteira'; END IF;
 IF NOT public.mac_store_access(s) OR NOT EXISTS(SELECT 1 FROM public.mac_stores WHERE id=s AND wallet_id=w) THEN RAISE EXCEPTION 'Sem acesso à loja'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(upserts,'[]'::jsonb)) LOOP
  IF COALESCE(item->>'id','')='' THEN RAISE EXCEPTION 'Venda sem identificador'; END IF;
  SELECT * INTO old FROM public.mac_sales WHERE store_id=s AND id=item->>'id' FOR UPDATE;
  IF FOUND THEN
   IF old.data=item AND old.deleted_at IS NULL THEN CONTINUE; END IF;
   IF actor_role='colaborador' AND lower(old.employee)<>lower(actor_name) AND old.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Só podes alterar as tuas vendas'; END IF;
   UPDATE public.mac_sales SET data=item, employee=COALESCE(item->>'employee',''), deleted_at=NULL, updated_at=now() WHERE store_id=s AND id=item->>'id';
  ELSE
   INSERT INTO public.mac_sales(store_id,id,wallet_id,employee,data,created_by) VALUES(s,item->>'id',w,COALESCE(item->>'employee',''),item,auth.uid());
  END IF;
  n:=n+1;
 END LOOP;
 FOREACH did IN ARRAY COALESCE(deletes,ARRAY[]::text[]) LOOP
  SELECT * INTO old FROM public.mac_sales WHERE store_id=s AND id=did FOR UPDATE;
  IF NOT FOUND OR old.deleted_at IS NOT NULL THEN CONTINUE; END IF;
  IF actor_role='colaborador' AND lower(old.employee)<>lower(actor_name) AND old.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Só podes eliminar as tuas vendas'; END IF;
  UPDATE public.mac_sales SET deleted_at=now(), updated_at=now() WHERE store_id=s AND id=did;
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.mac_put_sales(uuid,text,jsonb,text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mac_put_sales(uuid,text,jsonb,text[]) TO authenticated;

-- Move existing sales out of the store documents (nothing is lost).
INSERT INTO public.mac_sales(store_id,id,wallet_id,employee,data)
SELECT d.store_id, e->>'id', d.wallet_id, COALESCE(e->>'employee',''), e
FROM public.mac_documents d, jsonb_array_elements(COALESCE(d.value->'sales','[]'::jsonb)) e
WHERE d.key LIKE 'store:%' AND d.store_id IS NOT NULL AND COALESCE(e->>'id','')<>''
ON CONFLICT DO NOTHING;
UPDATE public.mac_documents SET value=value-'sales', revision=revision+1, updated_at=now() WHERE key LIKE 'store:%' AND value ? 'sales';