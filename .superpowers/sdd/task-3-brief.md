# Task 3 Brief: Rewrite `twilio-status` Edge Function

## Objective
Rewrite the existing `supabase/functions/twilio-status/index.ts` to properly handle Twilio delivery status webhooks.

## Requirements
1. Overwrite `supabase/functions/twilio-status/index.ts` with improved implementation

## Function Spec
- **Input:** POST from Twilio webhook (form-urlencoded or JSON)
- **No auth required** — Twilio calls this directly
- **Flow:**
  1. Parse content-type (form-urlencoded or JSON)
  2. Extract MessageSid and MessageStatus
  3. Map Twilio status to our status:
     - `delivered` → status='delivered', set delivered_at
     - `failed`/`undelivered` → status='failed', set failed_at, error_code, error_message
     - `sent` → status='sent'
     - `queued`/`accepted`/`pending` → status='queued'
  4. Update `sms_logs` where message_sid matches
  5. Insert audit_log entry
  6. Always return 200 (Twilio retries on non-200)

## Files to Modify
- `supabase/functions/twilio-status/index.ts` (overwrite existing)

## Context
- The existing file already works but needs cleanup
- Uses service_role key (bypasses RLS) for DB updates
- The `campaign_stats` table auto-updates via PostgreSQL trigger when sms_logs change

## Report File
Write your report to: `C:\Users\hp\Documents\GitHub\smspro-comp\.superpowers\sdd\task-3-report.md`
