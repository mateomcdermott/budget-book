'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'
import {
  LayoutDashboard, Receipt, FileText,
  TrendingDown, BarChart2, Upload,
  Settings, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'

const NAV = [
  { href: '/overview',     label: 'Overview',     Icon: LayoutDashboard },
  { href: '/expenses',     label: 'Expenses',     Icon: TrendingDown },
  { href: '/budget',       label: 'Budget',       Icon: BarChart2 },
  { href: '/bills',        label: 'Bills',        Icon: FileText },
  { href: '/transactions', label: 'Transactions', Icon: Receipt },
  { href: '/upload',       label: 'Upload CSV',   Icon: Upload },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, toggle } = useSidebar()

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  )

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const w = collapsed ? 64 : 240

  return (
    <aside style={{
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      width: w,
      background: 'var(--color-card)',
      borderRight: '1px solid var(--color-border-solid)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 40,
      transition: 'width 0.22s cubic-bezier(0.22,1,0.36,1)',
      overflow: 'hidden',
    }}>

      {/* Logo + toggle */}
      <div style={{
        padding: collapsed ? '24px 0 20px' : '24px 20px 20px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0, gap: 10,
        transition: 'padding 0.22s',
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontFamily: 'var(--font-display)',
              fontWeight: 800, fontSize: 16,
              boxShadow: '0 2px 8px rgba(59,125,216,0.22)',
              flexShrink: 0,
            }}>B</div>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700, fontSize: 16,
              color: 'var(--color-text-1)',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
            }}>Budget Book</span>
          </div>
        )}

        {collapsed && (
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: 'var(--font-display)',
            fontWeight: 800, fontSize: 16,
            boxShadow: '0 2px 8px rgba(59,125,216,0.22)',
            flexShrink: 0,
          }}>B</div>
        )}

        {!collapsed && (
          <button
            onClick={toggle}
            title="Collapse sidebar"
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: 'var(--color-bg)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-3)', flexShrink: 0,
            }}
          >
            <ChevronLeft size={15} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: collapsed ? '12px 8px' : '12px', overflowY: 'auto' }}>
        {collapsed && (
          <button
            onClick={toggle}
            title="Expand sidebar"
            style={{
              width: '100%', height: 36, borderRadius: 8, border: 'none',
              background: 'var(--color-bg)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-3)', marginBottom: 8,
            }}
          >
            <ChevronRight size={15} />
          </button>
        )}

        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '9px 0' : '9px 12px',
                borderRadius: 10, marginBottom: 2,
                fontSize: 14, fontWeight: active ? 600 : 500,
                fontFamily: 'var(--font-body)',
                color: active ? 'var(--color-primary)' : 'var(--color-text-2)',
                background: active ? 'var(--color-primary-light)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap', overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'var(--color-border)'
                  ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-1)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-2)'
                }
              }}
            >
              <Icon size={16} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Settings + Sign out */}
      <div style={{
        padding: collapsed ? '12px 8px' : '12px',
        borderTop: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <Link
          href="/settings"
          title={collapsed ? 'Settings' : undefined}
          style={{
            display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : 10,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '9px 0' : '9px 12px',
            borderRadius: 10, marginBottom: 2,
            fontSize: 14, fontWeight: pathname === '/settings' ? 600 : 500,
            fontFamily: 'var(--font-body)',
            color: pathname === '/settings' ? 'var(--color-primary)' : 'var(--color-text-2)',
            background: pathname === '/settings' ? 'var(--color-primary-light)' : 'transparent',
            textDecoration: 'none',
            transition: 'background 0.15s, color 0.15s',
            whiteSpace: 'nowrap', overflow: 'hidden',
          }}
        >
          <Settings size={16} style={{ flexShrink: 0, opacity: pathname === '/settings' ? 1 : 0.7 }} />
          {!collapsed && <span>Settings</span>}
        </Link>

        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign out' : undefined}
          style={{
            display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : 10,
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: '100%', padding: collapsed ? '9px 0' : '9px 12px',
            borderRadius: 10, border: 'none',
            background: 'transparent',
            fontSize: 14, fontWeight: 500,
            color: 'var(--color-text-2)',
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(224,112,96,0.08)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-expense)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-2)'
          }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}
