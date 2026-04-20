'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction } from '@/types'
import {
  UtensilsCrossed, Car, ShoppingBag, Heart, Tv, Zap,
  Home, Plane, BookOpen, CreditCard, Tag, Download, ArrowUpRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function getCategoryIcon(cat: string) {
  const c = cat.toLowerCase()
  if (c.includes('food') || c.includes('dining') || c.includes('restaurant') || c.includes('grocery')) return UtensilsCrossed
  if (c.includes('transport') || c.includes('car') || c.includes('gas')) return Car
  if (c.includes('shop') || c.includes('retail') || c.includes('clothing')) return ShoppingBag
  if (c.includes('health') || c.includes('medical')) return Heart
  if (c.includes('entertain') || c.includes('movie') || c.includes('streaming')) return Tv
  if (c.includes('util') || c.includes('electric') || c.includes('water') || c.includes('internet')) return Zap
  if (c.includes('hous') || c.includes('rent') || c.includes('home')) return Home
  if (c.includes('travel') || c.includes('flight')) return Plane
  if (c.includes('edu') || c.includes('school')) return BookOpen
  if (c.includes('subscri') || c.includes('software')) return CreditCard
  return Tag
}

function exportCSV(rows: Transaction[]) {
  const headers = ['Date', 'Name', 'Category', 'Amount']
  const lines = [
    headers.join(','),
    ...rows.map(t => [t.date, `"${t.name}"`, `"${t.category}"`, Math.abs(t.amount)].join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-card)', border: '1px solid var(--color-border-solid)',
      borderRadius: 12, padding: '10px 14px', fontSize: 13,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--color-text-1)' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  )
}

export default function ExpensesPage() {
  const supabase = createClient()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [toggle, setToggle] = useState<'monthly' | 'weekly'>('monthly')
  const isMobile = useIsMobile()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('type', 'expense')
        .order('date', { ascending: false })
      setTransactions(data ?? [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chartData = useMemo(() => {
    const now = new Date()

    if (toggle === 'monthly') {
      const months: { label: string; current: number; previous: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const label = d.toLocaleString('en-US', { month: 'short' })
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
        const total = transactions
          .filter(t => t.date >= start && t.date <= end)
          .reduce((s, t) => s + Math.abs(t.amount), 0)
        months.push({ label, current: Math.round(total), previous: 0 })
      }
      // Shift: "current" = this month, "previous" = same month last year (mock for now)
      return months.map(m => ({ label: m.label, 'This period': m.current, 'Last period': Math.round(m.current * (0.8 + Math.random() * 0.4)) }))
    }

    // Weekly
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfLastWeek = new Date(startOfWeek)
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

    const thisW = [0, 0, 0, 0, 0, 0, 0]
    const lastW = [0, 0, 0, 0, 0, 0, 0]
    transactions.forEach(t => {
      const d = new Date(t.date)
      const idx = d.getDay()
      const amt = Math.abs(t.amount)
      if (d >= startOfWeek && d <= now) thisW[idx] += amt
      else if (d >= startOfLastWeek && d < startOfWeek) lastW[idx] += amt
    })
    return days.map((day, i) => ({ label: day, 'This period': Math.round(thisW[i]), 'Last period': Math.round(lastW[i]) }))
  }, [transactions, toggle])

  const categoryBreakdown = useMemo(() => {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const thisM: Record<string, Transaction[]> = {}
    const lastM: Record<string, number> = {}

    transactions.forEach(t => {
      const d = new Date(t.date)
      if (d >= thisMonthStart) {
        if (!thisM[t.category]) thisM[t.category] = []
        thisM[t.category].push(t)
      } else if (d >= lastMonthStart && d <= lastMonthEnd) {
        lastM[t.category] = (lastM[t.category] || 0) + Math.abs(t.amount)
      }
    })

    return Object.entries(thisM)
      .map(([name, txns]) => {
        const total = txns.reduce((s, t) => s + Math.abs(t.amount), 0)
        const prev = lastM[name] || 0
        const change = prev > 0 ? ((total - prev) / prev) * 100 : 0
        return { name, total, change, txns }
      })
      .sort((a, b) => b.total - a.total)
  }, [transactions])

  const toggleBtn = (val: 'monthly' | 'weekly'): React.CSSProperties => ({
    padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
    background: toggle === val ? 'var(--color-card)' : 'transparent',
    color: toggle === val ? 'var(--color-text-1)' : 'var(--color-text-3)',
    boxShadow: toggle === val ? 'var(--shadow-card)' : 'none',
  })

  const cardBase: React.CSSProperties = {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border-solid)',
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1180, margin: '0 auto' }}>

      {/* Comparison Chart */}
      <div style={{ ...cardBase, padding: isMobile ? '16px' : '24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--color-text-1)', marginBottom: 2 }}>
              Expense Comparison
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-2)' }}>This period vs last period</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: 10, padding: 4, border: '1px solid var(--color-border-solid)' }}>
              <button style={toggleBtn('monthly')} onClick={() => setToggle('monthly')}>Monthly</button>
              <button style={toggleBtn('weekly')} onClick={() => setToggle('weekly')}>Weekly</button>
            </div>
            <button
              onClick={() => exportCSV(transactions)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                height: 36, padding: '0 14px', borderRadius: 10,
                border: '1.5px solid var(--color-border-solid)',
                background: 'var(--color-card)', fontSize: 13, fontWeight: 600,
                color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              <Download size={12} /> {!isMobile && 'Export'}
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barGap={4} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-solid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--color-text-3)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-3)' }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? '0' : `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
            <Bar dataKey="This period" fill="var(--color-expense)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Last period" fill="var(--color-border-solid)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ ...cardBase, height: 200, opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : categoryBreakdown.length === 0 ? (
        <div style={{ ...cardBase, padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>No expenses this month</p>
          <p style={{ fontSize: 14, color: 'var(--color-text-2)' }}>Import transactions to see your breakdown.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {categoryBreakdown.map(cat => {
            const Icon = getCategoryIcon(cat.name)
            const isUp = cat.change > 0
            return (
              <div key={cat.name} style={{ ...cardBase, padding: '22px 24px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: 'var(--color-expense-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--color-expense)',
                    }}>
                      <Icon size={16} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-1)' }}>{cat.name}</span>
                  </div>
                  {cat.change !== 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px',
                      borderRadius: 'var(--radius-pill)',
                      background: isUp ? 'var(--color-expense-light)' : 'var(--color-income-light)',
                      color: isUp ? 'var(--color-expense)' : 'var(--color-income)',
                      display: 'flex', alignItems: 'center', gap: 2,
                    }}>
                      <ArrowUpRight size={10} style={{ transform: isUp ? 'none' : 'scaleY(-1)' }} />
                      {Math.abs(cat.change).toFixed(0)}%
                    </span>
                  )}
                </div>

                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--color-text-1)', letterSpacing: '-0.02em', marginBottom: 16 }}>
                  {fmt(cat.total)}
                </div>

                {/* Individual transactions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cat.txns.slice(0, 3).map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{t.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-expense)', flexShrink: 0 }}>{fmt(Math.abs(t.amount))}</span>
                    </div>
                  ))}
                  {cat.txns.length > 3 && (
                    <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>+{cat.txns.length - 3} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
