'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { StatCard } from '@/components/ui/StatCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Modal } from '@/components/ui/Modal'
import type { Budget } from '@/types'
import {
  Wallet, TrendingUp, ShieldCheck, AlertTriangle, Plus,
  UtensilsCrossed, Car, ShoppingBag, Heart, Tv, Zap,
  Home, Plane, BookOpen, CreditCard, Tag,
} from 'lucide-react'

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

function getBudgetStatus(spent: number, limit: number): { label: string; color: string; bg: string; barColor: string } {
  const ratio = limit > 0 ? spent / limit : 0
  if (ratio >= 1) return { label: 'Exceeded', color: 'var(--color-expense)', bg: 'var(--color-expense-light)', barColor: 'var(--color-expense)' }
  if (ratio >= 0.8) return { label: 'Warning', color: '#92400E', bg: '#FEF3C7', barColor: '#F59E0B' }
  return { label: 'On Track', color: 'var(--color-income)', bg: 'var(--color-income-light)', barColor: 'var(--color-income)' }
}

const inputStyle: React.CSSProperties = {
  height: 44, borderRadius: 'var(--radius-input)',
  border: '1.5px solid var(--color-border-solid)',
  background: 'var(--color-bg)', padding: '0 14px',
  fontSize: 14, fontFamily: 'var(--font-body)',
  color: 'var(--color-text-1)', outline: 'none', width: '100%', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)',
  fontFamily: 'var(--font-body)', display: 'block', marginBottom: 6,
}

