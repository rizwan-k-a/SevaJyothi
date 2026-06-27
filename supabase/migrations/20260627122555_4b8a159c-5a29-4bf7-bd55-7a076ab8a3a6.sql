
-- ============================================================
-- PHASE 4: Rate limiting on complaint inserts (5 per 10 min/user)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_complaints_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  IF NEW.reporter_id IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO recent_count
  FROM public.complaints
  WHERE reporter_id = NEW.reporter_id
    AND created_at > now() - interval '10 minutes';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Too many reports submitted. Please wait a few minutes before filing another.'
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS complaints_rate_limit ON public.complaints;
CREATE TRIGGER complaints_rate_limit
  BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.tg_complaints_rate_limit();

-- ============================================================
-- PHASE 5: In-app notifications
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'complaint_submitted',
    'complaint_synced',
    'complaint_assigned',
    'repair_started',
    'repair_completed',
    'new_complaint_alert',
    'assignment_alert'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          public.notification_type NOT NULL,
  title         text NOT NULL,
  body          text,
  complaint_id  uuid REFERENCES public.complaints(id) ON DELETE CASCADE,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- ============================================================
-- Notification triggers on complaints
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_complaints_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  authority_id uuid;
  cat text := NEW.category::text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Citizen: confirmation
    INSERT INTO public.notifications (user_id, type, title, body, complaint_id)
    VALUES (NEW.reporter_id, 'complaint_submitted',
            'Report received',
            'Your ' || cat || ' report is in the queue.',
            NEW.id);
    -- All authorities: new complaint alert
    FOR authority_id IN SELECT user_id FROM public.user_roles WHERE role = 'authority' LOOP
      INSERT INTO public.notifications (user_id, type, title, body, complaint_id)
      VALUES (authority_id, 'new_complaint_alert',
              'New ' || cat || ' report',
              COALESCE(NEW.village, 'Field') || ' · priority ' || NEW.priority::text,
              NEW.id);
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Assignment
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, complaint_id)
      VALUES (NEW.assigned_to, 'assignment_alert',
              'New job assigned',
              cat || ' report needs attention.', NEW.id);
      INSERT INTO public.notifications (user_id, type, title, body, complaint_id)
      VALUES (NEW.reporter_id, 'complaint_assigned',
              'Technician assigned',
              'A field technician is on your ' || cat || ' report.', NEW.id);
    END IF;
    -- Status transitions
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status::text = 'in_progress' THEN
        INSERT INTO public.notifications (user_id, type, title, body, complaint_id)
        VALUES (NEW.reporter_id, 'repair_started', 'Repair started',
                'Work has begun on your ' || cat || ' report.', NEW.id);
      ELSIF NEW.status::text IN ('resolved','closed') THEN
        INSERT INTO public.notifications (user_id, type, title, body, complaint_id)
        VALUES (NEW.reporter_id, 'repair_completed', 'Repair completed',
                'Your ' || cat || ' report has been resolved.', NEW.id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS complaints_notify_ins ON public.complaints;
CREATE TRIGGER complaints_notify_ins
  AFTER INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.tg_complaints_notify();

DROP TRIGGER IF EXISTS complaints_notify_upd ON public.complaints;
CREATE TRIGGER complaints_notify_upd
  AFTER UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.tg_complaints_notify();
