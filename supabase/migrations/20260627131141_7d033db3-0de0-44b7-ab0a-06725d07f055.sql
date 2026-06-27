
DROP TRIGGER IF EXISTS tg_notifications_dispatch_push ON public.notifications;
DROP FUNCTION IF EXISTS public.tg_notifications_dispatch_push();

CREATE OR REPLACE FUNCTION private.tg_notifications_dispatch_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT value INTO v_url    FROM private.app_config WHERE key = 'push_dispatch_url';
  SELECT value INTO v_secret FROM private.app_config WHERE key = 'push_trigger_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','x-dispatch-secret', v_secret),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION private.tg_notifications_dispatch_push() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tg_notifications_dispatch_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION private.tg_notifications_dispatch_push();
