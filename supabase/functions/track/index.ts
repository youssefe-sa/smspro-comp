import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const trackingId = url.searchParams.get('id')
    const redirectUrl = url.searchParams.get('url')

    if (!trackingId) {
      return new Response(null, { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: smsLog, error: fetchError } = await supabase
      .from('sms_logs')
      .select('id, engagement')
      .eq('tracking_id', trackingId)
      .single()

    if (fetchError || !smsLog) {
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl || 'https://example.com' },
      })
    }

    const now = new Date().toISOString()
    const engagement = smsLog.engagement || {}

    const updates: Record<string, any> = { clicked_at: now }

    if (!engagement.read_at) {
      updates.read_at = now
    }

    if (redirectUrl) {
      updates.clicked_url = redirectUrl
    }

    const updatedEngagement = { ...engagement, ...updates }

    await supabase
      .from('sms_logs')
      .update({ engagement: updatedEngagement, status: 'clicked' })
      .eq('id', smsLog.id)

    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl || 'https://example.com' },
    })
  } catch (error) {
    console.error('Track error:', error)
    return new Response(null, {
      status: 302,
      headers: { Location: 'https://example.com' },
    })
  }
})
