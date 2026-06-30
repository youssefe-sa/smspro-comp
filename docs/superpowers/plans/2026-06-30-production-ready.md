# SMSPro Production Ready — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SMSPro fully functional for production: real SMS sending via Twilio, contacts synced to Supabase, engagement tracking, auto-replies, scheduled campaigns.

**Architecture:** Supabase Edge Functions handle all Twilio interactions (send SMS, receive webhooks, track clicks). The React frontend calls these functions via HTTP. pg_cron processes scheduled campaigns automatically.

**Tech Stack:** Supabase Edge Functions (Deno), Twilio REST API, pg_cron, React 19, Zustand, Supabase REST API

## Global Constraints

- Twilio credentials stored in `users.twilio_config` (never exposed to client)
- All Edge Functions require Supabase JWT auth (except Twilio webhooks)
- RLS enforced on all tables
- Messages must be personalized with `{prenom}`, `{nom}`, `{ville}` variables
- Cost per SMS: €0.08 (configurable)
- SMS max length: 160 chars (standard), 153 chars per segment for multipart

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/functions/send-campaign/index.ts` | Send SMS to all contacts in a campaign via Twilio |
| `supabase/functions/send-campaign/cors.ts` | CORS helper for Edge Functions |
| `supabase/functions/twilio-incoming/index.ts` | Handle incoming SMS webhook from Twilio |
| `supabase/functions/twilio-status/index.ts` | **Rewrite** — handle delivery status webhooks |
| `supabase/functions/send-test-sms/index.ts` | Send a single test SMS |
| `supabase/functions/track/index.ts` | Redirect tracking links, record engagement |
| `supabase/migrations/20260630_cron_scheduled_campaigns.sql` | pg_cron for scheduled campaigns |
| `supabase/migrations/20260630_rls_edge_functions.sql` | RLS policies allowing Edge Function writes |

### Modified Files

| File | Changes |
|------|---------|
| `src/store/useStore.ts` | `sendCampaign` → call Edge Function; `addContact`/`importContacts` → sync Supabase |
| `src/pages/NewCampaign.tsx` | Real SMS test, real sending with progress |
| `src/pages/Contacts.tsx` | CSV import → Supabase, add/edit → Supabase |
| `src/pages/Dashboard.tsx` | Read stats from Supabase views |
| `src/pages/Settings.tsx` | Real Twilio connection test |
| `src/lib/supabase.ts` | Add CRUD operations for all tables |
| `src/lib/supabaseClient.ts` | Add `getAccessToken()` helper |

---

### Task 1: Edge Function `send-campaign`

**Files:**
- Create: `supabase/functions/send-campaign/index.ts`
- Create: `supabase/functions/send-campaign/cors.ts`

**Interfaces:**
- Consumes: JWT auth token, `campaign_id` in request body
- Produces: `{ sent: number, failed: number, total_cost: number, errors: string[] }`

- [ ] **Step 1: Create CORS helper**

```typescript
// supabase/functions/send-campaign/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

- [ ] **Step 2: Create the Edge Function**

