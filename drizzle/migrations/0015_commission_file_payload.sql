-- O ficheiro de comissionamento passa a transportar o catálogo e o original na mesma gravação atómica,
-- mantém uma versão anterior consultável e admite alterações só de associação sem nova versão de conteúdo.
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
  old_rev    integer := 0;
  old_entry  jsonb;
  new_rev    integer := COALESCE((meta->>'version')::integer, 0);
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

  SELECT fe INTO old_entry FROM jsonb_array_elements(COALESCE(cur_value->'files','[]'::jsonb)) fe WHERE fe->>'id' = meta->>'id';
  old_rev := COALESCE((old_entry->>'version')::integer, 0);

  -- uma gravação mais antiga nunca substitui uma mais recente;
  -- a mesma versão só é aceite se o conteúdo for exatamente o mesmo (apenas associações mudaram)
  IF old_rev > new_rev THEN RAISE EXCEPTION 'CONFLICT'; END IF;
  IF old_rev = new_rev AND old_entry IS NOT NULL
     AND COALESCE(old_entry->>'checksum','') <> COALESCE(meta->>'checksum','') THEN RAISE EXCEPTION 'CONFLICT'; END IF;

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

  IF new_rev > old_rev THEN
    SELECT value INTO old_data FROM public.mac_documents WHERE wallet_id = w AND key = data_key;
    INSERT INTO public.mac_documents(wallet_id,key,store_id,value,revision)
      VALUES (w, data_key, NULL, jsonb_build_object(
          'id', meta->>'id',
          'version', new_rev,
          'catalog', COALESCE(data->'catalog','{"products":[],"mobiles":[]}'::jsonb),
          'source', data->'source',
          'previous', CASE WHEN old_data IS NULL THEN 'null'::jsonb
                           ELSE jsonb_build_object('catalog', old_data->'catalog', 'source', old_data->'source') END,
          'updatedAt', meta->'updatedAt',
          'updatedBy', meta->'updatedBy'
        ), 1)
    ON CONFLICT (wallet_id,key) DO UPDATE
      SET value = EXCLUDED.value, revision = mac_documents.revision + 1, updated_at = now();
  END IF;

  RETURN next_rev;
END
$function$;

GRANT EXECUTE ON FUNCTION public.mac_put_commission(uuid,jsonb,jsonb,integer) TO authenticated;