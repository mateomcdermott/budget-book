'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction } from '@/types'
import {
  UtensilsCrossed, Car, ShoppingBag, Heart, Tv, Zap,
  Home, Plane, BookOpen, CreditCard, Tag, Search, Download, ChevronDown,
  Trash2, History, X, AlertTriangle,
} from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

interface CsvImport {
  id: string
  filename: string
  row_count: number
  status: string
  created_at: string
}

const SOURCE_LABELS: Record<string, string> = {
  chase_csv:        'Chase',
  bofa_csv:         'Bank of America',
  bofa_checking_csv:'BofA Checking',
  amex_csv:         'Amex',
  citi_csv:         'Citi',
  wells_fargo_csv:  'Wells Fargo',
  capital_one_csv:  'Capital One',
  apple_card_csv:   'Apple Card',
  venmo_csv:        'Venmo',
  cashapp_csv:      'Cash App',
  discover_csv:     'Discover',
  generic_csv:      'Other',
}

function sourceLabel(s: string) {
  return SOURCE_LABELS[s] || s || 'Unknown'
}

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
  const [source, setSource] = useState('')
  const [sourceOpen, setSourceOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showImports, setShowImports] = useState(false)
  const [imports, setImports] = useState<CsvImport[]>([])
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const availableSources = useMemo(() => {
    const seen = new Set<string>()
    transactions.forEach(t => { if (t.source) seen.add(t.source) })
    return [...seen].sort()
  }, [transactions])

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

  async function loadImports() {
    const { data } = await supabase
      .from('csv_imports')
      .select('*')
      .order('created_at', { ascending: false })
    setImports(data ?? [])
  }

  async function handleDeleteRow(id: string) {
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
    setDeletingId(null)
  }

  async function handleDeleteBatch(batchId: string) {
    await supabase.from('transactions').delete().eq('import_batch_id', batchId)
    await supabase.from('csv_imports').delete().eq('id', batchId)
    setImports(prev => prev.filter(i => i.id !== batchId))
    setTransactions(prev => prev.filter(t => (t as Transaction & { import_batch_id?: string }).import_batch_id !== batchId))
    setDeletingBatchId(null)
  }

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const matchTab    = tab === 'all' || t.type === tab
      const matchSource = !source || t.source === source
      const q           = search.toLowerCase()
      const matchSearch = !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      return matchTab && matchSource && matchSearch
    })
  }, [transactions, tab, search, source])

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
          {/* Source filter */}
          {availableSources.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setSourceOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  height: 40, padding: '0 14px', borderRadius: 12,
                  border: `1.5px solid ${source ? 'var(--color-primary)' : 'var(--color-border-solid)'}`,
                  background: source ? 'var(--color-primary-light)' : 'var(--color-card)',
                  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
                  color: source ? 'var(--color-primary)' : 'var(--color-text-2)',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {source ? sourceLabel(source) : 'All Sources'}
                <ChevronDown size={13} />
              </button>
              {sourceOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
                  background: 'var(--color-card)', border: '1.5px solid var(--color-border-solid)',
                  borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: '6px 0', minWidth: 180,
                }}>
                  <button
                    onClick={() => { setSource(''); setSourceOpen(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 14px', fontSize: 13, fontWeight: source === '' ? 700 : 400,
                      color: source === '' ? 'var(--color-primary)' : 'var(--color-text-1)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      borderBottom: '1px solid var(--color-border-solid)',
                    }}
                  >
                    All Sources
                  </button>
                  {availableSources.map(s => (
                    <button
                      key={s}
                      onClick={() => { setSource(s); setSourceOpen(false) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 14px', fontSize: 13, fontWeight: source === s ? 700 : 400,
                        color: source === s ? 'var(--color-primary)' : 'var(--color-text-1)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {sourceLabel(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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

          {/* Import History */}
          <button
            onClick={() => { loadImports(); setShowImports(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 40, padding: '0 16px', borderRadius: 12,
              border: '1.5px solid var(--color-border-solid)',
              background: 'var(--color-card)', fontSize: 13, fontWeight: 600,
              color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'var(--font-body)',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <History size={13} />
            {!isMobile && 'Imports'}
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
          gridTemplateColumns: isMobile ? '36px 1fr 90px 32px' : '44px 1fr 120px 120px 100px 40px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-solid)',
          background: 'var(--color-bg)',
          minWidth: isMobile ? 0 : 600,
        }}>
          {(isMobile ? ['', 'Name', 'Amount', ''] : ['', 'Name', 'Amount', 'Date', 'Type', '']).map((h, i) => (
            <span key={i} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-3)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
            const isConfirming = deletingId === t.id
            return (
              <div
                key={t.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '36px 1fr 90px 32px' : '44px 1fr 120px 120px 100px 40px',
                  alignItems: 'center', padding: isMobile ? '12px 16px' : '14px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border-solid)' : 'none',
                  transition: 'background 0.1s',
                  background: isConfirming ? 'var(--color-expense-light)' : 'transparent',
                }}
                onMouseEnter={e => { if (!isConfirming) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-bg)' }}
                onMouseLeave={e => { if (!isConfirming) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
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

                {/* Delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isConfirming ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleDeleteRow(t.id)} style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 6, border: 'none', background: 'var(--color-expense)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Yes</button>
                      <button onClick={() => setDeletingId(null)} style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--color-border-solid)', background: 'var(--color-card)', color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>No</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(t.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6 }}
                      title="Delete transaction"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
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

      {/* Import History Modal */}
      {showImports && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }} onClick={() => { setShowImports(false); setDeletingBatchId(null) }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-card)', borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: 560,
              maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--color-border-solid)' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--color-text-1)' }}>Import History</p>
              <button onClick={() => { setShowImports(false); setDeletingBatchId(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {imports.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: 14 }}>
                  No imports found. Upload a CSV to get started.
                </div>
              ) : (
                imports.map(imp => {
                  const isConfirming = deletingBatchId === imp.id
                  return (
                    <div key={imp.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 24px', borderBottom: '1px solid var(--color-border-solid)',
                      background: isConfirming ? 'var(--color-expense-light)' : 'transparent',
                    }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 2 }}>{imp.filename}</p>
                        <p style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                          {imp.row_count} transactions · {new Date(imp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>

                      {isConfirming ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AlertTriangle size={14} style={{ color: 'var(--color-expense)' }} />
                          <span style={{ fontSize: 12, color: 'var(--color-expense)', fontWeight: 600 }}>Delete all?</span>
                          <button onClick={() => handleDeleteBatch(imp.id)} style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: 'none', background: 'var(--color-expense)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Yes, delete</button>
                          <button onClick={() => setDeletingBatchId(null)} style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--color-border-solid)', background: 'var(--color-card)', color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingBatchId(imp.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                            border: '1px solid var(--color-border-solid)',
                            background: 'none', fontSize: 12, fontWeight: 600,
                            color: 'var(--color-expense)', fontFamily: 'var(--font-body)',
                          }}
                        >
                          <Trash2 size={12} /> Delete import
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
