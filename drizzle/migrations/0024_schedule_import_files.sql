ALTER TABLE public.mac_import_files ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'moviik';
ALTER TABLE public.mac_import_files ADD COLUMN IF NOT EXISTS period text;

CREATE OR REPLACE FUNCTION public.mac_import_reader(s text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT public.mac_store_access(s) AND EXISTS(SELECT 1 FROM public.mac_accounts a WHERE a.id=auth.uid() AND (a.role IN ('admin','gestor') OR public.mac_can('imports.moviik',s) OR public.mac_can('imports.view',s) OR public.mac_can('schedule.edit',s)))
$$;
CREATE OR REPLACE FUNCTION public.mac_import_writer(s text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT public.mac_store_access(s) AND EXISTS(SELECT 1 FROM public.mac_accounts a WHERE a.id=auth.uid() AND (a.role IN ('admin','gestor') OR public.mac_can('imports.moviik',s) OR public.mac_can('schedule.edit',s)))
$$;

CREATE OR REPLACE FUNCTION public.mac_record_schedule_file(i uuid, s text, n text, p text, m text, sz bigint, c integer, st text, mo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE acc public.mac_accounts; shop public.mac_stores; old public.mac_import_files;
BEGIN
 SELECT * INTO acc FROM public.mac_accounts WHERE id=auth.uid();
 IF acc.id IS NULL OR NOT public.mac_store_access(s) OR NOT (acc.role IN ('admin','gestor') OR public.mac_can('schedule.edit',s)) THEN RAISE EXCEPTION 'Sem permissão para importar escalas nesta loja'; END IF;
 IF st NOT IN ('pending_file','stored') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
 IF length(trim(coalesce(n,'')))=0 THEN RAISE EXCEPTION 'Nome do ficheiro em falta'; END IF;
 IF mo IS NOT NULL AND mo !~ '^\d{4}-\d{2}$' THEN RAISE EXCEPTION 'Mês inválido'; END IF;
 IF p IS NOT NULL AND p NOT LIKE s||'/'||i::text||'/%' THEN RAISE EXCEPTION 'Caminho do ficheiro inválido'; END IF;
 IF st='stored' AND (p IS NULL OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='mac-imports' AND o.name=p)) THEN RAISE EXCEPTION 'O ficheiro original não está no armazenamento Cloud'; END IF;
 SELECT * INTO shop FROM public.mac_stores WHERE id=s AND wallet_id=acc.wallet_id;
 IF shop.id IS NULL THEN RAISE EXCEPTION 'Loja inválida'; END IF;
 SELECT * INTO old FROM public.mac_import_files WHERE id=i FOR UPDATE;
 IF old.id IS NOT NULL AND (old.store_id<>s OR old.kind<>'schedule') THEN RAISE EXCEPTION 'Importação de outra loja'; END IF;
 IF old.id IS NULL THEN
  INSERT INTO public.mac_import_files(id,wallet_id,store_id,store_name,file_name,path,mime,size,ticket_count,imported_by,imported_by_name,status,kind,period)
  VALUES(i,acc.wallet_id,s,shop.name,left(n,200),p,left(coalesce(m,''),120),coalesce(sz,0),greatest(coalesce(c,0),0),acc.id,acc.name,st,'schedule',mo);
 ELSE
  UPDATE public.mac_import_files SET path=coalesce(p,path),mime=coalesce(nullif(m,''),mime),size=CASE WHEN p IS NULL THEN size ELSE coalesce(sz,size) END,status=st,updated_at=now() WHERE id=i;
 END IF;
 INSERT INTO public.mac_account_events(actor_id,user_id,event,details) VALUES(acc.id,acc.id,'schedule.file',jsonb_build_object('import',i,'store',s,'file',n,'month',mo,'status',st));
END $$;
REVOKE ALL ON FUNCTION public.mac_record_schedule_file(uuid,text,text,text,text,bigint,integer,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mac_record_schedule_file(uuid,text,text,text,text,bigint,integer,text,text) TO authenticated;