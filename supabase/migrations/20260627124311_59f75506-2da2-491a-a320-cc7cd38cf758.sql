
CREATE OR REPLACE FUNCTION public.admin_complaint_stats_v2()
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

  WITH base AS (SELECT * FROM public.complaints),
  open_set AS (SELECT * FROM base WHERE status NOT IN ('resolved','closed')),
  resolved_set AS (SELECT * FROM base WHERE resolved_at IS NOT NULL),
  first_assign AS (
    SELECT l.complaint_id, MIN(l.created_at) AS assigned_at
    FROM public.system_audit_logs l
    WHERE l.event_type = 'complaint_assigned'
    GROUP BY l.complaint_id
  ),
  mtta AS (
    SELECT COALESCE(round(avg(extract(epoch FROM (fa.assigned_at - b.created_at)) / 3600.0)::numeric, 2), 0) AS hrs
    FROM base b JOIN first_assign fa ON fa.complaint_id = b.id
  ),
  mttr AS (
    SELECT COALESCE(round(avg(extract(epoch FROM (resolved_at - created_at)) / 3600.0)::numeric, 2), 0) AS hrs
    FROM resolved_set
  ),
  sla AS (
    SELECT CASE WHEN count(*) = 0 THEN 0
                ELSE round(100.0 * count(*) FILTER (WHERE resolved_at - created_at <= interval '24 hours')
                                  / count(*), 1)
           END AS pct_24h
    FROM resolved_set
  ),
  by_district AS (
    SELECT COALESCE(jsonb_object_agg(COALESCE(village,'Unknown'), c), '{}'::jsonb) AS j
    FROM (SELECT village, count(*) AS c FROM base GROUP BY village ORDER BY count(*) DESC LIMIT 12) s
  ),
  by_category AS (
    SELECT COALESCE(jsonb_object_agg(category::text, c), '{}'::jsonb) AS j
    FROM (SELECT category, count(*) AS c FROM base GROUP BY category) s
  ),
  workload AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'technician_id', s.assigned_to,
      'display_name', p.display_name,
      'open_jobs', s.c
    ) ORDER BY s.c DESC), '[]'::jsonb) AS j
    FROM (
      SELECT assigned_to, count(*) AS c
      FROM open_set WHERE assigned_to IS NOT NULL
      GROUP BY assigned_to
    ) s
    LEFT JOIN public.profiles p ON p.id = s.assigned_to
  ),
  aging AS (
    SELECT jsonb_build_object(
      'under_24h', count(*) FILTER (WHERE now() - created_at < interval '24 hours'),
      'one_to_three_days', count(*) FILTER (WHERE now() - created_at >= interval '24 hours' AND now() - created_at < interval '3 days'),
      'three_to_seven_days', count(*) FILTER (WHERE now() - created_at >= interval '3 days' AND now() - created_at < interval '7 days'),
      'over_seven_days', count(*) FILTER (WHERE now() - created_at >= interval '7 days')
    ) AS j FROM open_set
  ),
  failed_syncs AS (
    SELECT count(*)::int AS c
    FROM public.system_audit_logs
    WHERE event_type = 'complaint_sync_failure'
      AND created_at > now() - interval '7 days'
  )
  SELECT jsonb_build_object(
    'total',                  (SELECT count(*) FROM base),
    'open',                   (SELECT count(*) FROM open_set),
    'resolved',               (SELECT count(*) FROM resolved_set),
    'critical_open',          (SELECT count(*) FROM open_set WHERE priority = 'critical'),
    'last_24h',               (SELECT count(*) FROM base WHERE created_at > now() - interval '24 hours'),
    'mtta_hours',             (SELECT hrs FROM mtta),
    'mttr_hours',             (SELECT hrs FROM mttr),
    'sla_pct_within_24h',     (SELECT pct_24h FROM sla),
    'by_district',            (SELECT j FROM by_district),
    'by_category',            (SELECT j FROM by_category),
    'workload',               (SELECT j FROM workload),
    'aging',                  (SELECT j FROM aging),
    'failed_syncs_7d',        (SELECT c FROM failed_syncs),
    'active_technicians',     (SELECT count(DISTINCT assigned_to) FROM open_set WHERE assigned_to IS NOT NULL),
    'computed_at',            now()
  ) INTO result;

  RETURN result;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_complaint_stats_v2() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_complaint_stats_v2() TO authenticated;
