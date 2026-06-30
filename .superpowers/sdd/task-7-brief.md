# Task 7 Brief: pg_cron for Scheduled Campaigns

## Objective
Create a SQL migration that sets up pg_cron jobs for processing scheduled campaigns and cleaning up rate limits.

## Requirements
1. Create `supabase/migrations/20260630_cron_scheduled_campaigns.sql`

## SQL Spec

```sql
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
```

## Files to Create
- `supabase/migrations/20260630_cron_scheduled_campaigns.sql`

## Context
- pg_cron must be enabled in Supabase (Dashboard → Database → Extensions)
- The first job changes `status='scheduled'` to `status='sending'` when due
- The frontend detects `status='sending'` and calls the send-campaign Edge Function
- The second job cleans up expired rate limiting entries

## Report File
Write your report to: `C:\Users\hp\Documents\GitHub\smspro-comp\.superpowers\sdd\task-7-report.md`
