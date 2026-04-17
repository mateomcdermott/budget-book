'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function SignupPage() {
  const router = useRouter()

  const [email, setEmail]                   = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw]                 = useState(false)
  const [showConfirmPw, setShowConfirmPw]   = useState(false)
  const [emailErr, setEmailErr]             = useState('')
  const [passErr, setPassErr]               = useState('')
  const [confirmErr, setConfirmErr]         = useState('')
  const [serverErr, setServerErr]           = useState('')
  const [loading, setLoading]               = useState(false)
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailErr('')
    setPassErr('')
    setConfirmErr('')
    setServerErr('')

    let valid = true
    if (!isValidEmail(email)) {
      setEmailErr('Please enter a valid email address.')
      valid = false
    }
    if (password.length < 8) {
      setPassErr('Password must be at least 8 characters.')
      valid = false
    }
    if (password !== confirmPassword) {
      setConfirmErr("Passwords don't match.")
      valid = false
    }
    if (!valid) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      router.push(`/verify?email=${encodeURIComponent(email)}`)
    } catch (err: unknown) {
      setServerErr(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 460, padding: '0 24px' }}>
      <div className="auth-card auth-card-no-bar auth-card-pad" style={{ padding: '48px 40px 40px' }}>

        {/* ── Logo ── */}
        <div
          className="animate-fade-up"
          style={{ animationDelay: '0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
            fontFamily: 'var(--font-display)',
            fontWeight: 800, fontSize: 22, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(59,125,216,0.22)',
          }}>
            B
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 22,
            color: 'var(--color-text-1)',
            letterSpacing: '-0.02em',
          }}>
            Budget Book
          </span>
        </div>

        {/* ── Heading ── */}
        <h1
          className="animate-fade-up"
          style={{
            animationDelay: '0.15s',
            fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 26, lineHeight: 1.25,
            color: 'var(--color-text-1)',
            marginBottom: 6, letterSpacing: '-0.02em',
            textAlign: 'center',
          }}
        >
          Create your account
        </h1>
        <p
          className="animate-fade-up"
          style={{
            animationDelay: '0.2s',
            fontSize: 14.5, color: 'var(--color-text-2)',
            marginBottom: serverErr ? 20 : 28, lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          Free forever. Your data stays private.
        </p>

        {/* ── Server / auth error ── */}
        {serverErr && (
          <div style={{
            fontSize: 13.5,
            color: 'var(--color-expense)',
            background: 'var(--color-expense-light)',
            border: '1px solid rgba(224,112,96,0.18)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 20,
            lineHeight: 1.45,
          }}>
            {serverErr}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* ── Email ── */}
          <div className="animate-fade-up" style={{ animationDelay: '0.22s', marginBottom: 18 }}>
            <label
              htmlFor="signup-email"
              style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 7, letterSpacing: '0.01em' }}
            >
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              className={`form-input${emailErr ? ' input-error' : ''}`}
              value={email}
              onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
            {emailErr && (
              <p style={{ fontSize: 12.5, color: 'var(--color-expense)', marginTop: 6, lineHeight: 1.4 }}>
                {emailErr}
              </p>
            )}
          </div>

          {/* ── Password ── */}
          <div className="animate-fade-up" style={{ animationDelay: '0.28s', marginBottom: 18 }}>
            <label
              htmlFor="signup-password"
              style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 7, letterSpacing: '0.01em' }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-password"
                type={showPw ? 'text' : 'password'}
                className={`form-input${passErr ? ' input-error' : ''}`}
                style={{ paddingRight: 46 }}
                value={password}
                onChange={e => { setPassword(e.target.value); if (passErr) setPassErr('') }}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-3)', padding: 4,
                  display: 'flex', alignItems: 'center',
                  transition: 'color 0.2s',
                }}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passErr && (
              <p style={{ fontSize: 12.5, color: 'var(--color-expense)', marginTop: 6, lineHeight: 1.4 }}>
                {passErr}
              </p>
            )}
          </div>

          {/* ── Confirm Password ── */}
          <div className="animate-fade-up" style={{ animationDelay: '0.34s', marginBottom: 18 }}>
            <label
              htmlFor="signup-confirm"
              style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 7, letterSpacing: '0.01em' }}
            >
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-confirm"
                type={showConfirmPw ? 'text' : 'password'}
                className={`form-input${confirmErr ? ' input-error' : ''}`}
                style={{ paddingRight: 46 }}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); if (confirmErr) setConfirmErr('') }}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(v => !v)}
                aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-3)', padding: 4,
                  display: 'flex', alignItems: 'center',
                  transition: 'color 0.2s',
                }}
              >
                {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmErr && (
              <p style={{ fontSize: 12.5, color: 'var(--color-expense)', marginTop: 6, lineHeight: 1.4 }}>
                {confirmErr}
              </p>
            )}
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            className="btn-primary animate-fade-up"
            style={{ animationDelay: '0.4s' }}
            disabled={loading}
          >
            {loading ? (
              <span className="btn-spinner" />
            ) : (
              <>
                <span>Get started</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

        </form>

        {/* ── Divider ── */}
        <div
          className="animate-fade-up"
          style={{
            animationDelay: '0.44s',
            display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0',
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--color-border-solid)' }} />
          <span style={{ fontSize: 13, color: 'var(--color-text-3)', flexShrink: 0 }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border-solid)' }} />
        </div>

        {/* ── Google button ── */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="animate-fade-up"
          style={{
            animationDelay: '0.48s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', height: 48,
            border: '1.5px solid var(--color-border-solid)',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-card)',
            color: 'var(--color-text-1)',
            fontFamily: 'var(--font-body)',
            fontWeight: 600, fontSize: 15,
            cursor: 'pointer',
            transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 3px var(--color-primary-ring)'
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-solid)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.84l6.1-6.1C34.46 3.19 29.5 1 24 1 14.82 1 7.07 6.48 3.64 14.22l7.1 5.52C12.4 13.67 17.73 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.7c-.55 2.96-2.2 5.47-4.67 7.16l7.2 5.6C43.1 37.27 46.52 31.36 46.52 24.5z"/>
            <path fill="#FBBC05" d="M10.74 28.26A14.53 14.53 0 0 1 9.5 24c0-1.48.26-2.91.74-4.26l-7.1-5.52A23.94 23.94 0 0 0 0 24c0 3.86.92 7.5 2.56 10.72l8.18-6.46z"/>
            <path fill="#34A853" d="M24 47c5.5 0 10.12-1.82 13.5-4.94l-7.2-5.6c-1.83 1.23-4.18 1.95-6.3 1.95-6.27 0-11.6-4.17-13.26-9.74l-8.18 6.46C7.07 41.52 14.82 47 24 47z"/>
          </svg>
          Continue with Google
        </button>

        {/* ── Footer link ── */}
        <div
          className="animate-fade-up"
          style={{
            animationDelay: '0.5s',
            textAlign: 'center', marginTop: 22,
            fontSize: 14, color: 'var(--color-text-2)',
          }}
        >
          Already have an account?{' '}
          <Link
            href="/login"
            style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}
          >
            Sign in
          </Link>
        </div>

      </div>
    </div>
  )
}
