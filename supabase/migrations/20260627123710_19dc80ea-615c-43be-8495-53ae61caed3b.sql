
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Drop storage policy that references old helper FIRST
DROP POLICY IF EXISTS complaint_media_owner_select ON storage.objects;
DROP POLICY IF EXISTS complaint_media_owner_update ON storage.objects;
DROP POLICY IF EXISTS complaint_media_owner_delete ON storage.objects;

-- Rebuild public-schema policies on private.has_role
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.has_role(auth.uid(), 'authority'::public.app_role));

DROP POLICY IF EXISTS user_roles_self_select ON public.user_roles;
CREATE POLICY user_roles_self_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'authority'::public.app_role));

DROP POLICY IF EXISTS complaints_reporter_select ON public.complaints;
CREATE POLICY complaints_reporter_select ON public.complaints
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR private.has_role(auth.uid(), 'authority'::public.app_role)
    OR (private.has_role(auth.uid(), 'technician'::public.app_role) AND assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS complaints_authority_update ON public.complaints;
CREATE POLICY complaints_authority_update ON public.complaints
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'authority'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'authority'::public.app_role));

DROP POLICY IF EXISTS complaints_technician_update ON public.complaints;
CREATE POLICY complaints_technician_update ON public.complaints
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'technician'::public.app_role) AND assigned_to = auth.uid())
  WITH CHECK (private.has_role(auth.uid(), 'technician'::public.app_role) AND assigned_to = auth.uid());

DROP POLICY IF EXISTS events_visible_with_complaint ON public.complaint_events;
CREATE POLICY events_visible_with_complaint ON public.complaint_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_events.complaint_id
        AND (
          c.reporter_id = auth.uid()
          OR private.has_role(auth.uid(), 'authority'::public.app_role)
          OR (private.has_role(auth.uid(), 'technician'::public.app_role) AND c.assigned_to = auth.uid())
        )
    )
  );

-- Now safe to drop old public helper
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Convert admin_complaint_stats to SECURITY INVOKER (caller's RLS applies + internal authority check)
CREATE OR REPLACE FUNCTION public.admin_complaint_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'authority'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total',     (SELECT count(*) FROM public.complaints),
    'open',      (SELECT count(*) FROM public.complaints WHERE status NOT IN ('resolved','closed')),
    'resolved',  (SELECT count(*) FROM public.complaints WHERE status IN ('resolved','closed')),
    'critical',  (SELECT count(*) FROM public.complaints WHERE priority = 'critical' AND status NOT IN ('resolved','closed')),
    'last24h',   (SELECT count(*) FROM public.complaints WHERE created_at > now() - interval '24 hours'),
    'avg_resolution_hours',
      (SELECT COALESCE(round(avg(extract(epoch FROM (resolved_at - created_at)) / 3600.0)::numeric, 1), 0)
         FROM public.complaints WHERE resolved_at IS NOT NULL),
    'active_technicians',
      (SELECT count(DISTINCT assigned_to) FROM public.complaints
         WHERE assigned_to IS NOT NULL AND status NOT IN ('resolved','closed')),
    'by_category',
      (SELECT COALESCE(jsonb_object_agg(category, c), '{}'::jsonb)
         FROM (SELECT category::text, count(*) AS c FROM public.complaints GROUP BY category) s),
    'by_status',
      (SELECT COALESCE(jsonb_object_agg(status, c), '{}'::jsonb)
         FROM (SELECT status::text, count(*) AS c FROM public.complaints GROUP BY status) s)
  ) INTO result;

  RETURN result;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_complaint_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_complaint_stats() TO authenticated, service_role;

-- Lock trigger-only DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_complaints_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_complaints_notify() FROM PUBLIC, anon, authenticated;

-- Recreate storage policies for complaint-media using private.has_role
CREATE POLICY complaint_media_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'complaint-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.has_role(auth.uid(), 'authority'::public.app_role)
      OR (
        private.has_role(auth.uid(), 'technician'::public.app_role)
        AND EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.assigned_to = auth.uid()
            AND c.reporter_id::text = (storage.foldername(name))[1]
        )
      )
    )
  );

CREATE POLICY complaint_media_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'complaint-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'complaint-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY complaint_media_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'complaint-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
