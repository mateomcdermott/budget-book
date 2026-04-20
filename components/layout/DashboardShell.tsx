'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, TrendingDown, BarChart2,
  FileText, Receipt, Upload, Settings,
} from 'lucide-react'
import { SidebarProvider, useSidebar } from './SidebarContext'
import Sidebar from './Sidebar'
import Header from './Header'

const NAV = [
  { href: '/overview',     label: 'Overview',      Icon: LayoutDashboard },
  { href: '/expenses',     label: 'Expenses',      Icon: TrendingDown },
  { href: '/budget',       label: 'Budget',        Icon: BarChart2 },
  { href: '/bills',        label: 'Bills',         Icon: FileText },
  { href: '/transactions', label: 'Transactions',  Icon: Receipt },
  { href: '/upload',       label: 'Upload',        Icon: Upload },
  { href: '/settings',     label: 'Settings',      Icon: Settings },
]

function BottomNav() {
  const pathname = usePathname()
  const items = NAV.slice(0, 6)

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 60, background: 'var(--color-card)',
      borderTop: '1px solid var(--color-border-solid)',
      display: 'flex', alignItems: 'stretch',
      zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {items.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            textDecoration: 'none',
            color: active ? 'var(--color-primary)' : 'var(--color-text-3)',
          }}>
            <Icon size={20} />
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-body)',
              fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

function Inner({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'var(--color-bg)', fontFamily: 'var(--font-body)',
      overflowX: 'hidden',
    }}>
      {!isMobile && <Sidebar />}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        marginLeft: isMobile ? 0 : (collapsed ? 64 : 240),
        minWidth: 0, maxWidth: '100%',
        transition: 'margin-left 0.22s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <Header />
        <main style={{
          flex: 1,
          paddingBottom: isMobile ? 68 : 0,
          minWidth: 0, overflowX: 'hidden',
        }}>
          {children}
        </main>
      </div>
      {isMobile && <BottomNav />}
    </div>
  )
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Inner>{children}</Inner>
    </SidebarProvider>
  )
}
