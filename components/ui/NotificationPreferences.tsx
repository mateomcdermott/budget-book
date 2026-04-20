'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle } from 'lucide-react'

const card: React.CSSProperties = {
  background: 'var(--color-card)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--color-border-solid)',
  padding: '28px 32px',
  marginBottom: 20,
}

const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
  color: 'var(--color-text-1)', letterSpacing: '-0.01em', marginBottom: 4,
}

const sectionSub: React.CSSProperties = {
  fontSize: 13, color: 'var(--color-text-2)', marginBottom: 24,
}

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      style={{
        width: 44, height: 24, borderRadius: 999, border: 'none',
        background: on ? 'var(--color-primary)' : 'var(--color-border-solid)',
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: on ? 'calc(100% - 21px)' : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', display: 'block',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

type PrefKey = 'email_notifications' | 'automated_reminders'

export default function NotificationPreferences() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [autoReminders, setAutoReminders] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      setUserId(uid)

      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('email_notifications, automated_reminders')
        .eq('user_id', uid)
        .single()

      if (prefs) {
        setEmailNotifs(prefs.email_notifications)
        setAutoReminders(prefs.automated_reminders)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleToggle(key: PrefKey, current: boolean) {
    if (!userId) return
    const next = !current
    if (key === 'email_notifications') setEmailNotifs(next)
    else setAutoReminders(next)

    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('notification_preferences')
      .upsert(
        { user_id: userId, [key]: next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    setSaving(false)

    if (err) {
      if (key === 'email_notifications') setEmailNotifs(current)
      else setAutoReminders(current)
      setError(err.message)
    }
  }

  const rows: { key: PrefKey; label: string; desc: string; value: boolean }[] = [
    {
      key: 'email_notifications',
      label: 'Email Notifications',
      desc: 'Receive an email when a new notification is generated.',
      value: emailNotifs,
    },
    {
      key: 'automated_reminders',
      label: 'Automated Email Reminders',
      desc: 'Get weekly reminders to upload your CSV and verify your bills.',
      value: autoReminders,
    },
  ]

  return (
    <div style={card}>
      <p style={sectionTitle}>Notifications</p>
      <p style={sectionSub}>Manage which emails you receive from Budget Book.</p>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row, i) => (
          <div
            key={row.key}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 0',
              borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <div style={{ paddingRight: 24 }}>
              <p style={{
                fontSize: 14, fontWeight: 600, color: 'var(--color-text-1)',
                fontFamily: 'var(--font-body)', marginBottom: 2,
              }}>{row.label}</p>
              <p style={{
                fontSize: 13, color: 'var(--color-text-2)',
                fontFamily: 'var(--font-body)',
              }}>{row.desc}</p>
            </div>
            <Toggle on={row.value} onToggle={() => handleToggle(row.key, row.value)} disabled={saving} />
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 10, marginTop: 12,
          background: 'var(--color-expense-light)', color: 'var(--color-expense)',
          fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500,
        }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  )
}
