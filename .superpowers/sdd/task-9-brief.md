# Task 9 Brief: NewCampaign.tsx — Real Sending & Test SMS

## Objective
Update NewCampaign.tsx to send real SMS tests and real campaign sends via Edge Functions.

## Requirements

### 1. Update `handleSendTest` function
Replace the test SMS handler to call the real Edge Function:
- In demo mode: keep simulation
- In production: call `POST {SUPABASE_URL}/functions/v1/send-test-sms` with JWT
- Show success/error toast based on result
- Add import: `import { isSupabaseConfigured } from '@/lib/supabaseClient'`

### 2. The `handleSend` function
The store's `sendCampaign` already calls the Edge Function (updated in Task 8). The `handleSend` in NewCampaign.tsx calls `addCampaign` + `sendCampaign`. This should work as-is since the store was updated. Just verify the flow is correct.

### 3. Add missing import
Add `isSupabaseConfigured` to the imports from `@/lib/supabaseClient`.

## Files to Modify
- `src/pages/NewCampaign.tsx`

## Context
- The file is 589 lines
- `handleSendTest` is at line ~112
- `handleSend` is at line ~124
- The store's `sendCampaign` now calls the Edge Function in production mode
- `isSupabaseConfigured` is already exported from `@/lib/supabaseClient`

## Report File
Write your report to: `C:\Users\hp\Documents\GitHub\smspro-comp\.superpowers\sdd\task-9-report.md`
