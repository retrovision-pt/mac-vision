CREATE TABLE public.mac_pin_credentials (
 user_id uuid PRIMARY KEY,
 pin_hash text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mac_pin_credentials TO service_role;
ALTER TABLE public.mac_pin_credentials ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.mac_pin_credentials IS 'Server-only PBKDF2 hashes of numeric MAC Vision PINs; never readable by clients.';

CREATE TABLE public.mac_login_attempts (
 user_id uuid PRIMARY KEY,
 failures int NOT NULL DEFAULT 0,
 lockouts int NOT NULL DEFAULT 0,
 locked_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mac_login_attempts TO service_role;
ALTER TABLE public.mac_login_attempts ENABLE ROW LEVEL SECURITY;

-- Reserves one attempt before the PIN is checked, so parallel guesses still consume the budget.
CREATE FUNCTION public.mac_pin_attempt(u uuid) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.mac_login_attempts;
BEGIN
 INSERT INTO public.mac_login_attempts(user_id) VALUES(u) ON CONFLICT (user_id) DO NOTHING;
 SELECT * INTO r FROM public.mac_login_attempts WHERE user_id=u FOR UPDATE;
 IF r.locked_until IS NOT NULL AND r.locked_until>now() THEN RETURN r.locked_until; END IF;
 IF r.failures+1>=5 THEN
  UPDATE public.mac_login_attempts SET failures=0, lockouts=lockouts+1,
   locked_until=now()+make_interval(mins=>15*power(2,least(r.lockouts,6))::int), updated_at=now() WHERE user_id=u;
 ELSE
  UPDATE public.mac_login_attempts SET failures=failures+1, updated_at=now() WHERE user_id=u;
 END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION public.mac_pin_success(u uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.mac_login_attempts SET failures=0, lockouts=0, locked_until=NULL, updated_at=now() WHERE user_id=u;
$$;
REVOKE ALL ON FUNCTION public.mac_pin_attempt(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mac_pin_success(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mac_pin_attempt(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mac_pin_success(uuid) TO service_role;