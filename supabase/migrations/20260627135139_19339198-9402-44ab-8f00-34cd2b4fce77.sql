
-- Batch 2: Predictive Risk Engine + Nearest Technician + village-aware rollup
CREATE OR REPLACE FUNCTION public.admin_predictive_risk()
RETURNS TABLE(
  village text,
  category text,
  incidents_90d int,
  recurrence_rate numeric,
  avg_priority numeric,
  monsoon_weight numeric,
  risk_score int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m int := extract(month FROM now())::int;
  monsoon_factor numeric := CASE WHEN m BETWEEN 6 AND 9 THEN 1.35 ELSE 1.0 END;
BEGIN
  IF NOT private.has_role(auth.uid(), 'authority'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT COALESCE(c.village,'Unknown') AS v,
           c.category::text AS cat,
           c.priority_score,
           c.created_at,
           c.resolved_at
    FROM public.complaints c
    WHERE c.created_at > now() - interval '90 days'
  ),
  agg AS (
    SELECT v, cat,
           count(*)::int AS inc,
           -- recurrence: pct that are repeats within same village+cat in 30d windows
           (count(*) FILTER (WHERE created_at > now() - interval '30 days')::numeric
             / NULLIF(count(*),0)) AS recurrence,
           avg(priority_score)::numeric AS avg_pri
    FROM base GROUP BY v, cat
  )
  SELECT a.v, a.cat, a.inc,
         round(COALESCE(a.recurrence,0), 2) AS recurrence_rate,
         round(COALESCE(a.avg_pri,0), 1) AS avg_priority,
         monsoon_factor AS monsoon_weight,
         LEAST(100,
           round(
             ( LEAST(a.inc, 20)::numeric / 20 * 40 )      -- density up to 40
           + ( COALESCE(a.recurrence,0) * 30 )            -- recurrence up to 30
           + ( COALESCE(a.avg_pri,0) / 100 * 20 )         -- severity up to 20
           + ( CASE WHEN monsoon_factor > 1 AND a.cat IN ('water_pipe','sewage_leak','transformer') THEN 10 ELSE 0 END )
           )::int
         )::int AS risk_score
  FROM agg a
  WHERE a.inc >= 2
  ORDER BY risk_score DESC NULLS LAST
  LIMIT 25;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_predictive_risk() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_predictive_risk() TO authenticated;

-- Nearest available technician for a complaint (haversine over last-known assigned coords).
-- Falls back to least-loaded technician when no GPS history.
CREATE OR REPLACE FUNCTION public.admin_nearest_technician(_complaint_id uuid)
RETURNS TABLE(technician_id uuid, display_name text, open_jobs int, distance_km numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  tlat double precision;
  tlng double precision;
BEGIN
  IF NOT private.has_role(auth.uid(), 'authority'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT c.lat, c.lng INTO tlat, tlng FROM public.complaints c WHERE c.id = _complaint_id;

  RETURN QUERY
  WITH tech AS (
    SELECT ur.user_id AS tid, p.display_name
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'technician'
  ),
  workload AS (
    SELECT assigned_to, count(*)::int AS open_jobs
    FROM public.complaints
    WHERE assigned_to IS NOT NULL AND status NOT IN ('resolved','closed')
    GROUP BY assigned_to
  ),
  last_loc AS (
    -- last known job location per technician
    SELECT DISTINCT ON (assigned_to) assigned_to, lat, lng
    FROM public.complaints
    WHERE assigned_to IS NOT NULL AND lat IS NOT NULL AND lng IS NOT NULL
    ORDER BY assigned_to, created_at DESC
  )
  SELECT t.tid,
         t.display_name,
         COALESCE(w.open_jobs, 0),
         CASE
           WHEN tlat IS NULL OR ll.lat IS NULL THEN NULL
           ELSE round((
             6371 * acos(
               LEAST(1.0, GREATEST(-1.0,
                 cos(radians(tlat))*cos(radians(ll.lat))
                 * cos(radians(ll.lng) - radians(tlng))
                 + sin(radians(tlat))*sin(radians(ll.lat))
               ))
             )
           )::numeric, 2)
         END AS distance_km
  FROM tech t
  LEFT JOIN workload w ON w.assigned_to = t.tid
  LEFT JOIN last_loc ll ON ll.assigned_to = t.tid
  ORDER BY distance_km NULLS LAST, COALESCE(w.open_jobs, 0) ASC
  LIMIT 5;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_nearest_technician(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_nearest_technician(uuid) TO authenticated;
