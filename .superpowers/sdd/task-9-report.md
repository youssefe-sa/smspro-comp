# Task 9 Report: NewCampaign.tsx — Real Sending & Test SMS

**Status:** DONE

**Commits:** `a2ed5cc` — feat: wire handleSendTest to real send-test-sms Edge Function in production

**Summary:** Updated `handleSendTest` to call the real `send-test-sms` Edge Function in production mode (with JWT auth) and kept demo simulation fallback; added `isSupabaseConfigured` import.

## Changes

1. Added `import { isSupabaseConfigured } from '@/lib/supabaseClient'` (line 22)
2. Added `isDemo` to the store destructuring (line 39)
3. Rewrote `handleSendTest` (lines 113-156): in production mode (`!isDemo && isSupabaseConfigured()`), dynamically imports `getAccessToken`, calls `POST {supabaseUrl}/functions/v1/send-test-sms` with JWT headers, and handles success/error toasts; in demo mode, keeps the simulated setTimeout behavior
4. Verified `handleSend` flow is correct as-is (store's `sendCampaign` already calls Edge Function)
