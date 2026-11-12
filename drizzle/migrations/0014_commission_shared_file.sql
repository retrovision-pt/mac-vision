-- Ponderação e Comissionamento: um único ficheiro partilhado por várias lojas, guardado na Cloud.
-- 1) Metadados leves do ficheiro (lista, versões, lojas associadas) legíveis por qualquer membro da carteira.
CREATE POLICY documents_commission_read ON public.mac_documents
FOR SELECT TO authenticated
USING (store_id IS NULL AND key LIKE 'commission:%' AND public.mac_wallet_access(wallet_id));

-- 2) Gravação atómica do ficheiro partilhado: metadados + catálogo na mesma transação,
--    com validação de permissões, rejeição de versões antigas e controlo de alterações simultâneas.
CREATE OR REPLACE FUNCTION public.mac_put_commission(w uuid, meta jsonb, data jsonb, r integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  files_key  text := 'commission:files';
  data_key   text := 'commission:data:' || (meta->>'id');
  actor_role text;
  cur_rev    integer := 0;
  cur_value  jsonb := '{"files":[]}'::jsonb;
  cur_files  jsonb;
  new_files  jsonb;
  next_rev   integer;
  old_data   jsonb;
BEGIN
  SELECT role INTO actor_role FROM public.mac_accounts WHERE id = auth.uid() AND wallet_id = w;
  IF actor_role IS NULL OR actor_role = 'colaborador' THEN
    RAISE EXCEPTION 'Sem permissão para alterar o ficheiro de comissionamento';
  END IF;
  IF meta->>'id' IS NULL OR meta->>'id' = '' THEN RAISE EXCEPTION 'Identificador do ficheiro em falta'; END IF;
  IF jsonb_typeof(meta->'storeIds') <> 'array' OR jsonb_array_length(meta->'storeIds') = 0 THEN
    RAISE EXCEPTION 'Escolhe pelo menos uma loja';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(meta->'storeIds') AS t(sid)
            WHERE NOT EXISTS(SELECT 1 FROM public.mac_stores s WHERE s.id = t.sid AND s.wallet_id = w)
               OR (actor_role <> 'admin' AND NOT public.mac_store_access(t.sid))) THEN
    RAISE EXCEPTION 'Sem autorização para associar uma das lojas selecionadas';
  END IF;

  SELECT revision, value INTO cur_rev, cur_value FROM public.mac_documents WHERE wallet_id = w AND key = files_key;
  IF cur_rev IS NULL THEN
    cur_rev := 0;
    cur_value := '{"files":[]}'::jsonb;
  END IF;
  IF r IS DISTINCT FROM cur_rev THEN RAISE EXCEPTION 'CONFLICT'; END IF;

  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(cur_value->'files','[]'::jsonb)) fe
            WHERE fe->>'id' = meta->>'id'
              AND COALESCE((fe->>'version')::integer, 0) >= COALESCE((meta->>'version')::integer, 0)) THEN
    RAISE EXCEPTION 'CONFLICT';
  END IF;

  cur_files := COALESCE(cur_value->'files','[]'::jsonb);
  SELECT COALESCE(jsonb_agg(fe), '[]'::jsonb) INTO new_files
    FROM (SELECT jsonb_array_elements(cur_files) AS fe) s
   WHERE s.fe->>'id' <> meta->>'id';
  new_files := new_files || jsonb_build_array(meta);

  INSERT INTO public.mac_documents(wallet_id,key,store_id,value,revision)
    VALUES (w, files_key, NULL, jsonb_set(cur_value,'{files}',new_files,true), 1)
  ON CONFLICT (wallet_id,key) DO UPDATE
    SET value = jsonb_set(COALESCE(mac_documents.value,'{"files":[]}'::jsonb),'{files}',new_files,true),
        revision = mac_documents.revision + 1,
        updated_at = now()
  WHERE mac_documents.revision = cur_rev
  RETURNING revision INTO next_rev;
  IF next_rev IS NULL THEN RAISE EXCEPTION 'CONFLICT'; END IF;

  SELECT value INTO old_data FROM public.mac_documents WHERE wallet_id = w AND key = data_key;
  INSERT INTO public.mac_documents(wallet_id,key,store_id,value,revision)
    VALUES (w, data_key, NULL, jsonb_build_object(
        'id', meta->>'id',
        'version', COALESCE(meta->'version','1'::jsonb),
        'catalog', data,
        'previous', COALESCE(old_data->'catalog','null'::jsonb),
        'updatedAt', meta->'updatedAt',
        'updatedBy', meta->'updatedBy'
      ), 1)
  ON CONFLICT (wallet_id,key) DO UPDATE
    SET value = EXCLUDED.value, revision = mac_documents.revision + 1, updated_at = now();

  RETURN next_rev;
END
$function$;

-- 3) Leitura do catálogo com as permissões validadas no servidor: administrador da carteira,
--    utilizadores explicitamente partilhados, ou quem tiver acesso a uma das lojas associadas.
CREATE OR REPLACE FUNCTION public.mac_get_commission(w uuid, f text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT d.value
  FROM public.mac_documents d
  WHERE d.wallet_id = w
    AND d.key = 'commission:data:' || f
    AND EXISTS(
      SELECT 1
      FROM jsonb_array_elements(COALESCE((SELECT value->'files' FROM public.mac_documents WHERE wallet_id = w AND key = 'commission:files'),'[]'::jsonb)) fe
      WHERE fe->>'id' = f
        AND (
          public.mac_wallet_admin(w)
          OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(fe->'sharedWith','[]'::jsonb)) s WHERE s = auth.uid()::text)
          OR (COALESCE(jsonb_array_length(COALESCE(fe->'sharedWith','[]'::jsonb)),0) = 0
              AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(fe->'storeIds','[]'::jsonb)) st WHERE public.mac_store_access(st)))
        )
    );
$function$;

GRANT EXECUTE ON FUNCTION public.mac_put_commission(uuid,jsonb,jsonb,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mac_get_commission(uuid,text) TO authenticated;