```typescript
// supabase/functions/send-campaign/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { campaign_id } = await req.json()
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'Missing campaign_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch campaign (RLS ensures ownership)
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single()

    if (campError || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch Twilio config from user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('twilio_config')
      .eq('id', user.id)
      .single()

    const twilioConfig = userProfile?.twilio_config
    if (!twilioConfig?.accountSid || !twilioConfig?.authToken || !twilioConfig?.senderNumber) {
      return new Response(JSON.stringify({ error: 'Twilio not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch target contacts (opted_in only)
    let query = supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .eq('opted_in', true)

    if (campaign.segment_id) {
      const { data: segment } = await supabase
        .from('segments')
        .select('conditions')
        .eq('id', campaign.segment_id)
        .single()

      if (segment?.conditions) {
        const c = segment.conditions
        if (c.city) query = query.eq('city', c.city)
        if (c.tags && Array.isArray(c.tags)) {
          query = query.overlaps('tags', c.tags)
        }
      }
    }

    const { data: contacts, error: contactsError } = await query

    if (contactsError || !contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ error: 'No contacts found', sent: 0, failed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update campaign status
    await supabase
      .from('campaigns')
      .update({ status: 'sending', sent_at: new Date().toISOString() })
      .eq('id', campaign_id)

    const twilioAuth = btoa(`${twilioConfig.accountSid}:${twilioConfig.authToken}`)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || ''
    const statusCallback = `${supabaseUrl}/functions/v1/twilio-status`

    let sent = 0
    let failed = 0
    let totalCost = 0
    const errors: string[] = []

    // Send SMS to each contact (batched)
    for (const contact of contacts) {
      try {
        // Personalize message
        const message = campaign.message
          .replace(/\{prenom\}/gi, contact.first_name || '')
          .replace(/\{nom\}/gi, contact.last_name || '')
          .replace(/\{ville\}/gi, contact.city || '')

        const trackingId = `trk_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`

        // Send via Twilio
        const body = new URLSearchParams()
        body.append('From', twilioConfig.senderNumber)
        body.append('To', contact.phone)
        body.append('Body', message)
        body.append('StatusCallback', statusCallback)

        const twilioResponse = await fetch(
          `${TWILIO_API_BASE}/Accounts/${twilioConfig.accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          }
        )

        const twilioData = await twilioResponse.json()

        if (twilioResponse.ok && twilioData.sid) {
          // Create sms_log entry
          await supabase.from('sms_logs').insert({
            campaign_id,
            contact_id: contact.id,
            phone: contact.phone,
            message,
            message_sid: twilioData.sid,
            status: 'sent',
            cost: 0.08,
            tracking_id: trackingId,
            sent_at: new Date().toISOString(),
          })
          sent++
          totalCost += 0.08
        } else {
          // Log failure
          await supabase.from('sms_logs').insert({
            campaign_id,
            contact_id: contact.id,
            phone: contact.phone,
            message,
            status: 'failed',
            error_code: twilioData.code?.toString() || 'UNKNOWN',
            error_message: twilioData.message || 'Unknown error',
            cost: 0,
            sent_at: new Date().toISOString(),
          })
          failed++
          errors.push(`${contact.phone}: ${twilioData.message || 'Failed'}`)
        }
      } catch (err) {
        failed++
        errors.push(`${contact.phone}: ${(err as Error).message}`)
      }

      // Rate limit: 100ms between sends
      await new Promise(r => setTimeout(r, 100))
    }

    // Update campaign completion
    await supabase
      .from('campaigns')
      .update({
        status: 'sent',
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaign_id)

    return new Response(JSON.stringify({ sent, failed, total_cost: totalCost, errors }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('send-campaign error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 3: Test locally**

Run: `supabase functions serve send-campaign`
Expected: Function starts without errors

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-campaign/
git commit -m "feat: add send-campaign Edge Function for real SMS sending"
```

---

### Task 2: Edge Function `send-test-sms`

**Files:**
- Create: `supabase/functions/send-test-sms/index.ts`

**Interfaces:**
- Consumes: JWT auth, `{ phone: string, message: string }`
- Produces: `{ success: boolean, message_sid?: string, error?: string }`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/send-test-sms/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../send-campaign/cors.ts'

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { phone, message } = await req.json()
    if (!phone || !message) {
      return new Response(JSON.stringify({ error: 'Missing phone or message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch Twilio config
    const { data: userProfile } = await supabase
      .from('users')
      .select('twilio_config')
      .eq('id', user.id)
      .single()

    const twilioConfig = userProfile?.twilio_config
    if (!twilioConfig?.accountSid || !twilioConfig?.authToken || !twilioConfig?.senderNumber) {
      return new Response(JSON.stringify({ error: 'Twilio not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const twilioAuth = btoa(`${twilioConfig.accountSid}:${twilioConfig.authToken}`)

    const body = new URLSearchParams()
    body.append('From', twilioConfig.senderNumber)
    body.append('To', phone)
    body.append('Body', `[TEST] ${message}`)

    const twilioResponse = await fetch(
      `${TWILIO_API_BASE}/Accounts/${twilioConfig.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    )

    const twilioData = await twilioResponse.json()

    if (twilioResponse.ok && twilioData.sid) {
      return new Response(JSON.stringify({
        success: true,
        message_sid: twilioData.sid,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: twilioData.message || 'Twilio error',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/send-test-sms/
git commit -m "feat: add send-test-sms Edge Function"
```

---

### Task 3: Rewrite `twilio-status` Edge Function

**Files:**
- Modify: `supabase/functions/twilio-status/index.ts`

**Interfaces:**
- Consumes: Twilio webhook POST (form-urlencoded)
- Produces: Updated `sms_logs` status, `campaign_stats` auto-updated by trigger

- [ ] **Step 1: Rewrite the function**

```typescript
// supabase/functions/twilio-status/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const contentType = req.headers.get('content-type') || ''
    let payload: Record<string, string> = {}

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData()
      payload = Object.fromEntries(formData.entries())
    } else if (contentType.includes('application/json')) {
      payload = await req.json()
    } else {
      return new Response('Unsupported content type', { status: 400 })
    }

    console.log('Twilio status webhook:', JSON.stringify(payload))

    if (!payload.MessageSid || !payload.MessageStatus) {
      return new Response('Missing required fields', { status: 400 })
    }

    const status = payload.MessageStatus.toLowerCase()
    const updates: Record<string, any> = {}

    // Map Twilio status to our status
    switch (status) {
      case 'delivered':
        updates.status = 'delivered'
        updates.delivered_at = new Date().toISOString()
        break
      case 'failed':
      case 'undelivered':
        updates.status = 'failed'
        updates.failed_at = new Date().toISOString()
        if (payload.ErrorCode) updates.error_code = payload.ErrorCode
        if (payload.ErrorMessage) updates.error_message = payload.ErrorMessage
        break
      case 'sent':
        updates.status = 'sent'
        break
      case 'queued':
      case 'accepted':
      case 'pending':
        updates.status = 'queued'
        break
      default:
        updates.status = status
    }

    // Update sms_log
    const { error } = await supabase
      .from('sms_logs')
      .update(updates)
      .eq('message_sid', payload.MessageSid)

    if (error) {
      console.error('Update sms_logs error:', error)
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'twilio_status',
      entity_type: 'sms_log',
      details: payload,
    }).then(() => {}).catch(() => {})

    // Return 200 always (Twilio retries on non-200)
    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('OK', { status: 200 })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/twilio-status/
git commit -m "feat: rewrite twilio-status webhook with proper status mapping"
```

---

### Task 4: Edge Function `twilio-incoming`

**Files:**
- Create: `supabase/functions/twilio-incoming/index.ts`

**Interfaces:**
- Consumes: Twilio webhook POST (incoming SMS)
- Produces: TwiML response, `inbox_messages` entries, auto-reply sent

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/twilio-incoming/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const formData = await req.formData()
    const payload = Object.fromEntries(formData.entries())

    console.log('Twilio incoming SMS:', JSON.stringify(payload))

    const from = payload.From || ''
    const body = payload.Body || ''
    const messageSid = payload.MessageSid || ''

    if (!from || !body) {
      return new Response('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Normalize phone
    const phone = from.replace(/[\s\-().]/g, '').trim()

    // Find contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, user_id, phone, opted_in')
      .eq('phone', phone)
      .single()

    const userId = contact?.user_id || null
    const contactId = contact?.id || null

    // Find matching auto-reply rule
    const { data: rules } = await supabase
      .from('auto_reply_rules')
      .select('*')
      .eq('user_id', userId || '')
      .eq('is_active', true)

    let matchedRule: any = null
    const upperBody = body.toUpperCase().trim()

    if (rules) {
      for (const rule of rules) {
        const keyword = rule.keyword.toUpperCase()
        if (rule.match_type === 'exact' && upperBody === keyword) {
          matchedRule = rule
          break
        }
        if (rule.match_type === 'contains' && upperBody.includes(keyword)) {
          matchedRule = rule
          break
        }
        if (rule.match_type === 'starts_with' && upperBody.startsWith(keyword)) {
          matchedRule = rule
          break
        }
      }
    }

    // Store incoming message
    await supabase.from('inbox_messages').insert({
      user_id: userId,
      contact_id: contactId,
      phone,
      direction: 'inbound',
      message: body.substring(0, 1600),
      keyword_detected: matchedRule?.keyword?.toUpperCase() || null,
      auto_reply_sent: !!matchedRule,
      rule_triggered_id: matchedRule?.id || null,
      received_at: new Date().toISOString(),
      is_read: false,
    })

    // Execute actions if rule matched
    if (matchedRule && contactId) {
      // Increment trigger count
      await supabase
        .from('auto_reply_rules')
        .update({ trigger_count: (matchedRule.trigger_count || 0) + 1 })
        .eq('id', matchedRule.id)

      // Process actions
      if (matchedRule.actions && Array.isArray(matchedRule.actions)) {
        for (const action of matchedRule.actions) {
          if (action.type === 'opt_in') {
            await supabase
              .from('contacts')
              .update({
                opted_in: action.value,
                opted_out_date: action.value ? null : new Date().toISOString(),
                opted_in_date: action.value ? new Date().toISOString() : undefined,
              })
              .eq('id', contactId)
          }
          if (action.type === 'add_tag') {
            const { data: c } = await supabase
              .from('contacts')
              .select('tags')
              .eq('id', contactId)
              .single()
            const tags = [...(c?.tags || []), action.tag]
            await supabase
              .from('contacts')
              .update({ tags })
              .eq('id', contactId)
          }
          if (action.type === 'remove_tag') {
            const { data: c } = await supabase
              .from('contacts')
              .select('tags')
              .eq('id', contactId)
              .single()
            const tags = (c?.tags || []).filter((t: string) => t !== action.tag)
            await supabase
              .from('contacts')
              .update({ tags })
              .eq('id', contactId)
          }
        }
      }
    }

    // Build TwiML response
    let twiml = '<Response>'
    if (matchedRule?.response_message) {
      // Fetch Twilio config to send reply
      if (userId) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('twilio_config')
          .eq('id', userId)
          .single()

        if (userProfile?.twilio_config?.accountSid && userProfile?.twilio_config?.senderNumber) {
          // Send auto-reply via Twilio
          const twilioAuth = btoa(
            `${userProfile.twilio_config.accountSid}:${userProfile.twilio_config.authToken}`
          )

          try {
            await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${userProfile.twilio_config.accountSid}/Messages.json`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${twilioAuth}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  From: userProfile.twilio_config.senderNumber,
                  To: phone,
                  Body: matchedRule.response_message,
                }).toString(),
              }
            )

            // Log outbound auto-reply
            await supabase.from('inbox_messages').insert({
              user_id: userId,
              contact_id: contactId,
              phone,
              direction: 'outbound',
              message: matchedRule.response_message,
              auto_reply_sent: true,
              rule_triggered_id: matchedRule.id,
              received_at: new Date().toISOString(),
              is_read: true,
            })
          } catch (err) {
            console.error('Auto-reply send error:', err)
          }
        }
      }
    }
    twiml += '</Response>'

    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    console.error('Incoming SMS error:', error)
    return new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/twilio-incoming/
