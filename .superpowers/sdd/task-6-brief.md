# Task 6 Brief: RLS Policies for Edge Functions

## Objective
Create a SQL migration that adds RLS policies allowing Edge Functions (using service_role) to access tables.

## Requirements
1. Create `supabase/migrations/20260630_rls_edge_functions.sql`

## SQL Spec

```sql
-- Allow Edge Functions (using service_role) to manage sms_logs
DROP POLICY IF EXISTS "Service role can manage sms_logs" ON public.sms_logs;
CREATE POLICY "Service role can manage sms_logs" ON public.sms_logs
  FOR ALL USING (true) WITH CHECK (true);

-- inbox_messages
DROP POLICY IF EXISTS "Service role can manage inbox" ON public.inbox_messages;
CREATE POLICY "Service role can manage inbox" ON public.inbox_messages
  FOR ALL USING (true) WITH CHECK (true);

-- auto_reply_rules: read-only for Edge Functions
DROP POLICY IF EXISTS "Service role can read auto_reply" ON public.auto_reply_rules;
CREATE POLICY "Service role can read auto_reply" ON public.auto_reply_rules
  FOR SELECT USING (true);

-- contacts: Edge Functions need read/write for auto-reply actions
DROP POLICY IF EXISTS "Service role can manage contacts" ON public.contacts;
CREATE POLICY "Service role can manage contacts" ON public.contacts
  FOR ALL USING (true) WITH CHECK (true);

-- audit_logs: insert-only for Edge Functions
DROP POLICY IF EXISTS "Service role can insert audit" ON public.audit_logs;
CREATE POLICY "Service role can insert audit" ON public.audit_logs
  FOR INSERT WITH CHECK (true);
```

## Files to Create
- `supabase/migrations/20260630_rls_edge_functions.sql`

## Context
- These policies use `USING (true)` which allows the service_role key to bypass RLS
- The existing RLS policies for user-level access remain unchanged
- These are needed because Edge Functions use the service_role key

## Report File
Write your report to: `C:\Users\hp\Documents\GitHub\smspro-comp\.superpowers\sdd\task-6-report.md`
