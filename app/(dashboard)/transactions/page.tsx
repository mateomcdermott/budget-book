'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction } from '@/types'
import {
  UtensilsCrossed, Car, ShoppingBag, Heart, Tv, Zap,
  Home, Plane, BookOpen, CreditCard, Tag, Search, Download,
} from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

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
  const headers = ['Date', 'Name', 'Category', 'Type', 'Amount']
  const lines = [
    headers.join(','),
    ...rows.map(t =>
      [t.date, `"${t.name}"`, `"${t.category}"`, t.type, t.amount].join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function TransactionsPage() {
  const supabase = createClient()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'income' | 'expense'>('all')
  const [search, setSearch] = useState('')
  const isMobile = useIsMobile()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
      setTransactions(data ?? [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const matchTab = tab === 'all' || t.type === tab
      const q = search.toLowerCase()
      const matchSearch = !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      return matchTab && matchSearch
    })
  }, [transactions, tab, search])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
    background: active ? 'var(--color-card)' : 'transparent',
    color: active ? 'var(--color-text-1)' : 'var(--color-text-3)',
    boxShadow: active ? 'var(--shadow-card)' : 'none',
    transition: 'all 0.15s',
    textTransform: 'capitalize' as const,
  })

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1180, margin: '0 auto' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg)', borderRadius: 12, padding: 4, border: '1px solid var(--color-border-solid)' }}>
            {(['all', 'income', 'expense'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>{t}</button>
            ))}
          </div>
          {/* Export */}
          <button
            onClick={() => exportCSV(filtered)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 40, padding: '0 16px', borderRadius: 12,
              border: '1.5px solid var(--color-border-solid)',
              background: 'var(--color-card)', fontSize: 13, fontWeight: 600,
              color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'var(--font-body)',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <Download size={13} />
            {!isMobile && 'Export CSV'}
          </button>
        </div>
        {/* Search — full width row */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or category…"
            style={{
              width: '100%', height: 40, borderRadius: 12,
              border: '1.5px solid var(--color-border-solid)',
              background: 'var(--color-card)', padding: '0 14px 0 36px',
              fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--color-text-1)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--color-card)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--color-border-solid)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '36px 1fr 90px' : '44px 1fr 120px 120px 100px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-solid)',
          background: 'var(--color-bg)',
          minWidth: isMobile ? 0 : 560,
        }}>
          {(isMobile ? ['', 'Name', 'Amount'] : ['', 'Name', 'Amount', 'Date', 'Type']).map(h => (
            <span key={h} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-3)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: 14 }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <Tag size={32} style={{ color: 'var(--color-text-3)', marginBottom: 12 }} />
            <p style={{ fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>No transactions found</p>
            <p style={{ fontSize: 14, color: 'var(--color-text-2)' }}>
              {search ? 'Try a different search term' : 'Import a CSV to get started'}
            </p>
          </div>
        ) : (
          filtered.map((t, i) => {
            const Icon = getCategoryIcon(t.category)
            const isIncome = t.type === 'income'
            return (
              <div
                key={t.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '36px 1fr 90px' : '44px 1fr 120px 120px 100px',
                  alignItems: 'center', padding: isMobile ? '12px 16px' : '14px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border-solid)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--color-bg)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
              >
                {/* Icon */}
                <div style={{
                  width: isMobile ? 28 : 34, height: isMobile ? 28 : 34, borderRadius: 8,
                  background: isIncome ? 'var(--color-income-light)' : 'var(--color-expense-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                }}>
                  <Icon size={13} />
                </div>

                {/* Name + category */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isMobile ? t.date : t.category}</p>
                </div>

                {/* Amount */}
                <span style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14, color: isIncome ? 'var(--color-income)' : 'var(--color-expense)', textAlign: 'right' }}>
                  {isIncome ? '+' : '−'}{fmt(Math.abs(t.amount))}
                </span>

                {/* Date — desktop only */}
                {!isMobile && <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>{t.date}</span>}

                {/* Type badge — desktop only */}
                {!isMobile && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: isIncome ? 'var(--color-income-light)' : 'var(--color-expense-light)',
                    color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                    display: 'inline-block',
                  }}>
                    {t.type}
                  </span>
                )}
              </div>
            )
          })
        )}

        </div>
        {!loading && filtered.length > 0 && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--color-border-solid)',
            background: 'var(--color-bg)',
            fontSize: 13, color: 'var(--color-text-3)', fontFamily: 'var(--font-body)',
          }}>
            {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
