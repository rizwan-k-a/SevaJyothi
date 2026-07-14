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
