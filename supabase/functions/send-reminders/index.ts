import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('email_notifications', true)
      .eq('automated_reminders', true)

    if (prefsError) throw prefsError
    if (!prefs || prefs.length === 0) {
      return json({ sent: 0, total: 0 })
    }

    const userIds = new Set(prefs.map((p: { user_id: string }) => p.user_id))

    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    if (usersError) throw usersError

    const targets = users.filter((u) => userIds.has(u.id) && u.email)

    let sent = 0
    for (const user of targets) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Budget Book <onboarding@resend.dev>',
          to: user.email,
          subject: 'Budget Book — Your Weekly Reminders',
          html: emailHtml(),
        }),
      })
      if (res.ok) sent++
    }

    return json({ sent, total: targets.length })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function emailHtml() {
  const appUrl = 'YOUR_APP_URL'
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F8F7F5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7F5;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);overflow:hidden;">
        <tr><td style="background:linear-gradient(90deg,#3B7DD8,#4CAF82);height:4px;"></td></tr>
        <tr><td style="padding:40px 40px 36px;">

          <!-- Logo -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td style="width:38px;height:38px;background:#3B7DD8;border-radius:10px;
                         text-align:center;vertical-align:middle;">
                <span style="color:#fff;font-weight:800;font-size:18px;line-height:38px;">B</span>
              </td>
              <td style="padding-left:12px;font-size:16px;font-weight:700;
                         color:#1A1A2E;letter-spacing:-0.02em;">Budget Book</td>
            </tr>
          </table>

          <h2 style="color:#1A1A2E;font-size:22px;font-weight:700;
                     margin:0 0 8px;letter-spacing:-0.02em;">Weekly Reminder</h2>
          <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 28px;">
            Here are a couple of things to take care of this week to keep your finances up to date.
          </p>

          <!-- Item 1 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr><td style="background:#F8F7F5;border-radius:14px;padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1A1A2E;">Upload your latest CSV</p>
              <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.5;">
                Import your most recent bank export to keep your transaction history current.
              </p>
            </td></tr>
          </table>

          <!-- Item 2 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td style="background:#F8F7F5;border-radius:14px;padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1A1A2E;">Review your bills</p>
              <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.5;">
                Check that your recurring bills are accurate and up to date.
              </p>
            </td></tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td align="center">
              <a href="${appUrl}" target="_blank"
                style="display:inline-block;background:#3B7DD8;color:#fff;font-size:14px;
                       font-weight:600;text-decoration:none;padding:14px 32px;
                       border-radius:999px;letter-spacing:-0.01em;">
                Log in to Budget Book
              </a>
            </td></tr>
          </table>

          <p style="color:#9CA3AF;font-size:12px;margin:0;line-height:1.6;">
            You are receiving this email because automated reminders are enabled in your Budget Book account settings.
          </p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
