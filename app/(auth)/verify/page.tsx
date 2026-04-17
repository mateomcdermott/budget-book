'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  const [digits, setDigits]             = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState(false)
  const [shake, setShake]               = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendMsg, setResendMsg]       = useState('')
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null))
  // Track if auto-submit is in progress to avoid double-fire
  const submitting = useRef(false)

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (digits.every(d => d !== '') && !submitting.current) {
      submitting.current = true
      verify(digits.join(''))
    }
  }, [digits])

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  async function verify(token: string) {
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 1400)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code. Please try again.'
      setError(msg)
      setShake(true)
      setTimeout(() => {
        setShake(false)
        submitting.current = false
      }, 600)
      setDigits(Array(6).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const char = value.slice(-1)
    const next = [...digits]
    next[index] = char
    setDigits(next)
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ''
        setDigits(next)
      } else if (index > 0) {
        const next = [...digits]
        next[index - 1] = ''
        setDigits(next)
        inputRefs.current[index - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = Array(6).fill('')
    pasted.split('').forEach((c, i) => { next[i] = c })
    setDigits(next)
    const focusIndex = Math.min(pasted.length, 5)
    inputRefs.current[focusIndex]?.focus()
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    try {
      const { error } = await supabase.auth.resend({ email, type: 'signup' })
      if (error) throw error
      setResendMsg('Code sent!')
      setResendCooldown(30)
      setTimeout(() => setResendMsg(''), 3000)
    } catch {
      setResendMsg('Failed to resend. Try again.')
      setTimeout(() => setResendMsg(''), 3000)
    }
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 460, padding: '0 24px' }}>
      <div className="auth-card auth-card-no-bar auth-card-pad" style={{ padding: '48px 40px 40px', position: 'relative' }}>

        {/* ── Success overlay ── */}
        {success && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'var(--color-card)',
            borderRadius: 'var(--radius-card)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
            animation: 'fadeUp 0.3s ease both',
          }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%',
              background: 'var(--color-income-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 18,
              animation: 'successPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                stroke="var(--color-income)" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 22, color: 'var(--color-text-1)',
            }}>
              Verified!
            </p>
            <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginTop: 6 }}>
              Taking you to your dashboard…
            </p>
          </div>
        )}

        {/* ── Logo ── */}
        <div
          className="animate-fade-up"
          style={{ animationDelay: '0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: 'var(--font-display)',
            fontWeight: 800, fontSize: 22, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(59,125,216,0.22)',
          }}>
            B
          </div>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
            color: 'var(--color-text-1)', letterSpacing: '-0.02em',
          }}>
            Budget Book
          </span>
        </div>

        {/* ── Heading ── */}
        <h1
          className="animate-fade-up"
          style={{
            animationDelay: '0.15s',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26,
            lineHeight: 1.25, color: 'var(--color-text-1)',
            marginBottom: 6, letterSpacing: '-0.02em', textAlign: 'center',
          }}
        >
          Check your email
        </h1>
        <p
          className="animate-fade-up"
          style={{
            animationDelay: '0.2s',
            fontSize: 14.5, color: 'var(--color-text-2)',
            marginBottom: 32, lineHeight: 1.5, textAlign: 'center',
          }}
        >
          We sent a 6-digit code to{' '}
          <span style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>
            {email || 'your email'}
          </span>
        </p>

        {/* ── OTP boxes ── */}
        <div
          className="animate-fade-up"
          style={{
            animationDelay: '0.25s',
            display: 'flex', gap: 10, justifyContent: 'center',
            marginBottom: error ? 12 : 32,
            animation: shake ? 'shake 0.5s ease both' : undefined,
          }}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={loading || success}
              style={{
                width: 52, height: 62,
                borderRadius: 14,
                border: `1.5px solid ${
                  error ? 'var(--color-expense)' :
                  d     ? 'var(--color-primary)' :
                          'var(--color-border-solid)'
                }`,
                background: error ? 'var(--color-expense-light)' :
                            d     ? 'var(--color-primary-light)' :
                                    'var(--color-bg)',
                boxShadow: error ? '0 0 0 3px var(--color-expense-light)' :
                           d     ? '0 0 0 3px var(--color-primary-ring)' :
                                   'none',
                textAlign: 'center',
                fontSize: 24, fontWeight: 700,
                color: 'var(--color-text-1)',
                fontFamily: 'var(--font-body)',
                outline: 'none',
                transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                cursor: loading ? 'not-allowed' : 'text',
              }}
            />
          ))}
        </div>

        {/* ── Error message ── */}
        {error && (
          <p style={{
            fontSize: 13, color: 'var(--color-expense)',
            textAlign: 'center', marginBottom: 24, lineHeight: 1.4,
          }}>
            {error}
          </p>
        )}

        {/* ── Loading indicator ── */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <span
              className="btn-spinner"
              style={{
                borderColor: 'rgba(59,125,216,0.2)',
                borderTopColor: 'var(--color-primary)',
              }}
            />
          </div>
        )}

        {/* ── Resend ── */}
        <div
          className="animate-fade-up"
          style={{
            animationDelay: '0.3s',
            textAlign: 'center', fontSize: 14, color: 'var(--color-text-2)',
          }}
        >
          {resendMsg ? (
            <span style={{ color: 'var(--color-income)', fontWeight: 500 }}>{resendMsg}</span>
          ) : resendCooldown > 0 ? (
            <span>Resend code in <span style={{ fontWeight: 600 }}>{resendCooldown}s</span></span>
          ) : (
            <>
              Didn&apos;t get a code?{' '}
              <button
                type="button"
                onClick={handleResend}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-primary)', fontWeight: 600,
                  fontSize: 14, padding: 0,
                  fontFamily: 'var(--font-body)',
                }}
              >
                Resend
              </button>
            </>
          )}
        </div>

        {/* ── Back link ── */}
        <div
          className="animate-fade-up"
          style={{ animationDelay: '0.35s', textAlign: 'center', marginTop: 18 }}
        >
          <Link
            href="/login"
            style={{ fontSize: 13.5, color: 'var(--color-text-3)', textDecoration: 'none' }}
          >
            ← Back to sign in
          </Link>
        </div>

      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  )
}
