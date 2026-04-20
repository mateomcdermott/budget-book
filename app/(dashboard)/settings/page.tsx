import ProfileSettings from '@/components/ui/ProfileSettings'
import NotificationPreferences from '@/components/ui/NotificationPreferences'

const groupLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-text-3)',
  fontFamily: 'var(--font-body)', marginBottom: 14,
}

export default function SettingsPage() {
  return (
    <div style={{ padding: '24px', maxWidth: 680, margin: '0 auto' }}>
      <p style={groupLabel}>Account Settings</p>
      <ProfileSettings hideWrapper />
      <p style={{ ...groupLabel, marginTop: 28 }}>Notifications</p>
      <NotificationPreferences />
    </div>
  )
}
