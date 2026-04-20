'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, Bill, Account } from '@/types'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const CAT_COLORS = [
  '#14B8A6','#334155','#F97316','#EAB308','#38BDF8',
  '#A855F7','#FB7185','#F59E0B','#6366F1','#84CC16','#EC4899','#06B6D4',
]

const UTILITY_KEYS = [
  { key: 'Natural Gas',  keywords: ['natural gas', 'gas'],               color: '#F97316' },
  { key: 'Water',        keywords: ['water'],                             color: '#38BDF8' },
  { key: 'Electricity',  keywords: ['electric', 'electricity', 'power'], color: '#EAB308' },
  { key: 'Internet',     keywords: ['internet', 'wifi', 'broadband'],    color: '#6366F1' },
]

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function fmtK(n: number) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(2)}K`
  return fmt(n)
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name: string; color?: string; fill?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-card)', border: '1px solid var(--color-border-solid)',
      borderRadius: 12, padding: '10px 14px', fontSize: 13,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--color-text-1)' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color ?? p.fill ?? 'var(--color-text-2)', marginBottom: 2 }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

// ── Outside label for donuts ──────────────────────────────────────────────────
const RADIAN = Math.PI / 180
function renderOutsideLabel({
  cx, cy, midAngle, outerRadius, name, percent,
}: {
  cx: number; cy: number; midAngle: number
  outerRadius: number; name: string; percent: number
}) {
  if (percent < 0.03) return null
  const radius = outerRadius + 32
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text
      x={x} y={y}
      fill="var(--color-text-2)"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={11}
      fontFamily="var(--font-body)"
    >
      {name} {(percent * 100).toFixed(1)}%
    </text>
  )
}

// ── Month multi-select dropdown ───────────────────────────────────────────────
function MonthPicker({
  selected, onChange,
}: { selected: number[]; onChange: (v: number[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  function toggle(i: number) {
    onChange(selected.includes(i) ? selected.filter(m => m !== i) : [...selected, i])
  }

  const label = selected.length === 0 || selected.length === 12
    ? 'All'
    : selected.length <= 3
      ? selected.map(m => MONTHS[m]).join(', ')
      : `${selected.length} months`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 36, padding: '0 14px', borderRadius: 10,
          border: '1.5px solid var(--color-border-solid)',
          background: 'var(--color-card)', fontSize: 13, fontWeight: 600,
          color: 'var(--color-text-1)', cursor: 'pointer', fontFamily: 'var(--font-body)',
          minWidth: 150,
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>Month: {label}</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
          background: 'var(--color-card)', border: '1.5px solid var(--color-border-solid)',
          borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.09)', padding: '6px 0',
          minWidth: 160,
        }}>
          <div
            onClick={() => onChange([])}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: selected.length === 0 ? 'var(--color-primary)' : 'var(--color-text-2)',
              borderBottom: '1px solid var(--color-border)',
              fontFamily: 'var(--font-body)',
            }}
          >
            All Months
          </div>
          {MONTHS.map((m, i) => (
            <label
              key={m}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 14px', fontSize: 13, cursor: 'pointer',
                color: 'var(--color-text-1)', fontFamily: 'var(--font-body)',
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(i)}
                onChange={() => toggle(i)}
                style={{ accentColor: 'var(--color-primary)', width: 14, height: 14 }}
              />
              {m}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const supabase = createClient()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  const [selectedYear, setSelectedYear]     = useState<number>(new Date().getFullYear())
  const [areaTab, setAreaTab]               = useState<'Incomes' | 'Expense' | 'Savings'>('Expense')
  const [sortCol, setSortCol]               = useState<'name' | 'category' | 'amount'>('amount')
  const [sortDir, setSortDir]               = useState<'asc' | 'desc'>('desc')
  const isMobile = useIsMobile()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [t, b, a] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('bills').select('*'),
        supabase.from('accounts').select('*'),
      ])
      setTransactions(t.data ?? [])
      setBills(b.data ?? [])
      setAccounts(a.data ?? [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Available years ───────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = [...new Set(transactions.map(t => new Date(t.date).getFullYear()))]
    return years.sort((a, b) => b - a)
  }, [transactions])

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  // ── Filtered transactions ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date)
      const yearOk  = d.getFullYear() === selectedYear
      const monthOk = selectedMonths.length === 0 || selectedMonths.includes(d.getMonth())
      return yearOk && monthOk
    })
  }, [transactions, selectedYear, selectedMonths])

  const activeMonths = selectedMonths.length > 0
    ? selectedMonths
    : [0,1,2,3,4,5,6,7,8,9,10,11]

  // ── Area chart data ───────────────────────────────────────────────────────
  const areaData = useMemo(() => {
    return activeMonths.map(mi => {
      const mo = transactions.filter(t => {
        const d = new Date(t.date)
        return d.getFullYear() === selectedYear && d.getMonth() === mi
      })
      const income  = mo.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0)
      const expense = mo.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0)
      return {
        month: MONTHS[mi],
        Incomes: Math.round(income),
        Expense: Math.round(expense),
        Savings: Math.round(Math.max(0, income - expense)),
      }
    })
  }, [transactions, selectedYear, activeMonths])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const { totalIncome, totalExpenses, avgMonthlyExpenses, avgMonthlyIncome } = useMemo(() => {
    const uniqueMonths = new Set(filtered.map(t => {
      const d = new Date(t.date)
      return `${d.getFullYear()}-${d.getMonth()}`
    }))
    const numMonths = Math.max(1, uniqueMonths.size)
    const income   = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0)
    const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0)
    return {
      totalIncome:        income,
      totalExpenses:      expenses,
      avgMonthlyExpenses: expenses / numMonths,
      avgMonthlyIncome:   income  / numMonths,
    }
  }, [filtered])

  const totalRent = useMemo(() =>
    bills
      .filter(b => b.name.toLowerCase().includes('rent') || b.name.toLowerCase().includes('mortgage'))
      .reduce((s, b) => s + b.amount, 0),
  [bills])

  // ── Utility stacked bar ───────────────────────────────────────────────────
  const utilityBar = useMemo(() => {
    return activeMonths.map(mi => {
      const row: Record<string, number | string> = { month: MONTHS[mi] }
      UTILITY_KEYS.forEach(({ key, keywords }) => {
        row[key] = Math.round(
          transactions.filter(t => {
            const d   = new Date(t.date)
            const cat = t.category.toLowerCase()
            return d.getFullYear() === selectedYear && d.getMonth() === mi
              && t.type === 'expense'
              && keywords.some(kw => cat.includes(kw))
          }).reduce((s, t) => s + Math.abs(t.amount), 0)
        )
      })
      return row
    })
  }, [transactions, selectedYear, activeMonths])

  // ── 50/30/20 donut ────────────────────────────────────────────────────────
  const donut5030 = useMemo(() => [
    { name: 'Needs',   pct: '50%', value: Math.round(totalIncome * 0.5), color: 'var(--color-primary)' },
    { name: 'Wants',   pct: '30%', value: Math.round(totalIncome * 0.3), color: 'var(--color-expense)' },
    { name: 'Savings', pct: '20%', value: Math.round(totalIncome * 0.2), color: 'var(--color-income)'  },
  ], [totalIncome])

  // ── Income by category donut ──────────────────────────────────────────────
  const incomeDonut = useMemo(() => {
    const totals: Record<string, number> = {}
    filtered.filter(t => t.type === 'income').forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount)
    })
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value: Math.round(value), color: CAT_COLORS[i % CAT_COLORS.length] }))
  }, [filtered])

  // ── Spending by category donut ────────────────────────────────────────────
  const categoryDonut = useMemo(() => {
    const totals: Record<string, number> = {}
    filtered.filter(t => t.type === 'expense').forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount)
    })
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value: Math.round(value), color: CAT_COLORS[i % CAT_COLORS.length] }))
  }, [filtered])

  // ── Table ─────────────────────────────────────────────────────────────────
  const tableData = useMemo(() => {
    return [...filtered.filter(t => t.type === 'expense')].sort((a, b) => {
      let av: string | number, bv: string | number
      if (sortCol === 'name')         { av = a.name.toLowerCase();     bv = b.name.toLowerCase()     }
      else if (sortCol === 'category'){ av = a.category.toLowerCase(); bv = b.category.toLowerCase() }
      else                            { av = Math.abs(a.amount);       bv = Math.abs(b.amount)       }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [filtered, sortCol, sortDir])

  // ── Last refresh ──────────────────────────────────────────────────────────
  const lastRefresh = useMemo(() => {
    if (transactions.length === 0) return null
    const latest = [...transactions].sort((a, b) => b.date.localeCompare(a.date))[0]
    return fmtDate(latest.date)
  }, [transactions])

  function handleSort(col: 'name' | 'category' | 'amount') {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir(col === 'amount' ? 'desc' : 'asc') }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border-solid)',
  }

  const AREA_COLOR: Record<string, string> = {
    Incomes: 'var(--color-income)',
    Expense: 'var(--color-expense)',
    Savings: 'var(--color-primary)',
  }

  const AREA_ID: Record<string, string> = {
    Incomes: 'grad-income',
    Expense: 'grad-expense',
    Savings: 'grad-savings',
  }

  // empty donut placeholder
  const emptySlice = [{ name: 'No data', value: 1, color: 'var(--color-border-solid)' }]

  if (loading) return (
    <div style={{ padding: 24, color: 'var(--color-text-3)', fontSize: 14 }}>Loading…</div>
  )

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1280, margin: '0 auto' }}>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <MonthPicker selected={selectedMonths} onChange={setSelectedMonths} />

        <div style={{ position: 'relative' }}>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{
              height: 36, padding: '0 32px 0 14px', borderRadius: 10,
              border: '1.5px solid var(--color-border-solid)',
              background: 'var(--color-card)', fontSize: 13, fontWeight: 600,
              color: 'var(--color-text-1)', cursor: 'pointer',
              fontFamily: 'var(--font-body)', appearance: 'none', outline: 'none',
            }}
          >
            {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown size={13} style={{
            position: 'absolute', right: 10, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--color-text-3)', pointerEvents: 'none',
          }} />
        </div>
      </div>

      {/* ── Area chart ──────────────────────────────────────────────────────── */}
      <div style={{ ...card, padding: '24px', marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 16 }}>
          Summary
        </p>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-solid)', marginBottom: 16 }}>
          {(['Incomes', 'Expense', 'Savings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setAreaTab(tab)}
              style={{
                padding: '8px 18px', border: 'none', background: 'transparent',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer',
                color: areaTab === tab ? 'var(--color-primary)' : 'var(--color-text-3)',
                borderBottom: areaTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={areaData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {(['Incomes','Expense','Savings'] as const).map(tab => (
                <linearGradient key={tab} id={AREA_ID[tab]} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={AREA_COLOR[tab]} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={AREA_COLOR[tab]} stopOpacity={0.01} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-solid)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-3)' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--color-text-3)' }} axisLine={false} tickLine={false}
              tickFormatter={v => v === 0 ? '0' : `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey={areaTab}
              stroke={AREA_COLOR[areaTab]}
              strokeWidth={2.5}
              fill={`url(#${AREA_ID[areaTab]})`}
              dot={false}
              activeDot={{ r: 5, fill: AREA_COLOR[areaTab], strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16, marginBottom: 20 }}>
        {[
          { value: fmtK(avgMonthlyExpenses), label: 'Avg Monthly Expenses' },
          { value: fmtK(totalRent || 0),     label: 'Total Rent'           },
          { value: fmtK(avgMonthlyIncome),   label: 'Avg Monthly Income'   },
          { value: fmtK(totalIncome),        label: 'Total Income'         },
        ].map(({ value, label }) => (
          <div key={label} style={{ ...card, padding: isMobile ? '14px 12px' : '20px 24px', textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: isMobile ? 18 : 26,
              color: 'var(--color-text-1)', letterSpacing: '-0.02em', lineHeight: 1.1,
              marginBottom: 6,
            }}>
              {value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', fontFamily: 'var(--font-body)' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Utility Expenses by Month (full width) ──────────────────────────── */}
      <div style={{ ...card, padding: '20px 24px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)' }}>
            Utility Expenses by Month
          </p>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {UTILITY_KEYS.map(({ key, color }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--color-text-2)', fontFamily: 'var(--font-body)' }}>{key}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginBottom: 12 }}>
          Natural Gas · Water · Electricity · Internet
        </p>

        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={utilityBar} barCategoryGap="35%" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-solid)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'var(--color-text-3)' }}
              axisLine={false} tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-3)' }} axisLine={false} tickLine={false}
              tickFormatter={v => v === 0 ? '0' : `$${v}`}
            />
            <Tooltip content={<ChartTooltip />} />
            {UTILITY_KEYS.map(({ key, color }, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="util"
                fill={color}
                radius={i === UTILITY_KEYS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Income & Spending donuts (2 columns) ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* LEFT: Income by Category */}
        <div style={{ ...card, padding: '20px 20px 16px', overflow: isMobile ? 'hidden' : 'visible' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 2 }}>
            Income by Category
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginBottom: 4 }}>
            Actual income · {fmtK(totalIncome)} total
          </p>

          <div style={{ position: 'relative', overflow: isMobile ? 'hidden' : 'visible' }}>
            <ResponsiveContainer width="100%" height={isMobile ? 220 : 290}>
              <PieChart style={{ overflow: 'visible' }}>
                <Pie
                  data={incomeDonut.length > 0 ? incomeDonut : emptySlice}
                  cx="50%" cy="50%"
                  innerRadius={62} outerRadius={88}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={(!isMobile && incomeDonut.length > 0) ? { stroke: '#9CA3AF', strokeWidth: 0.8 } : false}
                  label={(!isMobile && incomeDonut.length > 0) ? renderOutsideLabel : false}
                >
                  {(incomeDonut.length > 0 ? incomeDonut : emptySlice).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                {incomeDonut.length > 0 && <Tooltip formatter={(v: number) => fmt(v)} />}
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
                color: 'var(--color-text-1)', letterSpacing: '-0.01em', lineHeight: 1.1,
              }}>
                {fmtK(totalIncome)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 2 }}>Total</div>
            </div>
          </div>
        </div>

        {/* RIGHT: Spending by Category */}
        <div style={{ ...card, padding: '20px 20px 16px', overflow: isMobile ? 'hidden' : 'visible' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 2 }}>
            Spending by Category
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginBottom: 4 }}>
            Actual expenses · {fmtK(totalExpenses)} total
          </p>

          <div style={{ position: 'relative', overflow: isMobile ? 'hidden' : 'visible' }}>
            <ResponsiveContainer width="100%" height={isMobile ? 220 : 290}>
              <PieChart style={{ overflow: 'visible' }}>
                <Pie
                  data={categoryDonut.length > 0 ? categoryDonut : emptySlice}
                  cx="50%" cy="50%"
                  innerRadius={62} outerRadius={88}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={(!isMobile && categoryDonut.length > 0) ? { stroke: '#9CA3AF', strokeWidth: 0.8 } : false}
                  label={(!isMobile && categoryDonut.length > 0) ? renderOutsideLabel : false}
                >
                  {(categoryDonut.length > 0 ? categoryDonut : emptySlice).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                {categoryDonut.length > 0 && <Tooltip formatter={(v: number) => fmt(v)} />}
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
                color: 'var(--color-text-1)', letterSpacing: '-0.01em', lineHeight: 1.1,
              }}>
                {fmtK(totalExpenses)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 2 }}>Total</div>
            </div>
          </div>
        </div>

      </div>

      {/* ── 50/30/20 Budget Goal (full-width wide card) ──────────────────────── */}
      <div style={{ ...card, padding: '24px 32px', marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 2 }}>
            50/30/20 Budget Goal
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
            Target allocation of total income
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 20 : 40 }}>
          {/* Donut */}
          <div style={{ position: 'relative', flexShrink: 0, width: isMobile ? '100%' : 180, height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={totalIncome > 0 ? donut5030 : emptySlice}
                  cx="50%" cy="50%"
                  innerRadius={52} outerRadius={74}
                  paddingAngle={totalIncome > 0 ? 3 : 0}
                  dataKey="value"
                  labelLine={false}
                  label={false}
                >
                  {(totalIncome > 0 ? donut5030 : emptySlice).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                {totalIncome > 0 && <Tooltip formatter={(v: number) => fmt(v)} />}
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
                color: 'var(--color-text-1)', letterSpacing: '-0.01em', lineHeight: 1.1,
              }}>
                {fmtK(totalIncome)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 2 }}>
                Total Income
              </div>
            </div>
          </div>

          {/* Breakdown — 3 buckets */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, flex: 1 }}>
            {donut5030.map(({ name, pct, value, color }, i) => (
              <div
                key={name}
                style={{
                  padding: isMobile ? '0 12px' : '0 32px',
                  borderLeft: i > 0 ? '1px solid var(--color-border-solid)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)',
                    fontFamily: 'var(--font-body)',
                  }}>
                    {name} ({pct})
                  </span>
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: isMobile ? 18 : 28,
                  color: 'var(--color-text-1)', letterSpacing: '-0.02em', lineHeight: 1.1,
                }}>
                  {fmtK(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sortable table ───────────────────────────────────────────────────── */}
      <div style={{ ...card, overflow: 'hidden', marginBottom: 12 }}>
        {tableData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: 14 }}>
            No expense transactions for the selected period
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-body)' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)' }}>
                {([
                  { key: 'name',     label: 'Description', align: 'left'  },
                  { key: 'category', label: 'Category',    align: 'left'  },
                  { key: 'amount',   label: 'Amount',      align: 'right' },
                ] as const).map(({ key, label, align }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    style={{
                      padding: '12px 18px', textAlign: align,
                      fontWeight: 700, fontSize: 13,
                      color: sortCol === key ? 'var(--color-primary)' : 'var(--color-text-2)',
                      cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                      borderBottom: '2px solid var(--color-border-solid)',
                      transition: 'color 0.15s',
                    }}
                  >
                    {label}
                    <span style={{ marginLeft: 4, fontSize: 11 }}>
                      {sortCol === key
                        ? (sortDir === 'asc' ? '↑' : '↓')
                        : <span style={{ color: 'var(--color-text-3)' }}>↕</span>
                      }
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr
                  key={row.id}
                  style={{
                    background: i % 2 === 0 ? 'var(--color-card)' : 'var(--color-bg)',
                    borderBottom: i < tableData.length - 1 ? '1px solid var(--color-border-solid)' : 'none',
                  }}
                >
                  <td style={{ padding: '11px 18px', color: 'var(--color-text-1)', fontWeight: 500 }}>
                    {row.name}
                  </td>
                  <td style={{ padding: '11px 18px', color: 'var(--color-text-2)' }}>
                    {row.category}
                  </td>
                  <td style={{ padding: '11px 18px', textAlign: 'right', fontWeight: 700, color: 'var(--color-expense)' }}>
                    ${Math.abs(row.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {lastRefresh && (
        <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
          * Data as of {lastRefresh}
        </p>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  )
}
