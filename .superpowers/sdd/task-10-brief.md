# Task 10 Brief: Settings.tsx — Real Twilio Test

## Objective
Update the SMSTab in Settings.tsx to send a real test SMS via the Edge Function when testing Twilio connection.

## Requirements

### 1. Update `handleTest` in SMSTab
Replace the simulated test with a real Edge Function call:
- In demo mode: keep simulation
- In production: call `POST {SUPABASE_URL}/functions/v1/send-test-sms` with JWT
- Send test SMS to the user's configured sender number
- Show real success/error result
- Add import: `import { isSupabaseConfigured } from '@/lib/supabaseClient'`

### 2. The test message
Send: `'SMSPro: Test de connexion Twilio réussi !'` to `config.senderNumber`

## Files to Modify
- `src/pages/Settings.tsx`

## Context
- The SMSTab component is in Settings.tsx (around line 482-704)
- `handleTest` is at line ~554
- `isSupabaseConfigured` needs to be imported from `@/lib/supabaseClient`
- The function already has access to `config.accountSid`, `config.authToken`, `config.senderNumber`

## Report File
Write your report to: `C:\Users\hp\Documents\GitHub\smspro-comp\.superpowers\sdd\task-10-report.md`
