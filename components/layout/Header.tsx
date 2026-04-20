'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, User } from 'lucide-react'

const TITLES: Record<string, string> = {
  '/overview':     'Overview',
  '/balances':     'Balances',
  '/transactions': 'Transactions',
  '/bills':        'Bills',
  '/expenses':     'Expenses',
  '/goals':        'Goals',
  '/budget':       'Budget',
  '/upload':       'Upload',
  '/settings':     'Settings',
  '/profile':      'Profile',
}

const NOTIFICATIONS = [
  {
    id: 'csv',
    title: 'Upload your latest CSV',
    body: 'Keep your data fresh by importing recent transactions.',
    href: '/upload',
  },
  {
    id: 'bills',
    title: 'Verify your Bills',
    body: 'Make sure your bill information is current and accurate.',
    href: '/bills',
  },
]

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const title = TITLES[pathname] ?? 'Dashboard'

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bellOpen, setBellOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAvatarUrl(data.user?.user_metadata?.avatar_url ?? null)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      height: 60,
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--color-border-solid)',
      padding: '0 28px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
        color: 'var(--color-text-1)', letterSpacing: '-0.02em', margin: 0,
      }}>
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        {/* Bell */}
        <div ref={bellRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setBellOpen(o => !o)}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              border: 'none',
              background: bellOpen ? 'var(--color-primary-light)' : 'var(--color-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: bellOpen ? 'var(--color-primary)' : 'var(--color-text-2)',
              position: 'relative', transition: 'background 0.15s, color 0.15s',
            }}
          >
            <Bell size={17} />
            {readIds.size < NOTIFICATIONS.length && (
              <span style={{
                position: 'absolute', top: 7, right: 7,
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--color-expense)',
                border: '1.5px solid #fff',
              }} />
            )}
          </button>

          {bellOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 300, background: 'var(--color-card)',
              border: '1px solid var(--color-border-solid)',
              borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.09)',
              zIndex: 100, overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 16px 10px',
                borderBottom: '1px solid var(--color-border-solid)',
              }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                  color: 'var(--color-text-1)', margin: 0,
                }}>Notifications</p>
              </div>
              {NOTIFICATIONS.map(n => {
                const isRead = readIds.has(n.id)
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      setReadIds(prev => new Set([...prev, n.id]))
                      setBellOpen(false)
                      router.push(n.href)
                    }}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: isRead ? 'transparent' : 'var(--color-primary)',
                        flexShrink: 0, marginTop: 5,
                      }} />
                      <div>
                        <p style={{
                          fontSize: 13, fontWeight: isRead ? 500 : 600,
                          color: isRead ? 'var(--color-text-2)' : 'var(--color-text-1)',
                          fontFamily: 'var(--font-body)', marginBottom: 3,
                        }}>{n.title}</p>
                        <p style={{
                          fontSize: 12, color: 'var(--color-text-2)',
                          fontFamily: 'var(--font-body)', lineHeight: 1.4,
                        }}>{n.body}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Profile */}
        <button
          onClick={() => router.push('/profile')}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            border: '2px solid var(--color-border-solid)',
            background: avatarUrl ? 'transparent' : 'var(--color-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', overflow: 'hidden', padding: 0,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border-solid)')}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <User size={17} style={{ color: 'var(--color-text-2)' }} />
          )}
        </button>

      </div>
    </header>
  )
}
