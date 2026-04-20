-- Enable required extensions (run once; safe to re-run)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule weekly reminders every Monday at 9:00 AM UTC
-- To change the schedule, update the cron expression (minute hour day month weekday)
select cron.schedule(
  'send-weekly-reminders',
  '0 9 * * 1',
  $$
    select net.http_post(
      url     := 'https://vwabxjuhtrxlppgvwvwc.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- To verify the job was created:
-- select * from cron.job;

-- To remove it:
-- select cron.unschedule('send-weekly-reminders');
