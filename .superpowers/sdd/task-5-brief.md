# Task 5 Brief: Edge Function `track`

## Objective
Create a Supabase Edge Function that handles SMS link click tracking.

## Requirements
1. Create `supabase/functions/track/index.ts`

## Function Spec
- **Input:** GET with query params: `id` (tracking_id), `url` (original URL)
- **No auth** — this is a public redirect endpoint
- **Flow:**
  1. Extract `id` and `url` from query params
  2. Find `sms_logs` entry where `tracking_id` matches
  3. If found, update `engagement` JSONB:
     - If no `read_at`: set `read_at = now` (first click = read)
     - Always set `clicked_at = now`
     - If url provided: set `clicked_url`
  4. Redirect (302) to the original URL or `https://example.com` as fallback

## Files to Create
- `supabase/functions/track/index.ts`

## Context
- Supabase Edge Function (Deno runtime)
- Uses service_role key (bypasses RLS)
- This is a public URL — anyone can click it
- The `engagement` field in sms_logs is JSONB: `{read_at, clicked_at, clicked_url, replies}`
- Use `Response.redirect()` for the redirect

## Report File
Write your report to: `C:\Users\hp\Documents\GitHub\smspro-comp\.superpowers\sdd\task-5-report.md`
