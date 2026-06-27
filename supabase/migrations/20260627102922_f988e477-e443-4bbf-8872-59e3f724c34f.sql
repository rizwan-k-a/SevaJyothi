
-- Realtime publication + full row payloads
ALTER TABLE public.complaints REPLICA IDENTITY FULL;
ALTER TABLE public.complaint_events REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='complaints'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='complaint_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_events';
  END IF;
END $$;

-- Server-side aggregates (RLS-bypassing, role-gated inside function)
CREATE OR REPLACE FUNCTION public.admin_complaint_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'authority') THEN
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

REVOKE ALL ON FUNCTION public.admin_complaint_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_complaint_stats() TO authenticated;
