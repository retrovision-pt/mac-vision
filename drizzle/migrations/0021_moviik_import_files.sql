CREATE TABLE public.mac_import_files(
 id uuid PRIMARY KEY,
 wallet_id uuid NOT NULL REFERENCES public.mac_wallets(id),
 store_id text NOT NULL REFERENCES public.mac_stores(id),
 store_name text NOT NULL DEFAULT '',
 file_name text NOT NULL,
 path text,
 mime text NOT NULL DEFAULT '',
 size bigint NOT NULL DEFAULT 0,
 ticket_count integer NOT NULL DEFAULT 0,
 imported_by uuid NOT NULL,
 imported_by_name text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending_file',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mac_import_files TO authenticated;
GRANT ALL ON public.mac_import_files TO service_role;
ALTER TABLE public.mac_import_files ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mac_import_reader(s text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT public.mac_store_access(s) AND EXISTS(SELECT 1 FROM public.mac_accounts a WHERE a.id=auth.uid() AND (a.role IN ('admin','gestor') OR public.mac_can('imports.moviik',s) OR public.mac_can('imports.view',s)))
$$;
CREATE OR REPLACE FUNCTION public.mac_import_writer(s text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT public.mac_store_access(s) AND EXISTS(SELECT 1 FROM public.mac_accounts a WHERE a.id=auth.uid() AND (a.role IN ('admin','gestor') OR public.mac_can('imports.moviik',s)))
$$;

CREATE POLICY import_files_read ON public.mac_import_files FOR SELECT TO authenticated USING (public.mac_import_reader(store_id));

CREATE OR REPLACE FUNCTION public.mac_record_import(i uuid, s text, n text, p text, m text, sz bigint, c integer, st text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE acc public.mac_accounts; shop public.mac_stores; old public.mac_import_files;
BEGIN
 IF NOT public.mac_import_writer(s) THEN RAISE EXCEPTION 'Sem permissão delegada para importar senhas MOVIIK nesta loja'; END IF;
 IF st NOT IN ('pending_file','stored') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
 IF length(trim(coalesce(n,'')))=0 THEN RAISE EXCEPTION 'Nome do ficheiro em falta'; END IF;
 IF p IS NOT NULL AND p NOT LIKE s||'/'||i::text||'/%' THEN RAISE EXCEPTION 'Caminho do ficheiro inválido'; END IF;
 IF st='stored' AND (p IS NULL OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='mac-imports' AND o.name=p)) THEN RAISE EXCEPTION 'O ficheiro original não está no armazenamento Cloud'; END IF;
 SELECT * INTO acc FROM public.mac_accounts WHERE id=auth.uid();
 SELECT * INTO shop FROM public.mac_stores WHERE id=s AND wallet_id=acc.wallet_id;
 IF shop.id IS NULL THEN RAISE EXCEPTION 'Loja inválida'; END IF;
 SELECT * INTO old FROM public.mac_import_files WHERE id=i FOR UPDATE;
 IF old.id IS NOT NULL AND old.store_id<>s THEN RAISE EXCEPTION 'Importação de outra loja'; END IF;
 IF old.id IS NULL THEN
  INSERT INTO public.mac_import_files(id,wallet_id,store_id,store_name,file_name,path,mime,size,ticket_count,imported_by,imported_by_name,status)
  VALUES(i,acc.wallet_id,s,shop.name,left(n,200),p,left(coalesce(m,''),120),coalesce(sz,0),greatest(coalesce(c,0),0),acc.id,acc.name,st);
 ELSE
  -- Recuperação: só o ficheiro; o autor e a contagem originais mantêm-se.
  UPDATE public.mac_import_files SET path=coalesce(p,path),mime=coalesce(nullif(m,''),mime),size=CASE WHEN p IS NULL THEN size ELSE coalesce(sz,size) END,status=st,updated_at=now() WHERE id=i;
 END IF;
 INSERT INTO public.mac_account_events(actor_id,user_id,event,details) VALUES(acc.id,acc.id,'moviik.file',jsonb_build_object('import',i,'store',s,'file',n,'status',st));
END $$;
REVOKE ALL ON FUNCTION public.mac_record_import(uuid,text,text,text,text,bigint,integer,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mac_record_import(uuid,text,text,text,text,bigint,integer,text) TO authenticated;

CREATE POLICY mac_imports_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='mac-imports' AND public.mac_import_reader(split_part(name,'/',1)));
CREATE POLICY mac_imports_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='mac-imports' AND public.mac_import_writer(split_part(name,'/',1)));