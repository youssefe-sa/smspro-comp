# Review package: 21c5123331f3690d4203240fab1e6ac904303b38..ab35152d9b967929d874e55658fb09540f3f36a4

## Commits
ab35152 feat: add send-campaign Edge Function for Twilio SMS

## Files changed
 supabase/functions/send-campaign/cors.ts  |   4 +  supabase/functions/send-campaign/index.ts | 246 ++++++++++++++++++++++++++++++  2 files changed, 250 insertions(+)

## Diff
diff --git a/supabase/functions/send-campaign/cors.ts b/supabase/functions/send-campaign/cors.ts
new file mode 100644
index 0000000..fd9401f
--- /dev/null
+++ b/supabase/functions/send-campaign/cors.ts
@@ -0,0 +1,4 @@
+export const corsHeaders = {
+  'Access-Control-Allow-Origin': '*',
+  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
+}
\ No newline at end of file
diff --git a/supabase/functions/send-campaign/index.ts b/supabase/functions/send-campaign/index.ts
new file mode 100644
index 0000000..b696aa6
--- /dev/null
+++ b/supabase/functions/send-campaign/index.ts
@@ -0,0 +1,246 @@
+import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
+import { corsHeaders } from './cors.ts'
+
+Deno.serve(async (req) => {
+  if (req.method === 'OPTIONS') {
+    return new Response('ok', { headers: corsHeaders })
+  }
+
+  try {
+    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
+    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
+    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
+
+    const authHeader = req.headers.get('Authorization')
+    if (!authHeader) {
+      return new Response(
+        JSON.stringify({ error: 'Missing authorization header' }),
+        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
+      )
+    }
+
+    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
+      global: { headers: { Authorization: authHeader } },
+    })
+
+    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
+    if (authError || !user) {
+      return new Response(
+        JSON.stringify({ error: 'Unauthorized' }),
+        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
+      )
+    }
+
+    const { campaign_id } = await req.json()
+    if (!campaign_id) {
+      return new Response(
+        JSON.stringify({ error: 'Missing campaign_id' }),
+        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
+      )
+    }
+
+    const supabase = createClient(supabaseUrl, supabaseServiceKey)
+
+    const { data: campaign, error: campaignError } = await supabase
+      .from('campaigns')
+      .select('*')
+      .eq('id', campaign_id)
+      .eq('user_id', user.id)
+      .single()
+
+    if (campaignError || !campaign) {
+      return new Response(
+        JSON.stringify({ error: 'Campaign not found' }),
+        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
+      )
+    }
+
+    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
+      return new Response(
+        JSON.stringify({ error: 'Campaign already sent or in progress' }),
+        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
+      )
+    }
+
+    const { data: userData, error: userError } = await supabase
+      .from('users')
+      .select('twilio_config')
+      .eq('id', user.id)
+      .single()
+
+    if (userError || !userData?.twilio_config) {
+      return new Response(
+        JSON.stringify({ error: 'Twilio configuration not found' }),
+        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
+      )
+    }
+
+    const { accountSid, authToken, senderNumber } = userData.twilio_config
+
+    let contactsQuery = supabase
+      .from('contacts')
+      .select('*')
+      .eq('user_id', user.id)
+      .eq('opted_in', true)
+
+    if (campaign.segment_id) {
+      const { data: segment, error: segmentError } = await supabase
+        .from('segments')
+        .select('conditions')
+        .eq('id', campaign.segment_id)
+        .single()
+
+      if (segmentError || !segment) {
+        return new Response(
+          JSON.stringify({ error: 'Segment not found' }),
+          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
+        )
+      }
+
+      const conditions = segment.conditions
+      if (conditions.city) {
+        contactsQuery = contactsQuery.eq('city', conditions.city)
+      }
+      if (conditions.tags && conditions.tags.length > 0) {
+        contactsQuery = contactsQuery.overlaps('tags', conditions.tags)
+      }
+    }
+
+    const { data: contacts, error: contactsError } = await contactsQuery
+
+    if (contactsError) {
+      return new Response(
+        JSON.stringify({ error: 'Failed to fetch contacts' }),
+        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
+      )
+    }
+
+    if (!contacts || contacts.length === 0) {
+      return new Response(
+        JSON.stringify({ error: 'No contacts found for this campaign' }),
+        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
+      )
+    }
+
+    await supabase
+      .from('campaigns')
+      .update({ status: 'sending' })
+      .eq('id', campaign_id)
+
+    let sent = 0
+    let failed = 0
+    let totalCost = 0
+    const errors: Array<{ phone: string; error: string }> = []
+
+    const statusCallback = `${supabaseUrl}/functions/v1/twilio-status`
+
+    for (const contact of contacts) {
+      try {
+        let messageBody = campaign.message
+          .replace(/{prenom}/g, contact.first_name || '')
+          .replace(/{nom}/g, contact.last_name || '')
+          .replace(/{ville}/g, contact.city || '')
+
+        const trackingId = 'trk_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16)
+
+        const twilioAuth = btoa(`${accountSid}:${authToken}`)
+
+        const formData = new URLSearchParams()
+        formData.append('From', senderNumber)
+        formData.append('To', contact.phone)
+        formData.append('Body', messageBody)
+        formData.append('StatusCallback', statusCallback)
+
+        const twilioResponse = await fetch(
+          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
+          {
+            method: 'POST',
+            headers: {
+              'Authorization': `Basic ${twilioAuth}`,
+              'Content-Type': 'application/x-www-form-urlencoded',
+            },
+            body: formData.toString(),
+          }
+        )
+
+        const twilioData = await twilioResponse.json()
+
+        if (twilioResponse.ok) {
+          const { error: insertError } = await supabase.from('sms_logs').insert({
+            campaign_id: campaign_id,
+            contact_id: contact.id,
+            phone: contact.phone,
+            message: messageBody,
+            message_sid: twilioData.sid,
+            status: 'sent',
+            cost: 0.08,
+            tracking_id: trackingId,
+            sent_at: new Date().toISOString(),
+          })
+
+          if (insertError) {
+            console.error('Failed to insert sms_log:', insertError)
+            errors.push({ phone: contact.phone, error: insertError.message })
+            failed++
+          } else {
+            sent++
+            totalCost += 0.08
+          }
+        } else {
+          console.error('Twilio error:', twilioData)
+          const { error: insertError } = await supabase.from('sms_logs').insert({
+            campaign_id: campaign_id,
+            contact_id: contact.id,
+            phone: contact.phone,
+            message: messageBody,
+            status: 'failed',
+            error_code: twilioData.code?.toString() || 'UNKNOWN',
+            error_message: twilioData.message || 'Unknown error',
+            cost: 0,
+            tracking_id: trackingId,
+          })
+
+          if (insertError) {
+            console.error('Failed to insert error sms_log:', insertError)
+          }
+          errors.push({ phone: contact.phone, error: twilioData.message || 'Unknown error' })
+          failed++
+        }
+      } catch (error) {
+        console.error('Error sending to', contact.phone, error)
+        errors.push({ phone: contact.phone, error: (error as Error).message })
+        failed++
+      }
+
+      await new Promise((resolve) => setTimeout(resolve, 100))
+    }
+
+    await supabase
+      .from('campaigns')
+      .update({
+        status: 'sent',
+        sent_at: new Date().toISOString(),
+        completed_at: new Date().toISOString(),
+      })
+      .eq('id', campaign_id)
+
+    await supabase.from('audit_logs').insert({
+      user_id: user.id,
+      action: 'campaign_sent',
+      entity_type: 'campaign',
+      entity_id: campaign_id,
+      details: { sent, failed, total_cost: totalCost },
+    })
+
+    return new Response(
+      JSON.stringify({ sent, failed, total_cost: totalCost, errors }),
+      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
+    )
+  } catch (error) {
+    console.error('Campaign send error:', error)
+    return new Response(
+      JSON.stringify({ error: (error as Error).message }),
+      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
+    )
+  }
+})
\ No newline at end of file

