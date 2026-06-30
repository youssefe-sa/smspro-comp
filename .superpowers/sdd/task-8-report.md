# Task 8 Report: Store Updates — Real Edge Function Calls

## Status: DONE

## Commits
- `4ca178a` — feat: connect store to real Supabase Edge Functions

## Summary
Added `getAccessToken()` to supabaseClient.ts, contact CRUD functions to supabase.ts, and updated `sendCampaign`, `addContact`, and `importContacts` in useStore.ts to call real Supabase Edge Functions in production mode while preserving demo mode behavior.

## Changes

### `src/lib/supabaseClient.ts`
- Added `getAccessToken()` after `getSession()` (lines 180-188) — extracts JWT from Supabase auth session

### `src/lib/supabase.ts`
- Added `createContactSupabase()` — POSTs a single contact to the `contacts` table via REST, guarded by `demoGuard`
- Added `importContactsSupabase()` — bulk POSTs contacts array, returns count of inserted rows

### `src/store/useStore.ts`
- **`addContact`**: In production mode, dynamically imports `createContactSupabase` and calls it; falls back to local ID generation in demo mode
- **`importContacts`**: In production mode, dynamically imports `importContactsSupabase`, calls it, then re-fetches all contacts via `fetchContacts()`; preserves existing local logic in demo mode
- **`sendCampaign`**: In production mode, dynamically imports `getAccessToken`, calls `POST {SUPABASE_URL}/functions/v1/send-campaign` with JWT + apikey headers; on success updates campaign with real stats; on error reverts to draft status and shows error toast; preserves existing simulation in demo mode

## Verification
- `npx tsc --noEmit` — no errors in modified files (pre-existing errors in `@types/node` and unrelated components only)

## Concerns
None
