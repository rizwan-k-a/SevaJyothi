-- Phase 1: Modify technician_applications
ALTER TABLE public.technician_applications DROP CONSTRAINT technician_applications_user_id_fkey;
ALTER TABLE public.technician_applications DROP COLUMN user_id;
ALTER TABLE public.technician_applications ADD COLUMN password_hash TEXT NOT NULL;

-- Drop RLS policies that depended on user_id
DROP POLICY IF EXISTS "technician_applications_self_insert" ON public.technician_applications;
DROP POLICY IF EXISTS "technician_applications_self_select" ON public.technician_applications;

-- Phase 2: Create RPC to submit application
CREATE OR REPLACE FUNCTION public.submit_technician_application(
  _full_name TEXT,
  _email TEXT,
  _plain_password TEXT,
  _phone TEXT,
  _region TEXT,
  _technical_skill TEXT,
  _vehicle_available BOOLEAN
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.technician_applications (
    full_name, email, password_hash, phone, region, technical_skill, vehicle_available
  ) VALUES (
    _full_name, _email, crypt(_plain_password, gen_salt('bf')), _phone, _region, _technical_skill, _vehicle_available
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Phase 3: Create RPC to approve application
CREATE OR REPLACE FUNCTION public.approve_technician_application(_application_id UUID) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.technician_applications;
  v_new_user_id UUID := gen_random_uuid();
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'authority') THEN
    RAISE EXCEPTION 'Forbidden: authority role required';
  END IF;

  SELECT * INTO v_app FROM public.technician_applications WHERE id = _application_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found or already processed';
  END IF;

  -- Insert into auth.users using stored hash
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, recovery_sent_at, last_sign_in_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_new_user_id, 'authenticated', 'authenticated', v_app.email, v_app.password_hash,
    now(), null, null,
    '{"provider":"email","providers":["email"]}', 
    json_build_object('display_name', v_app.full_name, 'phone', v_app.phone), 
    now(), now(), '', '', '', ''
  );

  -- Since signup_role is not in meta_data, the handle_new_user trigger defaults to citizen.
  -- We immediately change it to technician.
  UPDATE public.user_roles SET role = 'technician' WHERE user_id = v_new_user_id;

  -- Mark application approved
  UPDATE public.technician_applications SET status = 'approved' WHERE id = _application_id;

  RETURN v_new_user_id;
END $$;