git commit -m "feat: add twilio-incoming Edge Function for auto-replies"
```

---

### Task 5: Edge Function `track` (link tracking)

**Files:**
- Create: `supabase/functions/track/index.ts`

**Interfaces:**
- Consumes: GET request with tracking_id and redirect URL
- Produces: HTTP redirect, updates `sms_logs.engagement`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/track/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const trackingId = url.searchParams.get('id')
    const redirectUrl = url.searchParams.get('url')

    if (!trackingId) {
      return new Response('Missing tracking ID', { status: 400 })
    }

    // Find the sms_log with this tracking_id
    const { data: smsLog } = await supabase
      .from('sms_logs')
      .select('id, engagement')
      .eq('tracking_id', trackingId)
      .single()

    if (smsLog) {
      const engagement = smsLog.engagement || {}
      const now = new Date().toISOString()

      // First click = "read", subsequent = "clicked"
      if (!engagement.read_at) {
        engagement.read_at = now
      }
      engagement.clicked_at = now
      if (redirectUrl) {
        engagement.clicked_url = redirectUrl
      }

      await supabase
        .from('sms_logs')
        .update({ engagement })
        .eq('id', smsLog.id)
    }

    // Redirect to the original URL or a default
    const target = redirectUrl || 'https://example.com'
    return Response.redirect(target, 302)
  } catch (error) {
    console.error('Track error:', error)
    return Response.redirect('https://example.com', 302)
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/track/
git commit -m "feat: add track Edge Function for SMS link click tracking"
```

