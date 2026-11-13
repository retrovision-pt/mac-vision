CREATE OR REPLACE FUNCTION public.mac_shift_write_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ok boolean;
BEGIN
  IF uid IS NULL OR NOT EXISTS (SELECT 1 FROM mac_accounts WHERE id = uid AND role = 'colaborador') THEN RETURN NEW; END IF;
  -- The schedule controls the access period; store permissions are enforced by the write functions.
  -- A collaborator on shift in any of their stores may perform delegated work in another authorised store.
  SELECT bool_or(coalesce((public.mac_shift_status(uid, m.store_id)->>'allowed')::boolean, false)) INTO ok
    FROM mac_memberships m WHERE m.user_id = uid;
  IF NOT coalesce(ok, false) THEN RAISE EXCEPTION 'MAC_SHIFT_CLOSED'; END IF;
  RETURN NEW;
END $$;