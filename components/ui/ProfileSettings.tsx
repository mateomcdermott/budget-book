'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Check, AlertCircle } from 'lucide-react'

const inputStyle: React.CSSProperties = {
  height: 44, borderRadius: 'var(--radius-input)',
  border: '1.5px solid var(--color-border-solid)',
  background: 'var(--color-bg)', padding: '0 14px',
  fontSize: 14, fontFamily: 'var(--font-body)',
  color: 'var(--color-text-1)', outline: 'none',
  width: '100%', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)',
  fontFamily: 'var(--font-body)', display: 'block', marginBottom: 6,
}

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

function Feedback({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px', borderRadius: 10, marginTop: 12,
      background: type === 'success' ? 'var(--color-income-light)' : 'var(--color-expense-light)',
      color: type === 'success' ? 'var(--color-income)' : 'var(--color-expense)',
      fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500,
    }}>
      {type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
      {msg}
    </div>
  )
}

export default function ProfileSettings({ hideWrapper = false }: { hideWrapper?: boolean }) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [photoFeedback, setPhotoFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwFeedback, setPwFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [infoSaving, setInfoSaving] = useState(false)
  const [infoFeedback, setInfoFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) return
      setEmail(u.email ?? '')
      setDisplayName(u.user_metadata?.display_name ?? '')
      setAvatarUrl(u.user_metadata?.avatar_url ?? null)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSaveInfo() {
    setInfoSaving(true)
    setInfoFeedback(null)
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName },
    })
    setInfoSaving(false)
    setInfoFeedback(error
      ? { type: 'error', msg: error.message }
      : { type: 'success', msg: 'Account information updated.' }
    )
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setPhotoFeedback(null)

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) { setUploading(false); return }

    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (upErr) {
      setPhotoFeedback({ type: 'error', msg: 'Upload failed: ' + upErr.message })
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = urlData.publicUrl + `?t=${Date.now()}`

    await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
    setAvatarUrl(publicUrl)
    setPhotoFeedback({ type: 'success', msg: 'Profile photo updated.' })
    setUploading(false)
    e.target.value = ''
  }

  async function handlePasswordChange() {
    setPwFeedback(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwFeedback({ type: 'error', msg: 'All password fields are required.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwFeedback({ type: 'error', msg: 'New passwords do not match.' })
      return
    }
    if (newPassword.length < 6) {
      setPwFeedback({ type: 'error', msg: 'New password must be at least 6 characters.' })
      return
    }

    setPwSaving(true)

    // Verify current password
    const { data: userData } = await supabase.auth.getUser()
    const userEmail = userData.user?.email
    if (!userEmail) {
      setPwFeedback({ type: 'error', msg: 'Could not verify current user.' })
      setPwSaving(false)
      return
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    })

    if (signInErr) {
      setPwFeedback({ type: 'error', msg: 'Current password is incorrect.' })
      setPwSaving(false)
      return
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)

    if (updateErr) {
      setPwFeedback({ type: 'error', msg: updateErr.message })
    } else {
      setPwFeedback({ type: 'success', msg: 'Password updated successfully.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const cards = (
    <>

      {/* ── Profile Photo ───────────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>Profile Photo</p>
        <p style={sectionSub}>Upload a photo to personalise your account.</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            border: '2px solid var(--color-border-solid)',
            overflow: 'hidden', flexShrink: 0,
            background: 'var(--color-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Camera size={28} style={{ color: 'var(--color-text-3)' }} />
            )}
          </div>

          <div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                height: 40, padding: '0 20px', borderRadius: 'var(--radius-pill)',
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', fontWeight: 600, fontSize: 13,
                fontFamily: 'var(--font-body)', cursor: 'pointer',
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? 'Uploading…' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 6 }}>
              JPG, PNG, or GIF. Max 5MB.
            </p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />

        {photoFeedback && <Feedback type={photoFeedback.type} msg={photoFeedback.msg} />}
      </div>

      {/* ── Account Information ─────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>Account Information</p>
        <p style={sectionSub}>Update your display name. Email cannot be changed here.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
              value={email}
              readOnly
            />
          </div>
          <div>
            <label style={labelStyle}>Display Name</label>
            <input
              style={inputStyle}
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleSaveInfo}
          disabled={infoSaving}
          style={{
            marginTop: 20, height: 44, padding: '0 28px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-primary)', color: '#fff',
            border: 'none', fontWeight: 600, fontSize: 14,
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            opacity: infoSaving ? 0.6 : 1,
          }}
        >
          {infoSaving ? 'Saving…' : 'Save Changes'}
        </button>

        {infoFeedback && <Feedback type={infoFeedback.type} msg={infoFeedback.msg} />}
      </div>

      {/* ── Change Password ─────────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>Change Password</p>
        <p style={sectionSub}>You must verify your current password before setting a new one.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Current Password</label>
            <input
              style={inputStyle}
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>New Password</label>
            <input
              style={inputStyle}
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <input
              style={inputStyle}
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handlePasswordChange}
          disabled={pwSaving}
          style={{
            marginTop: 20, height: 44, padding: '0 28px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-primary)', color: '#fff',
            border: 'none', fontWeight: 600, fontSize: 14,
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            opacity: pwSaving ? 0.6 : 1,
          }}
        >
          {pwSaving ? 'Updating…' : 'Update Password'}
        </button>

        {pwFeedback && <Feedback type={pwFeedback.type} msg={pwFeedback.msg} />}
      </div>

    </>
  )

  if (hideWrapper) return cards
  return (
    <div style={{ padding: '24px', maxWidth: 680, margin: '0 auto' }}>
      {cards}
    </div>
  )
}
