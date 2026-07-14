-- Fix the handle_new_user trigger which broke because it references a dropped column 'email_verification_status'

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
    -- Create the pending application instead. 
    -- Note: We no longer insert into email_verification_status since that column was dropped.
    INSERT INTO public.technician_applications (
      user_id, email, full_name, phone, region, technical_skill, vehicle_available, status, document_status
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'region',
      NEW.raw_user_meta_data->>'technical_skill',
      COALESCE((NEW.raw_user_meta_data->>'vehicle_available')::boolean, false),
      'pending',
      'pending'
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $$;
