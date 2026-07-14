-- Seed two demo citizen accounts for resilience tests + judge demo logins.
-- Idempotent: skip if email exists.
DO $$
DECLARE
  c1 uuid;
  c2 uuid;
  v_citizen_password text := gen_random_uuid()::text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'citizen1@sevajyothi.dev') THEN
    c1 := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES (c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'citizen1@sevajyothi.dev',
            crypt(v_citizen_password, gen_salt('bf')), now(), now(), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"display_name":"Citizen One"}'::jsonb, '', '', '', '');
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), c1, c1::text, jsonb_build_object('sub', c1::text, 'email', 'citizen1@sevajyothi.dev'), 'email', now(), now(), now());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'citizen2@sevajyothi.dev') THEN
    c2 := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES (c2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'citizen2@sevajyothi.dev',
            crypt(v_citizen_password, gen_salt('bf')), now(), now(), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"display_name":"Citizen Two"}'::jsonb, '', '', '', '');
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), c2, c2::text, jsonb_build_object('sub', c2::text, 'email', 'citizen2@sevajyothi.dev'), 'email', now(), now(), now());
  END IF;
END $$;