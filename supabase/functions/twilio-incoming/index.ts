import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-().]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('00') && cleaned.length >= 10) {
    return '+' + cleaned.substring(2)
  }
  if (/^1\d{9,10}$/.test(cleaned)) return '+' + cleaned
  if (/^0\d+$/.test(cleaned) && cleaned.length >= 8 && cleaned.length <= 15) {
    const prefix = cleaned.substring(0, 2)
    if (['02', '03', '04'].includes(prefix)) return '+32' + cleaned.substring(2)
    if (['06', '07'].includes(prefix)) return '+33' + cleaned.substring(1)
    if (prefix === '05') return '+212' + cleaned.substring(1)
    return '+32' + cleaned.substring(1)
  }
  return cleaned
}

function matchKeyword(message: string, keyword: string, matchType: string, caseSensitive: boolean): boolean {
  const msg = caseSensitive ? message : message.toLowerCase()
  const kw = caseSensitive ? keyword : keyword.toLowerCase()
  switch (matchType) {
    case 'exact': return msg === kw
    case 'contains': return msg.includes(kw)
    case 'starts_with': return msg.startsWith(kw)
    default: return false
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

Deno.serve(async (req) => {
  const twiml = (body: string) =>
    new Response(`<Response>${body}</Response>`, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })

  try {
    if (req.method !== 'POST') {
      return twiml('')
    }

    const formData = await req.formData()
    const payload = Object.fromEntries(formData.entries())

    const from = payload.From
    const body = payload.Body
    const messageSid = payload.MessageSid

    if (!from || !body) {
      console.warn('Missing From or Body in Twilio payload')
      return twiml('')
    }

    const phone = normalizePhone(from)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: contact } = await supabase
      .from('contacts')
      .select('id, user_id')
      .eq('phone', phone)
      .single()

    const userId = contact?.user_id ?? null

    let matchedRule: any = null

    if (userId) {
      const { data: rules } = await supabase
        .from('auto_reply_rules')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (rules && rules.length > 0) {
        for (const rule of rules) {
          if (matchKeyword(body, rule.keyword, rule.match_type, rule.case_sensitive)) {
            matchedRule = rule
            break
          }
        }
      }
    }

    if (matchedRule) {
      await supabase.from('inbox_messages').insert({
        user_id: userId,
        contact_id: contact?.id ?? null,
        phone,
        direction: 'inbound',
        message: body,
        keyword_detected: matchedRule.keyword,
        auto_reply_sent: true,
        rule_triggered_id: matchedRule.id,
      })

      if (matchedRule.actions && Array.isArray(matchedRule.actions)) {
        for (const action of matchedRule.actions) {
          if (action.type === 'opt_in' && contact?.id) {
            await supabase.from('contacts').update({
              opted_in: action.value,
              ...(action.value
                ? { opted_in_date: new Date().toISOString() }
                : { opted_out_date: new Date().toISOString() }),
            }).eq('id', contact.id)
          } else if (action.type === 'add_tag' && contact?.id) {
            const { data: current } = await supabase
              .from('contacts')
              .select('tags')
              .eq('id', contact.id)
              .single()
            const tags = current?.tags ?? []
            if (!tags.includes(action.tag)) {
              await supabase.from('contacts').update({
                tags: [...tags, action.tag],
              }).eq('id', contact.id)
            }
          } else if (action.type === 'remove_tag' && contact?.id) {
            const { data: current } = await supabase
              .from('contacts')
              .select('tags')
              .eq('id', contact.id)
              .single()
            const tags = current?.tags ?? []
            await supabase.from('contacts').update({
              tags: tags.filter((t: string) => t !== action.tag),
            }).eq('id', contact.id)
          }
        }
      }

      const { data: userData } = await supabase
        .from('users')
        .select('twilio_config')
        .eq('id', userId)
        .single()

      if (userData?.twilio_config) {
        const { accountSid, authToken, senderNumber } = userData.twilio_config
        const twilioAuth = btoa(`${accountSid}:${authToken}`)

        const twilioForm = new URLSearchParams()
        twilioForm.append('From', senderNumber)
        twilioForm.append('To', phone)
        twilioForm.append('Body', matchedRule.response_message)

        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: twilioForm.toString(),
          }
        )

        const twilioData = await twilioResponse.json()

        if (twilioResponse.ok) {
          await supabase.from('inbox_messages').insert({
            user_id: userId,
            contact_id: contact?.id ?? null,
            phone,
            direction: 'outbound',
            message: matchedRule.response_message,
          })
        } else {
          console.error('Twilio send error:', twilioData)
        }
      }
    } else {
      await supabase.from('inbox_messages').insert({
        user_id: userId,
        contact_id: contact?.id ?? null,
        phone,
        direction: 'inbound',
        message: body,
        auto_reply_sent: false,
      })
    }

    return twiml('')
  } catch (error) {
    console.error('twilio-incoming error:', error)
    return twiml('')
  }
})
