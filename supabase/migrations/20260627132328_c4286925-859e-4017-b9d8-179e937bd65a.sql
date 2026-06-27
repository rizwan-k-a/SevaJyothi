
-- v3 analytics: server-side aggregates only
CREATE OR REPLACE FUNCTION public.admin_complaint_stats_v3()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
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
    SELECT COALESCE(round(avg(extract(epoch FROM (fa.assigned_at - b.created_at))/3600.0)::numeric, 2), 0) AS hrs
    FROM base b JOIN first_assign fa ON fa.complaint_id = b.id
  ),
  mttr AS (
    SELECT COALESCE(round(avg(extract(epoch FROM (resolved_at - created_at))/3600.0)::numeric, 2), 0) AS hrs
    FROM resolved_set
  ),
  -- Average offline sync delay: difference between client_created_at (when the
  -- citizen filed it in the field) and created_at (server insert).
  sync_delay AS (
    SELECT COALESCE(round(avg(extract(epoch FROM (created_at - client_created_at)))::numeric, 1), 0) AS seconds
    FROM base
    WHERE client_created_at IS NOT NULL
      AND created_at > client_created_at
      AND (created_at - client_created_at) < interval '7 days'
  ),
  sla AS (
    SELECT CASE WHEN count(*) = 0 THEN 0
                ELSE round(100.0 * count(*) FILTER (WHERE resolved_at - created_at <= interval '24 hours') / count(*), 1)
           END AS pct_24h
    FROM resolved_set
  ),
  freq_district AS (
    SELECT COALESCE(jsonb_object_agg(COALESCE(village,'Unknown'), c), '{}'::jsonb) AS j
    FROM (SELECT village, count(*) AS c FROM base GROUP BY village ORDER BY count(*) DESC LIMIT 20) s
  ),
  -- Repeated failure zones: districts with >=3 complaints across multiple categories
  vulnerable AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'village', village, 'incidents', incidents, 'categories', categories
    ) ORDER BY incidents DESC), '[]'::jsonb) AS j
    FROM (
      SELECT COALESCE(village,'Unknown') AS village,
             count(*) AS incidents,
             count(DISTINCT category) AS categories
      FROM base
      GROUP BY COALESCE(village,'Unknown')
      HAVING count(*) >= 3
      ORDER BY count(*) DESC LIMIT 10
    ) s
  ),
  -- Technician performance: assigned/resolved counts + avg resolution speed
  tech_perf AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'technician_id', t.assigned_to,
      'display_name',  p.display_name,
      'assigned',      t.assigned,
      'resolved',      t.resolved,
      'open',          t.open,
      'avg_resolution_hours', t.avg_h,
      -- Composite score 0-100: resolution rate (60%) + speed bonus (40%)
      'score', LEAST(100, round(
        60.0 * (t.resolved::numeric / NULLIF(t.assigned,0))
        + 40.0 * GREATEST(0, 1 - LEAST(t.avg_h,72)/72.0)
      , 1))
    ) ORDER BY t.resolved DESC NULLS LAST), '[]'::jsonb) AS j
    FROM (
      SELECT assigned_to,
             count(*) AS assigned,
             count(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved,
             count(*) FILTER (WHERE status NOT IN ('resolved','closed')) AS open,
             COALESCE(round(avg(extract(epoch FROM (resolved_at - created_at))/3600.0)
                       FILTER (WHERE resolved_at IS NOT NULL)::numeric, 2), 0) AS avg_h
      FROM base
      WHERE assigned_to IS NOT NULL
      GROUP BY assigned_to
    ) t
    LEFT JOIN public.profiles p ON p.id = t.assigned_to
  ),
  aging AS (
    SELECT jsonb_build_object(
      'under_24h',            count(*) FILTER (WHERE now()-created_at < interval '24 hours'),
      'one_to_three_days',    count(*) FILTER (WHERE now()-created_at >= interval '24 hours' AND now()-created_at < interval '3 days'),
      'three_to_seven_days',  count(*) FILTER (WHERE now()-created_at >= interval '3 days'  AND now()-created_at < interval '7 days'),
      'over_seven_days',      count(*) FILTER (WHERE now()-created_at >= interval '7 days')
    ) AS j FROM open_set
  ),
  -- Infrastructure downtime estimate (hours): sum of (now - created_at) for
  -- open incidents, weighted by priority (critical 1.5x, high 1.2x).
  downtime AS (
    SELECT COALESCE(round(sum(
      extract(epoch FROM (now() - created_at))/3600.0
      * CASE priority WHEN 'critical' THEN 1.5 WHEN 'high' THEN 1.2 ELSE 1 END
    )::numeric, 0), 0) AS hours
    FROM open_set
  )
  SELECT jsonb_build_object(
    'total',                  (SELECT count(*) FROM base),
    'open',                   (SELECT count(*) FROM open_set),
    'resolved',               (SELECT count(*) FROM resolved_set),
    'critical_open',          (SELECT count(*) FROM open_set WHERE priority='critical'),
    'last_24h',               (SELECT count(*) FROM base WHERE created_at > now() - interval '24 hours'),
    'mtta_hours',             (SELECT hrs FROM mtta),
    'mttr_hours',             (SELECT hrs FROM mttr),
    'avg_sync_delay_seconds', (SELECT seconds FROM sync_delay),
    'sla_pct_within_24h',     (SELECT pct_24h FROM sla),
    'frequency_by_district',  (SELECT j FROM freq_district),
    'vulnerable_zones',       (SELECT j FROM vulnerable),
    'technician_performance', (SELECT j FROM tech_perf),
    'aging',                  (SELECT j FROM aging),
    'downtime_hours_estimate',(SELECT hours FROM downtime),
    'computed_at',            now()
  ) INTO result;
  RETURN result;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_complaint_stats_v3() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_complaint_stats_v3() TO authenticated;

-- Geo hotspots: snap lat/lng to ~1.1km grid and aggregate.
CREATE OR REPLACE FUNCTION public.admin_complaint_hotspots(_min_incidents int DEFAULT 2)
RETURNS TABLE(lat double precision, lng double precision, incidents int,
              total_priority int, dominant_category text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'authority'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH grid AS (
    SELECT round(c.lat::numeric, 2)::double precision AS lat,
           round(c.lng::numeric, 2)::double precision AS lng,
           c.category::text AS category,
           c.priority_score
    FROM public.complaints c
    WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
  ),
  agg AS (
    SELECT g.lat, g.lng,
           count(*)::int AS incidents,
           COALESCE(sum(g.priority_score), 0)::int AS total_priority
    FROM grid g GROUP BY g.lat, g.lng
  ),
  dom AS (
    SELECT DISTINCT ON (g.lat, g.lng) g.lat, g.lng, g.category
    FROM grid g
    GROUP BY g.lat, g.lng, g.category
    ORDER BY g.lat, g.lng, count(*) DESC
  )
  SELECT a.lat, a.lng, a.incidents, a.total_priority, d.category
  FROM agg a JOIN dom d USING (lat, lng)
  WHERE a.incidents >= _min_incidents
  ORDER BY a.total_priority DESC, a.incidents DESC
  LIMIT 200;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_complaint_hotspots(int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_complaint_hotspots(int) TO authenticated;