// Inline limit editor
function LimitEditor({ budget, onSave }: { budget: Budget; onSave: (id: string, newLimit: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(budget.limit_amount))
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setValue(String(budget.limit_amount))
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function save() {
    const n = parseFloat(value)
    if (!isNaN(n) && n > 0) onSave(budget.id, n)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        style={{
          width: 90, height: 28, borderRadius: 8, border: '1.5px solid var(--color-primary)',
          background: 'var(--color-primary-light)', padding: '0 8px',
          fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 700,
          color: 'var(--color-primary)', outline: 'none',
        }}
        type="number"
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      title="Click to edit limit"
      style={{
        background: 'none', border: 'none', cursor: 'text', padding: 0,
        fontSize: 14, fontWeight: 700, color: 'var(--color-text-2)',
        fontFamily: 'var(--font-body)', textDecoration: 'underline dotted',
        textUnderlineOffset: 3,
      }}
    >
      {fmt(budget.limit_amount)}
    </button>
  )
}

export default function BudgetPage() {
  const router = useRouter()
  const supabase = createClient()

  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ category: '', limit_amount: '', spent: '0' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('budgets').select('*').order('created_at', { ascending: true })
    setBudgets(data ?? [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!form.category || !form.limit_amount) return
    setSaving(true)
    await supabase.from('budgets').insert({
      category: form.category,
      limit_amount: parseFloat(form.limit_amount),
      spent: parseFloat(form.spent || '0'),
    })
    setSaving(false)
    setShowModal(false)
    setForm({ category: '', limit_amount: '', spent: '0' })
    await load()
    router.refresh()
  }

  async function handleLimitSave(id: string, newLimit: number) {
    await supabase.from('budgets').update({ limit_amount: newLimit }).eq('id', id)
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, limit_amount: newLimit } : b))
  }

  // Aggregates
  const totalBudget = budgets.reduce((s, b) => s + b.limit_amount, 0)
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0)
  const totalRemaining = Math.max(0, totalBudget - totalSpent)

  // Alert: any category >= 80%
  const warnings = budgets.filter(b => b.limit_amount > 0 && b.spent / b.limit_amount >= 0.8)

  const cardBase: React.CSSProperties = {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border-solid)',
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1180, margin: '0 auto' }}>

      {/* Top stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <StatCard
          label="Total Budget"
          value={fmt(totalBudget)}
          icon={Wallet}
          iconColor="var(--color-primary)"
          iconBg="var(--color-primary-light)"
        />
        <StatCard
          label="Total Spent"
          value={fmt(totalSpent)}
          icon={TrendingUp}
          iconColor={totalSpent > totalBudget ? 'var(--color-expense)' : totalSpent / (totalBudget || 1) >= 0.8 ? '#92400E' : 'var(--color-text-2)'}
          iconBg={totalSpent > totalBudget ? 'var(--color-expense-light)' : totalSpent / (totalBudget || 1) >= 0.8 ? '#FEF3C7' : 'rgba(107,114,128,0.10)'}
        />
        <StatCard
          label="Remaining"
          value={fmt(totalRemaining)}
          icon={ShieldCheck}
          iconColor="var(--color-income)"
          iconBg="var(--color-income-light)"
        />
      </div>

      {/* Alert banner */}
      {warnings.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '14px 18px', borderRadius: 16, marginBottom: 20,
          background: '#FEF3C7', border: '1px solid #FDE68A',
        }}>
          <AlertTriangle size={18} style={{ color: '#92400E', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: '#92400E', marginBottom: 2 }}>Budget alert</p>
            <p style={{ fontSize: 13, color: '#78350F' }}>
              {warnings.map(b => `${b.category} (${Math.round((b.spent / b.limit_amount) * 100)}% used)`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            height: 40, padding: '0 18px', borderRadius: 'var(--radius-pill)',
            background: 'var(--color-primary)', color: '#fff',
            border: 'none', fontWeight: 600, fontSize: 13,
            fontFamily: 'var(--font-body)', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Budget
        </button>
      </div>

      {/* Budget cards */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ ...cardBase, height: 200, opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div style={{ ...cardBase, padding: '56px 24px', textAlign: 'center' }}>
          <Wallet size={36} style={{ color: 'var(--color-text-3)', marginBottom: 12 }} />
          <p style={{ fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>No budgets yet</p>
          <p style={{ fontSize: 14, color: 'var(--color-text-2)' }}>Create a budget category to start tracking your spending limits.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {budgets.map(budget => {
            const Icon = getCategoryIcon(budget.category)
            const pct = budget.limit_amount > 0 ? budget.spent / budget.limit_amount : 0
            const status = getBudgetStatus(budget.spent, budget.limit_amount)
            const remaining = Math.max(0, budget.limit_amount - budget.spent)

            return (
              <div key={budget.id} style={{ ...cardBase, padding: '22px 24px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: status.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: status.color,
                    }}>
                      <Icon size={16} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-1)' }}>
                      {budget.category}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: status.bg, color: status.color,
                  }}>
                    {status.label}
                  </span>
                </div>

                {/* Spent vs Limit */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
                    color: status.color, letterSpacing: '-0.02em',
                  }}>
                    {fmt(budget.spent)}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
                    of <LimitEditor budget={budget} onSave={handleLimitSave} />
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 10 }}>
                  <ProgressBar pct={pct} color={status.barColor} />
                </div>

                {/* Caption */}
                <p style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                  {Math.round(pct * 100)}% used · {fmt(remaining)} remaining
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Budget Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Budget">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <input style={inputStyle} placeholder="Food, Transport, Entertainment…"
              value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Monthly Limit</label>
            <input style={inputStyle} placeholder="500" type="number"
              value={form.limit_amount} onChange={e => setForm(f => ({ ...f, limit_amount: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Amount Already Spent</label>
            <input style={inputStyle} placeholder="0" type="number"
              value={form.spent} onChange={e => setForm(f => ({ ...f, spent: e.target.value }))} />
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !form.category || !form.limit_amount}
            style={{
              height: 46, borderRadius: 'var(--radius-pill)',
              background: 'var(--color-primary)', color: '#fff',
              border: 'none', fontWeight: 600, fontSize: 14,
              fontFamily: 'var(--font-body)', cursor: 'pointer', marginTop: 4,
              opacity: saving || !form.category || !form.limit_amount ? 0.5 : 1,
            }}
          >
            {saving ? 'Adding…' : 'Add Budget'}
          </button>
        </div>
      </Modal>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
