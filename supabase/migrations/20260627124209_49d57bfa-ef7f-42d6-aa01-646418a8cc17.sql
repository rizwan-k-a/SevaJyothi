
-- ============================================================
-- PHASE 1 — LEAST PRIVILEGE ON PUBLIC TABLES
-- ============================================================
REVOKE ALL ON public.profiles         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_roles       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.complaints       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.complaint_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.notifications    FROM PUBLIC, anon, authenticated;

-- profiles: signed-in users read/update own row (RLS enforces)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- user_roles: signed-in users read; mutations only via service_role / definer
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- complaints: full CRUD, RLS-gated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;

-- complaint_events: insert + read, RLS-gated
GRANT SELECT, INSERT ON public.complaint_events TO authenticated;
GRANT ALL ON public.complaint_events TO service_role;

-- notifications: read own + mark read
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- ============================================================
-- PHASE 2 — SYSTEM AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id           bigserial PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  actor_id     uuid,
  event_type   text NOT NULL,
  complaint_id uuid,
  ip           inet,
  user_agent   text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS system_audit_logs_created_at_idx
  ON public.system_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS system_audit_logs_event_type_idx
  ON public.system_audit_logs (event_type);
CREATE INDEX IF NOT EXISTS system_audit_logs_actor_idx
  ON public.system_audit_logs (actor_id);

-- No direct table grants for anon/authenticated — reads via RLS, writes via function only.
GRANT SELECT ON public.system_audit_logs TO authenticated;
GRANT ALL    ON public.system_audit_logs TO service_role;

ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_authority_select ON public.system_audit_logs;
CREATE POLICY audit_logs_authority_select
  ON public.system_audit_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'authority'::public.app_role));

-- No INSERT/UPDATE/DELETE policy → table effectively append-only via SECURITY DEFINER paths.

-- ============================================================
-- PHASE 3 — LOG WRITER (callable by clients for login events)
-- ============================================================
CREATE OR REPLACE FUNCTION public.app_log_event(
  _event_type text,
  _metadata   jsonb DEFAULT '{}'::jsonb,
  _complaint_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed text[] := ARRAY[
    'login_success','login_failure','logout',
    'complaint_sync_success','complaint_sync_failure',
    'notification_read','technician_accepted',
    'repair_started','repair_resolved','repair_en_route','repair_on_site'
  ];
BEGIN
  IF NOT (_event_type = ANY(allowed)) THEN
    RAISE EXCEPTION 'unsupported event_type %', _event_type USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.system_audit_logs(actor_id, event_type, metadata, complaint_id)
  VALUES (auth.uid(), _event_type, COALESCE(_metadata,'{}'::jsonb), _complaint_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.app_log_event(text,jsonb,uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.app_log_event(text,jsonb,uuid) TO authenticated;

-- ============================================================
-- PHASE 4 — DB-SIDE LIFECYCLE TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_complaints_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.system_audit_logs(actor_id, event_type, complaint_id, metadata)
    VALUES (NEW.reporter_id, 'complaint_created', NEW.id,
            jsonb_build_object('category', NEW.category, 'priority', NEW.priority,
                               'village', NEW.village, 'priority_score', NEW.priority_score));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.system_audit_logs(actor_id, event_type, complaint_id, metadata)
      VALUES (auth.uid(), 'complaint_assigned', NEW.id,
              jsonb_build_object('assigned_to', NEW.assigned_to,
                                 'previous_assigned_to', OLD.assigned_to));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.system_audit_logs(actor_id, event_type, complaint_id, metadata)
      VALUES (auth.uid(), 'complaint_status_changed', NEW.id,
              jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_complaints_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS complaints_audit ON public.complaints;
CREATE TRIGGER complaints_audit
AFTER INSERT OR UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_complaints_audit();

CREATE OR REPLACE FUNCTION public.tg_notifications_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.system_audit_logs(actor_id, event_type, complaint_id, metadata)
    VALUES (NEW.user_id, 'notification_created', NEW.complaint_id,
            jsonb_build_object('type', NEW.type, 'notification_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
    INSERT INTO public.system_audit_logs(actor_id, event_type, complaint_id, metadata)
    VALUES (NEW.user_id, 'notification_read', NEW.complaint_id,
            jsonb_build_object('type', NEW.type, 'notification_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_notifications_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notifications_audit ON public.notifications;
CREATE TRIGGER notifications_audit
AFTER INSERT OR UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.tg_notifications_audit();
