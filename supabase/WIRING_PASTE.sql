-- ============================================================================
-- Email pipeline wiring v2: self-contained webhook + reminder cron + self-test
-- (v1 relied on a schema the dashboard creates lazily; this needs nothing.)
-- Paste into STAGING SQL Editor and Run.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Webhook: every notifications INSERT → send-notification-email function
CREATE OR REPLACE FUNCTION public.notify_email_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://haptjelzekjdjerrditm.supabase.co/functions/v1/send-notification-email',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public',
      'record', to_jsonb(NEW)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_email_webhook();

-- 2. Cron: reminder scan every 15 minutes
SELECT cron.unschedule('send-reminders-15m')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-reminders-15m');
SELECT cron.schedule(
  'send-reminders-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://haptjelzekjdjerrditm.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 3. SELF-TEST: real notification for your account → webhook → Resend → inbox
INSERT INTO public.notifications (user_id, type, title, body, link_url)
SELECT id, 'system',
       'Overture email is live 🎉',
       'This is the notification pipeline talking. Invites, offers, callbacks, and reminders now reach real inboxes.',
       '/notifications'
FROM public.profiles
WHERE email = 'area815@gmail.com';
