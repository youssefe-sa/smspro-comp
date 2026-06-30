# Task 4 Brief: Edge Function `twilio-incoming`

## Objective
Create a Supabase Edge Function that handles incoming SMS from Twilio, detects keywords, sends auto-replies, and stores messages.

## Requirements
1. Create `supabase/functions/twilio-incoming/index.ts`

## Function Spec
- **Input:** POST from Twilio webhook (form-urlencoded)
- **No JWT auth** — Twilio calls this directly (validate via Twilio signature in future)
- **Flow:**
  1. Parse form data (From, Body, MessageSid)
  2. Normalize phone number
  3. Find contact by phone in `contacts` table
  4. Find user_id from contact (or skip if unknown)
  5. Fetch active `auto_reply_rules` for that user
  6. Match message against rules:
     - `exact`: message === keyword (case-insensitive)
     - `contains`: message.includes(keyword)
     - `starts_with`: message.startsWith(keyword)
  7. If match found:
     - Store inbound message in `inbox_messages` with keyword_detected, auto_reply_sent=true, rule_triggered_id
     - Increment rule's trigger_count
     - Process rule actions:
       - `opt_in`: update contact's opted_in, opted_in_date/opted_out_date
       - `add_tag`: append tag to contact's tags array
       - `remove_tag`: remove tag from contact's tags array
     - Send auto-reply via Twilio API (fetch user's twilio_config)
     - Store outbound message in `inbox_messages`
  8. If no match: just store inbound message with auto_reply_sent=false
  9. Return TwiML: `<Response></Response>`

## Files to Create
- `supabase/functions/twilio-incoming/index.ts`

## Context
- Supabase Edge Function (Deno runtime)
- Uses service_role key (bypasses RLS) for all DB operations
- Twilio form data is application/x-www-form-urlencoded
- Auto-reply rules have: keyword, match_type, response_message, actions (JSONB array), is_active, case_sensitive
- Actions are a discriminated union: `{type: 'opt_in', value: boolean}`, `{type: 'add_tag', tag: string}`, `{type: 'remove_tag', tag: string}`
- The `inbox_messages` table tracks both inbound and outbound messages

## Report File
Write your report to: `C:\Users\hp\Documents\GitHub\smspro-comp\.superpowers\sdd\task-4-report.md`
