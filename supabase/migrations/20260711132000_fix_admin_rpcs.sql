-- Fix: Allow service_role to execute these RPCs without failing on auth.uid() checks
-- since the Edge Function handles authorization.

CREATE OR REPLACE FUNCTION public.approve_technician_application(_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_password_hash text;
  v_full_name text;
  v_phone text;
  v_region text;
  v_technical_skill text;
  v_vehicle_available boolean;
  v_new_user_id uuid;
BEGIN
  -- 1. Fetch application details
  SELECT email, password_hash, full_name, phone, region, technical_skill, vehicle_available
  INTO v_email, v_password_hash, v_full_name, v_phone, v_region, v_technical_skill, v_vehicle_available
  FROM public.technician_applications
  WHERE id = _application_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending application not found';
  END IF;

  -- 2. Create the user in auth.users
  v_new_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, confirmation_token
  )
  VALUES (
    v_new_user_id, v_email, v_password_hash, now(),
    '{"provider":"email","providers":["email"]}', 
    jsonb_build_object('signup_role', 'technician', 'display_name', v_full_name),
    now(), now(), 'authenticated', 'authenticated', ''
  );

  -- 3. The trigger handle_new_user will auto-assign 'citizen' and create a profile.
  -- We must upgrade their role to 'technician'.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_new_user_id, 'technician')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Remove citizen role if it exists
  DELETE FROM public.user_roles WHERE user_id = v_new_user_id AND role = 'citizen';

  -- 4. Mark application as approved
  UPDATE public.technician_applications
  SET status = 'approved', updated_at = now()
  WHERE id = _application_id;

  RETURN v_new_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users_by_role(p_role text)
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  phone text,
  village text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  banned_until timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id, 
    au.email::text, 
    p.display_name, 
    p.phone, 
    p.village, 
    au.last_sign_in_at, 
    au.created_at, 
    au.banned_until
  FROM auth.users au
  JOIN public.user_roles ur ON au.id = ur.user_id
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE ur.role = p_role::public.app_role
  ORDER BY au.created_at DESC;
END;
$$;

-- Revoke public execution to ensure only backend/service_role can execute these
REVOKE EXECUTE ON FUNCTION public.approve_technician_application(uuid) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.approve_technician_application(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_list_users_by_role(text) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users_by_role(text) TO service_role;