---

### Task 6: RLS Policies for Edge Functions

**Files:**
- Create: `supabase/migrations/20260630_rls_edge_functions.sql`

**Interfaces:**
- Consumes: Service role key from Edge Functions
- Produces: RLS policies allowing service_role to insert/update sms_logs

- [ ] **Step 1: Create the migration SQL**

```sql
-- supabase/migrations/20260630_rls_edge_functions.sql
-- Allow Edge Functions (using service_role) to manage sms_logs

-- sms_logs: Edge Functions need to insert and update
DROP POLICY IF EXISTS "Service role can manage sms_logs" ON public.sms_logs;
CREATE POLICY "Service role can manage sms_logs" ON public.sms_logs
  FOR ALL USING (true)
  WITH CHECK (true);

-- inbox_messages: Edge Functions need to insert
DROP POLICY IF EXISTS "Service role can manage inbox" ON public.inbox_messages;
CREATE POLICY "Service role can manage inbox" ON public.inbox_messages
  FOR ALL USING (true)
  WITH CHECK (true);

-- auto_reply_rules: Edge Functions need to read and update trigger_count
DROP POLICY IF EXISTS "Service role can read auto_reply" ON public.auto_reply_rules;
CREATE POLICY "Service role can read auto_reply" ON public.auto_reply_rules
  FOR SELECT USING (true);

-- contacts: Edge Functions need to read and update (for auto-reply actions)
DROP POLICY IF EXISTS "Service role can manage contacts" ON public.contacts;
CREATE POLICY "Service role can manage contacts" ON public.contacts
  FOR ALL USING (true)
  WITH CHECK (true);

-- audit_logs: Edge Functions need to insert
DROP POLICY IF EXISTS "Service role can insert audit" ON public.audit_logs;
CREATE POLICY "Service role can insert audit" ON public.audit_logs
  FOR INSERT WITH CHECK (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260630_rls_edge_functions.sql
git commit -m "feat: add RLS policies for Edge Function access"
```

