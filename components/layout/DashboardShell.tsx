'use client'

import { ReactNode } from 'react'
import { SidebarProvider, useSidebar } from './SidebarContext'
import Sidebar from './Sidebar'
import Header from './Header'

function Inner({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar()
  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'var(--color-bg)', fontFamily: 'var(--font-body)',
    }}>
      <Sidebar />
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        marginLeft: collapsed ? 64 : 240, minWidth: 0,
        transition: 'margin-left 0.22s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <Header />
        <main style={{ flex: 1 }}>{children}</main>
      </div>
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
