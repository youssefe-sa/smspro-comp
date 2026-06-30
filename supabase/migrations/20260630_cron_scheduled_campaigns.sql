-- Enable pg_cron and pgcrypto extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cron job: check every minute for scheduled campaigns due
SELECT cron.schedule(
  'process-scheduled-campaigns',
  '* * * * *',
  $$
  UPDATE public.campaigns
  SET status = 'sending', sent_at = NOW()
  WHERE status = 'scheduled'
    AND scheduled_at IS NOT NULL
    AND scheduled_at <= NOW();
  $$
);

-- Cron job: clean expired rate_limits every hour
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *',
  $$
  DELETE FROM public.rate_limits WHERE expires_at < NOW();
  $$
);