---

### Task 7: pg_cron for Scheduled Campaigns

**Files:**
- Create: `supabase/migrations/20260630_cron_scheduled_campaigns.sql`

**Interfaces:**
- Consumes: pg_cron extension
- Produces: Automatic status change for due campaigns

- [ ] **Step 1: Create the migration SQL**

```sql
-- supabase/migrations/20260630_cron_scheduled_campaigns.sql
-- Enable pg_cron and pgcrypto extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cron job: check every minute for scheduled campaigns due
SELECT cron.schedule(
  'process-scheduled-campaigns',
  '* * * * *',
  $$
  UPDATE public.campaigns
  SET status = 'sending', sent_at = NOW()
  WHERE status = 'scheduled'
    AND scheduled_at IS NOT NULL
    AND scheduled_at <= NOW();
  $$
);

-- Cron job: clean expired rate_limits every hour
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *',
  $$
  DELETE FROM public.rate_limits WHERE expires_at < NOW();
  $$
);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260630_cron_scheduled_campaigns.sql
git commit -m "feat: add pg_cron for scheduled campaigns and cleanup"
```

---

### Task 8: Update Store — Real Edge Function Calls

**Files:**
- Modify: `src/lib/supabaseClient.ts` — add `getAccessToken()` helper
- Modify: `src/lib/supabase.ts` — add contact CRUD for Supabase
- Modify: `src/store/useStore.ts` — `sendCampaign`, `addContact`, `importContacts`

**Interfaces:**
- Consumes: Supabase JWT token, Edge Function URLs
- Produces: Updated store actions that call real APIs

- [ ] **Step 1: Add `getAccessToken` to supabaseClient.ts**

Add this function after the existing `getSession` function:

