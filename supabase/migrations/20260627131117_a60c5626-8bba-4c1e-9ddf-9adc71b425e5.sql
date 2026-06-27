
-- Enable pg_net for trigger -> HTTP dispatch
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Private config (already-existing private schema from earlier hardening)
CREATE TABLE IF NOT EXISTS private.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.app_config FROM PUBLIC, anon, authenticated;

INSERT INTO private.app_config(key, value) VALUES
  ('push_trigger_secret', 'iNK1qutkv-JalKR9kX2Y-aXq5-WIyrbQ_4knf4PpuQnddevsHaGZfIRjluwcOCGF'),
  ('push_dispatch_url',   'https://project--dca6446d-b38f-4f3f-92f1-779240c78269.lovable.app/api/public/send-push')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own push subs" ON public.push_subscriptions;
CREATE POLICY "users manage own push subs"
ON public.push_subscriptions FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions(user_id);

-- Trigger: on notifications insert, asynchronously POST notification id
CREATE OR REPLACE FUNCTION public.tg_notifications_dispatch_push()
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', v_secret
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block notification insert on push dispatch failure
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_notifications_dispatch_push() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tg_notifications_dispatch_push ON public.notifications;
CREATE TRIGGER tg_notifications_dispatch_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.tg_notifications_dispatch_push();
