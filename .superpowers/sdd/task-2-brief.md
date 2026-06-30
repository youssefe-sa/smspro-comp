# Task 2 Brief: Edge Function `send-test-sms`

## Objective
Create a Supabase Edge Function that sends a single test SMS via Twilio.

## Requirements
1. Create `supabase/functions/send-test-sms/index.ts`

## Function Spec
- **Input:** POST with `{ phone: string, message: string }` and JWT Bearer token
- **Auth:** Verify JWT via Supabase, get user ID
- **Flow:**
  1. Validate phone and message are present
  2. Fetch Twilio config from `users.twilio_config`
  3. Send SMS via Twilio API with `[TEST]` prefix
  4. Return `{ success: boolean, message_sid?: string, error?: string }`
- **No sms_logs created** — this is a test, not a tracked campaign message
- **No StatusCallback** — test SMS doesn't need delivery tracking

## CORS
Import from sibling: `import { corsHeaders } from '../send-campaign/cors.ts'`

## Files to Create
- `supabase/functions/send-test-sms/index.ts`

## Context
- Supabase Edge Function (Deno runtime)
- Uses `https://esm.sh/@supabase/supabase-js@2`
- Twilio auth: Basic auth base64(accountSid:authToken)
- The CORS helper already exists at `supabase/functions/send-campaign/cors.ts`

## Report File
Write your report to: `C:\Users\hp\Documents\GitHub\smspro-comp\.superpowers\sdd\task-2-report.md`