```typescript
export async function getAccessToken(): Promise<string | null> {
  const client = getSupabase()
  if (!client) return null
  try {
    const { data } = await client.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Add contact CRUD to supabase.ts**

Add these functions at the end of `src/lib/supabase.ts`:

```typescript
export async function createContactSupabase(contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact | null> {
  return demoGuard(async () => {
    return supabaseRequest<Contact>('contacts', {
      method: 'POST',
      body: contact,
      prefer: 'return=representation',
    })
  }).then(r => r as Contact | null)
}

export async function importContactsSupabase(contacts: Omit<Contact, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
  return demoGuard(async () => {
    const result = await supabaseRequest<Contact[]>('contacts', {
      method: 'POST',
      body: contacts,
      prefer: 'return=representation',
    })
    return Array.isArray(result) ? result.length : 0
  }).then(r => r ?? 0)
}
```

- [ ] **Step 3: Update `sendCampaign` in store**

Replace the `sendCampaign` action in `src/store/useStore.ts`:

```typescript
sendCampaign: async (id) => {
  if (!get().canPerformAction('sendCampaign', 5)) {
    get().addToast({ type: 'error', title: 'Limite d\'envoi atteinte, patientez.' })
    return
  }

  const state = get()

  // Demo mode: keep simulation
  if (state.isDemo) {
    const campaign = state.campaigns.find(c => c.id === id)
    if (!campaign) return
    const targetContacts = state.contacts.filter(c => c.opted_in).slice(0, 50)
    const total = targetContacts.length
    if (total === 0) {
      get().addToast({ type: 'warning', title: 'Aucun contact actif' })
      return
    }
    const failed = Math.floor(total * 0.02)
    const delivered = total - failed

    set(s => ({
      campaigns: s.campaigns.map(c =>
        c.id === id ? {
          ...c, status: 'sending', sent_at: new Date().toISOString(),
          stats: { total_sent: total, total_delivered: 0, total_failed: 0, total_pending: total, total_cost: total * 0.08, delivery_rate: 0 },
        } : c
      ),
    }))

    await new Promise(r => setTimeout(r, 1500))
    set(s => ({
      campaigns: s.campaigns.map(c =>
        c.id === id ? {
          ...c, status: 'sent', completed_at: new Date().toISOString(),
          stats: { total_sent: total, total_delivered: delivered, total_failed: failed, total_pending: 0, total_cost: total * 0.08, delivery_rate: total > 0 ? Math.round((delivered / total) * 10000) / 100 : 0 },
        } : c
      ),
    }))
    return
  }

  // Production: call Edge Function
  const { getAccessToken } = await import('@/lib/supabaseClient')
  const token = await getAccessToken()
  if (!token) {
    get().addToast({ type: 'error', title: 'Non authentifié' })
    return
  }

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    get().addToast({ type: 'error', title: 'Supabase non configuré' })
    return
  }

  // Set campaign to sending
  set(s => ({
    campaigns: s.campaigns.map(c =>
      c.id === id ? { ...c, status: 'sending', sent_at: new Date().toISOString() } : c
    ),
  }))

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-campaign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apikey': (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({ campaign_id: id }),
    })

    const result = await response.json()

    if (result.error) {
      get().addToast({ type: 'error', title: 'Erreur envoi', description: result.error })
      set(s => ({
        campaigns: s.campaigns.map(c =>
          c.id === id ? { ...c, status: 'draft' } : c
        ),
      }))
      return
    }

    // Update campaign with real stats
    set(s => ({
      campaigns: s.campaigns.map(c =>
        c.id === id ? {
          ...c, status: 'sent', completed_at: new Date().toISOString(),
          stats: {
            total_sent: result.sent + result.failed,
            total_delivered: result.sent,
            total_failed: result.failed,
            total_pending: 0,
            total_cost: result.total_cost,
            delivery_rate: (result.sent + result.failed) > 0
              ? Math.round((result.sent / (result.sent + result.failed)) * 10000) / 100
              : 0,
          },
        } : c
      ),
    }))

    get().addToast({
      type: result.failed > 0 ? 'warning' : 'success',
      title: 'Campagne envoyée',
      description: `${result.sent} envoyés, ${result.failed} échoués. Coût: ${result.total_cost.toFixed(2)}€`,
    })
  } catch (err) {
    get().addToast({ type: 'error', title: 'Erreur réseau', description: (err as Error).message })
    set(s => ({
      campaigns: s.campaigns.map(c =>
        c.id === id ? { ...c, status: 'draft' } : c
      ),
    }))
  }
},
```

- [ ] **Step 4: Update `addContact` to sync Supabase**

Replace the `addContact` action:

```typescript
addContact: async (contact) => {
  if (!get().canPerformAction('addContact', 30)) {
    get().addToast({ type: 'error', title: 'Trop d\'ajouts rapides, patientez.' })
    return
  }

  const state = get()

  if (state.isDemo || !isSupabaseConfigured()) {
    // Local mode
    const newContact: Contact = {
      ...contact, id: nextId(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    set(s => ({ contacts: [newContact, ...s.contacts] }))
    return
  }

  // Production: sync to Supabase
  try {
    const { createContactSupabase } = await import('@/lib/supabase')
    const result = await createContactSupabase(contact)
    if (result) {
      set(s => ({ contacts: [result, ...s.contacts] }))
    }
  } catch (err) {
    get().addToast({ type: 'error', title: 'Erreur ajout contact', description: (err as Error).message })
  }
},
```

- [ ] **Step 5: Update `importContacts` to sync Supabase**

Replace the `importContacts` action:

```typescript
importContacts: async (newContacts) => {
  const state = get()

  if (state.isDemo || !isSupabaseConfigured()) {
    // Local mode (existing logic)
    let count = 0
    set(s => {
      const updatedContacts = [...s.contacts]
      const existingPhones = new Set(s.contacts.map(c => c.phone))
      newContacts.forEach(contact => {
        if (!contact.phone || existingPhones.has(contact.phone)) return
        const sanitized = {
          ...contact,
          first_name: escapeHtml(contact.first_name || ''),
          last_name: escapeHtml(contact.last_name || ''),
          email: contact.email?.toLowerCase().trim(),
          city: escapeHtml(contact.city || ''),
        }
        updatedContacts.unshift({
          ...sanitized, id: nextId(),
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        } as Contact)
        count++
        existingPhones.add(contact.phone)
      })
      return { contacts: updatedContacts }
    })
    return count
  }

  // Production: sync to Supabase
  try {
    const { importContactsSupabase } = await import('@/lib/supabase')
    const count = await importContactsSupabase(newContacts)
    // Re-fetch all contacts
    const { fetchContacts } = await import('@/lib/supabase')
    const contacts = await fetchContacts()
    set({ contacts: contacts ?? [] })
    return count
  } catch (err) {
    get().addToast({ type: 'error', title: 'Erreur import', description: (err as Error).message })
    return 0
  }
},
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabaseClient.ts src/lib/supabase.ts src/store/useStore.ts
git commit -m "feat: connect store to real Supabase and Edge Functions"
```

---

### Task 9: Update NewCampaign.tsx — Real Sending & Test SMS

**Files:**
- Modify: `src/pages/NewCampaign.tsx`

**Interfaces:**
- Consumes: Updated store `sendCampaign` action
- Produces: Real SMS test, real campaign sending

- [ ] **Step 1: Update `handleSendTest` to send real SMS**

Replace the `handleSendTest` function:

```typescript
const handleSendTest = async () => {
  if (!testPhone) {
    addToast({ type: 'error', title: 'Numéro requis' })
    return
  }
  if (!form.message.trim()) {
    addToast({ type: 'error', title: 'Message vide' })
    return
  }

  const isDemo = useStore.getState().isDemo
  const isSupabaseCfg = isSupabaseConfigured()

  if (isDemo || !isSupabaseCfg) {
    // Demo mode: simulate
    setTestSent(false)
    setTimeout(() => {
      setTestSent(true)
      addToast({ type: 'success', title: 'SMS test envoyé !', description: `Vérifiez le ${testPhone}` })
    }, 1000)
    return
  }

  // Production: call Edge Function
  try {
    const { getAccessToken } = await import('@/lib/supabaseClient')
    const token = await getAccessToken()
    if (!token) {
      addToast({ type: 'error', title: 'Non authentifié' })
      return
    }

    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
    const response = await fetch(`${supabaseUrl}/functions/v1/send-test-sms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apikey': (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({ phone: testPhone, message: form.message }),
    })

    const result = await response.json()
    if (result.success) {
      setTestSent(true)
      addToast({ type: 'success', title: 'SMS test envoyé !', description: `Vérifiez le ${testPhone}` })
    } else {
      addToast({ type: 'error', title: 'Échec envoi test', description: result.error })
    }
  } catch (err) {
    addToast({ type: 'error', title: 'Erreur réseau', description: (err as Error).message })
  }
}
```

- [ ] **Step 2: Add missing import**

Add `isSupabaseConfigured` to the imports at the top of the file:

```typescript
import { isSupabaseConfigured } from '@/lib/supabaseClient'
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/NewCampaign.tsx
git commit -m "feat: NewCampaign uses real SMS test and real sending"
```

---

### Task 10: Update Settings.tsx — Real Twilio Test

**Files:**
- Modify: `src/pages/Settings.tsx`

**Interfaces:**
- Consumes: `send-test-sms` Edge Function
- Produces: Real Twilio connection test

- [ ] **Step 1: Update `handleTest` in SMSTab**

Replace the `handleTest` function in the `SMSTab` component:

```typescript
const handleTest = async () => {
  if (!isConfigured) {
    addToast({ type: 'error', title: 'Configuration incomplète', description: 'Renseignez SID, Token et numéro' })
    return
  }

  const isDemo = useStore.getState().isDemo
  const isSupabaseCfg = isSupabaseConfigured()

  if (isDemo || !isSupabaseCfg) {
    // Demo: simulate
    setTesting(true)
    await new Promise(r => setTimeout(r, 1500))
    setTesting(false)
    addToast({ type: 'success', title: 'Connexion Twilio OK ✓', description: 'Vos identifiants sont valides' })
    return
  }

  // Production: send real test SMS
  setTesting(true)
  try {
    const { getAccessToken } = await import('@/lib/supabaseClient')
    const token = await getAccessToken()
    if (!token) {
      addToast({ type: 'error', title: 'Non authentifié. Reconnectez-vous.' })
      setTesting(false)
      return
    }

    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
    const response = await fetch(`${supabaseUrl}/functions/v1/send-test-sms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apikey': (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({
        phone: config.senderNumber,
        message: 'SMSPro: Test de connexion Twilio réussi !',
      }),
    })

    const result = await response.json()
    if (result.success) {
      addToast({ type: 'success', title: 'Twilio OK ! SMS de test envoyé', description: `Message SID: ${result.message_sid}` })
    } else {
      addToast({ type: 'error', title: 'Échec Twilio', description: result.error })
    }
  } catch (err) {
    addToast({ type: 'error', title: 'Erreur réseau', description: (err as Error).message })
  } finally {
    setTesting(false)
  }
}
```

- [ ] **Step 2: Add missing import**

Add to imports in Settings.tsx:

```typescript
import { isSupabaseConfigured } from '@/lib/supabaseClient'
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: Settings Twilio test sends real SMS"
```

---

### Task 11: Update Dashboard.tsx — Real Stats from Supabase

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `fetchDashboardStats` from `src/lib/supabase.ts`
- Produces: Real stats displayed on dashboard

- [ ] **Step 1: Update Dashboard to fetch real stats**

The dashboard should attempt to fetch stats from Supabase when available and fall back to local store data. Replace the stats loading logic:

```typescript
// Add at the top of DashboardPage component
const [realStats, setRealStats] = useState<{
  totalContacts: number
  activeContacts: number
  totalCampaigns: number
  totalSent: number
  totalDelivered: number
  totalCost: number
  deliveryRate: number
} | null>(null)

