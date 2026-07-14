-- Create technician_applications table
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.technician_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  region TEXT,
  technical_skill TEXT,
  vehicle_available BOOLEAN DEFAULT false,
  status public.application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT ON public.technician_applications TO authenticated;
GRANT ALL ON public.technician_applications TO service_role;
ALTER TABLE public.technician_applications ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER technician_applications_set_updated_at BEFORE UPDATE ON public.technician_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Self can insert their own application
CREATE POLICY "technician_applications_self_insert" ON public.technician_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Self can view their own application
CREATE POLICY "technician_applications_self_select" ON public.technician_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin can view and update all applications
CREATE POLICY "technician_applications_admin_select" ON public.technician_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'authority'));
CREATE POLICY "technician_applications_admin_update" ON public.technician_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'authority'))
  WITH CHECK (public.has_role(auth.uid(), 'authority'));

-- Update the handle_new_user trigger to handle citizen vs technician
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
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;

  -- Only auto-assign role for citizens
  IF v_signup_role = 'citizen' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'citizen')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

-- Update push_subscriptions RLS to enforce approved roles
ALTER POLICY "push_subscriptions_self_insert" ON public.push_subscriptions
  USING (
    user_id = auth.uid() AND 
    (public.has_role(auth.uid(), 'citizen') OR public.has_role(auth.uid(), 'technician') OR public.has_role(auth.uid(), 'authority'))
  );

ALTER POLICY "push_subscriptions_self_update" ON public.push_subscriptions
  USING (
    user_id = auth.uid() AND 
    (public.has_role(auth.uid(), 'citizen') OR public.has_role(auth.uid(), 'technician') OR public.has_role(auth.uid(), 'authority'))
  );

-- Delete old dev accounts from auth.users (cascades automatically)
DELETE FROM auth.users
WHERE email IN (
  'admin@sevajyothi.dev',
  'arjun.tech@sevajyothi.dev',
  'kiran.tech@sevajyothi.dev',
  'manoj.tech@sevajyothi.dev',
  'darshan.tech@sevajyothi.dev',
  'rahul.tech@sevajyothi.dev',
  'praveen.tech@sevajyothi.dev'
);

-- Create single seeded super admin using placeholder credentials
DO $$
DECLARE
  v_admin_uid UUID := gen_random_uuid();
  v_admin_email TEXT := 'admin+' || replace(gen_random_uuid()::text, '-', '') || '@example.invalid';
  v_admin_password TEXT := gen_random_uuid()::text;
BEGIN
  -- We use pgcrypto if available, otherwise just rely on Supabase dashboard resetting the password 
  -- but since Supabase instances have pgcrypto, we will use it.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, recovery_sent_at, last_sign_in_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_admin_uid, 'authenticated', 'authenticated', v_admin_email, crypt(v_admin_password, gen_salt('bf')),
    now(), null, null,
    '{"provider":"email","providers":["email"]}', '{"display_name":"System Administrator"}', now(), now(),
    '', '', '', ''
  );

  -- Profile and role triggers handle the profile, but we must set the authority role manually
  -- Since the trigger auto-assigned citizen (because signup_role was null), we update it to authority
  UPDATE public.user_roles SET role = 'authority' WHERE user_id = v_admin_uid;
  
  -- If trigger failed to insert user_role for some reason, we upsert:
  INSERT INTO public.user_roles (user_id, role) VALUES (v_admin_uid, 'authority') ON CONFLICT (user_id, role) DO NOTHING;

END $$;
