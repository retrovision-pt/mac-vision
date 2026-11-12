DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.mac_save_registry(uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'IF old_role<>new_role THEN UPDATE public.mac_memberships SET role=new_role WHERE user_id=target.id; END IF;','');
 definition:=replace(definition,'IF old_role<>new_role THEN UPDATE public.user_roles SET role=new_role WHERE user_id=target.id; END IF;','IF old_role<>new_role THEN UPDATE public.mac_memberships SET role=new_role WHERE user_id=target.id; UPDATE public.user_roles SET role=new_role WHERE user_id=target.id; END IF;');
 EXECUTE definition;
END $$;