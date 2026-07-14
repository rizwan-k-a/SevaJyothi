-- 1. Alter technician_applications
ALTER TABLE public.technician_applications ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.technician_applications DROP COLUMN password_hash;

-- Update RLS for technician_applications to allow self select/insert based on user_id
DROP POLICY IF EXISTS "technician_applications_self_insert" ON public.technician_applications;
DROP POLICY IF EXISTS "technician_applications_self_select" ON public.technician_applications;

CREATE POLICY "technician_applications_self_insert" ON public.technician_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "technician_applications_self_select" ON public.technician_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Update the handle_new_user trigger to handle citizen vs technician
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_signup_role TEXT;
BEGIN
  v_signup_role := COALESCE(NEW.raw_user_meta_data->>'signup_role', 'citizen');

  -- Create the profile record regardless of role
  INSERT INTO public.profiles (id, display_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Role assignment logic
  IF v_signup_role = 'citizen' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'citizen')
    ON CONFLICT DO NOTHING;
  ELSIF v_signup_role = 'technician' THEN
    -- DO NOT assign the 'technician' role yet!
    -- Create the pending application instead
    INSERT INTO public.technician_applications (
      user_id, email, full_name, phone, region, technical_skill, vehicle_available, status, email_verification_status, document_status
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'region',
      NEW.raw_user_meta_data->>'technical_skill',
      COALESCE((NEW.raw_user_meta_data->>'vehicle_available')::boolean, false),
      'pending',
      'verified', -- We are skipping email verification entirely
      'pending'
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

-- 3. Modify approve_technician_application RPC
CREATE OR REPLACE FUNCTION public.approve_technician_application(_application_id UUID) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.technician_applications;
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'authority') THEN
    RAISE EXCEPTION 'Forbidden: authority role required';
  END IF;

  SELECT * INTO v_app FROM public.technician_applications WHERE id = _application_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending application not found';
  END IF;

  -- Application found. The auth.users record already exists (created on signup).
  -- Grant the technician role now!
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_app.user_id, 'technician')
  ON CONFLICT DO NOTHING;

  -- Mark application as approved
  UPDATE public.technician_applications
  SET status = 'approved', updated_at = now()
  WHERE id = _application_id;

  RETURN v_app.user_id;
END $$;

-- Drop the obsolete submit_technician_application RPC, as it is no longer used since technicians will just use standard signup
DROP FUNCTION IF EXISTS public.submit_technician_application;
