-- 3. Modify approve_technician_application RPC to remove the redundant has_role check
-- since it is strictly gated to service_role and verified by the Edge Function proxy.
CREATE OR REPLACE FUNCTION public.approve_technician_application(_application_id UUID) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.technician_applications;
BEGIN
  -- Removed the has_role(auth.uid(), 'authority') check because auth.uid() is NULL
  -- when called via the service_role (from the Edge Function), which already validated the admin.

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
