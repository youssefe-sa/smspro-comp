// Supabase Edge Function: Twilio delivery status webhook
// Deploy with: supabase functions deploy twilio-status

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Map Twilio status to our internal status
function mapTwilioStatus(twilioStatus: string): string {
  switch (twilioStatus.toLowerCase()) {
    case 'delivered':
      return 'delivered'
    case 'failed':
    case 'undelivered':
      return 'failed'
    case 'sent':
      return 'sent'
    case 'queued':
    case 'accepted':
    case 'pending':
      return 'queued'
    default:
      return twilioStatus.toLowerCase()
  }
}

Deno.serve(async (req) => {
  // Always return 200 to prevent Twilio retries
  try {
    if (req.method !== 'POST') {
      console.warn('Non-POST request received')
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const contentType = req.headers.get('content-type') || ''
    let payload: any

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData()
      payload = Object.fromEntries(formData.entries())
    } else if (contentType.includes('application/json')) {
      payload = await req.json()
    } else {
      console.warn('Unsupported content type:', contentType)
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('Twilio webhook:', payload)

    if (!payload.MessageSid || !payload.MessageStatus) {
      console.warn('Missing required fields:', payload)
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const twilioStatus = payload.MessageStatus
    const mappedStatus = mapTwilioStatus(twilioStatus)
    const updates: Record<string, any> = { status: mappedStatus }

    if (mappedStatus === 'delivered') {
      updates.delivered_at = new Date().toISOString()
    } else if (mappedStatus === 'failed') {
      updates.failed_at = new Date().toISOString()
      if (payload.ErrorCode) updates.error_code = payload.ErrorCode
      if (payload.ErrorMessage) updates.error_message = payload.ErrorMessage
    }

    const { error } = await supabase
      .from('sms_logs')
      .update(updates)
      .eq('message_sid', payload.MessageSid)

    if (error) {
      console.error('Update error:', error)
      // Still return 200 to prevent Twilio retries
    }

    // Insert audit log entry
    const { error: auditError } = await supabase.from('audit_logs').insert({
      action: 'twilio_webhook',
      entity_type: 'sms_log',
      details: payload,
    })

    if (auditError) {
      console.error('Audit log error:', auditError)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    // Always return 200 to prevent Twilio retries
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