useEffect(() => {
  async function loadRealStats() {
    if (isDemo || !isSupabaseConfigured()) return
    try {
      const { fetchDashboardStats } = await import('@/lib/supabase')
      const stats = await fetchDashboardStats()
      setRealStats(stats)
    } catch {
      // Fallback to local stats
    }
  }
  loadRealStats()
}, [isDemo])
```

Then use `realStats || localStats` when displaying the KPI values.

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: Dashboard reads real stats from Supabase"
```

---

### Task 12: Deployment Instructions & Final Testing

**Files:**
- Modify: `README.md` — add deployment section

**Interfaces:**
- Consumes: All previous tasks completed
- Produces: Documented deployment process

- [ ] **Step 1: Deploy Edge Functions**

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref YOUR-PROJECT-REF

# Deploy all Edge Functions
supabase functions deploy send-campaign
supabase functions deploy send-test-sms
supabase functions deploy twilio-status
supabase functions deploy twilio-incoming
supabase functions deploy track

# Run migrations
supabase db push
```

- [ ] **Step 2: Configure Twilio Webhooks**

In Twilio Console → Phone Numbers → Active Numbers:
1. **Status Callback URL**: `https://YOUR-PROJECT.supabase.co/functions/v1/twilio-status`
2. **A MESSAGE COMES IN**: `https://YOUR-PROJECT.supabase.co/functions/v1/twilio-incoming`

- [ ] **Step 3: Set Vercel Environment Variables**

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 4: Build and test**

```bash
npm run build
npm run preview
```

Test checklist:
- [ ] Login works
- [ ] Add contact manually → appears in Supabase
- [ ] Import CSV contacts → synced to Supabase
- [ ] Create campaign → send test SMS → received on phone
- [ ] Send campaign → all SMS sent via Twilio → sms_logs created
- [ ] Dashboard shows real stats
- [ ] Send STOP → auto-reply received → contact opted out
- [ ] Send INFO → auto-reply received
- [ ] Scheduled campaign → sent automatically at scheduled time

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: production-ready SMSPro with real Twilio integration"
```
