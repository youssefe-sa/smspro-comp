# Task 1 Brief: Edge Function `send-campaign`

## Objective
Create a Supabase Edge Function that sends real SMS via Twilio for a given campaign.

## Requirements
1. Create `supabase/functions/send-campaign/cors.ts` with CORS headers
2. Create `supabase/functions/send-campaign/index.ts` with the full implementation

## Function Spec
- **Input:** POST with `{ campaign_id: number }` and JWT Bearer token
- **Auth:** Verify JWT via Supabase, get user ID
- **Flow:**
  1. Fetch campaign from `campaigns` table (RLS ensures ownership)
  2. Fetch Twilio config from `users.twilio_config` (JSONB with accountSid, authToken, senderNumber)
  3. Fetch target contacts (opted_in = true, filtered by segment if segment_id exists)
  4. For each contact:
     - Personalize message: `{prenom}` → first_name, `{nom}` → last_name, `{ville}` → city
     - Generate tracking_id: `trk_` + 16 hex chars
     - POST to Twilio API: `https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json`
     - Body params: From, To, Body, StatusCallback
     - Create `sms_logs` entry with message_sid, status, cost (0.08), tracking_id
  5. Update campaign: status='sent', completed_at=now
  6. Return `{ sent, failed, total_cost, errors[] }`
- **Rate limit:** 100ms delay between sends
- **Error handling:** Log failures in sms_logs, continue to next contact

## CORS Helper
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

## Files to Create
- `supabase/functions/send-campaign/cors.ts`
- `supabase/functions/send-campaign/index.ts`

## Context
- This is a Supabase Edge Function (Deno runtime)
- Uses `https://esm.sh/@supabase/supabase-js@2` for Supabase client
- Twilio auth is Basic auth: base64(accountSid:authToken)
- The `campaign_stats` table is auto-updated by a PostgreSQL trigger when sms_logs change
- RLS policies will be added in Task 6 to allow service_role access

## Report File
Write your report to: `C:\Users\hp\Documents\GitHub\smspro-comp\.superpowers\sdd\task-1-report.md`
