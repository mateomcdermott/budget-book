'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import type { Bill } from '@/types'
import { Plus, FileText, Music, Zap, Wifi, Tv, ShoppingBag, CreditCard, Tag } from 'lucide-react'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

function getBillIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes('spotify') || n.includes('apple music') || n.includes('music')) return Music
  if (n.includes('electric') || n.includes('power') || n.includes('gas') || n.includes('energy')) return Zap
  if (n.includes('internet') || n.includes('wifi') || n.includes('broadband') || n.includes('cable')) return Wifi
  if (n.includes('netflix') || n.includes('hulu') || n.includes('disney') || n.includes('stream')) return Tv
  if (n.includes('amazon') || n.includes('prime') || n.includes('shop')) return ShoppingBag
  if (n.includes('credit') || n.includes('loan') || n.includes('mortgage')) return CreditCard
  if (n.includes('phone') || n.includes('mobile') || n.includes('cellular')) return Tag
  return FileText
}

function getBillBadge(dueDay: number) {
  const today = new Date().getDate()
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  let daysLeft = dueDay - today
  if (daysLeft < 0) daysLeft += daysInMonth
  if (daysLeft <= 3) return { text: 'Due soon', bg: 'var(--color-expense-light)', color: 'var(--color-expense)' }
  if (daysLeft <= 7) return { text: `${daysLeft} days left`, bg: '#FEF3C7', color: '#92400E' }
  return { text: 'Upcoming', bg: 'var(--color-income-light)', color: 'var(--color-income)' }
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

export default function BillsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', plan: 'Monthly', amount: '',
    due_day: '', due_month: '', last_charge: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('bills').select('*').order('due_day', { ascending: true })
    setBills(data ?? [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!form.name || !form.amount || !form.due_day) return
    setSaving(true)
    await supabase.from('bills').insert({
      name: form.name, plan: form.plan,
      amount: parseFloat(form.amount),
      due_day: parseInt(form.due_day),
      due_month: form.due_month,
      last_charge: form.last_charge,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ name: '', plan: 'Monthly', amount: '', due_day: '', due_month: '', last_charge: '' })
    await load()
    router.refresh()
  }

  const cardBase: React.CSSProperties = {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border-solid)',
    padding: '22px 24px',
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <p style={{ fontSize: 14, color: 'var(--color-text-2)' }}>Manage recurring bills and subscriptions.</p>
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
          <Plus size={14} /> Add Bill
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ ...cardBase, height: 180, opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <div style={{ ...cardBase, textAlign: 'center', padding: '56px 24px' }}>
          <FileText size={36} style={{ color: 'var(--color-text-3)', marginBottom: 12 }} />
          <p style={{ fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>No bills yet</p>
          <p style={{ fontSize: 14, color: 'var(--color-text-2)' }}>Add your first recurring bill above.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {bills.map(bill => {
            const Icon = getBillIcon(bill.name)
            const badge = getBillBadge(bill.due_day)
            return (
              <div key={bill.id} style={cardBase}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: 'var(--color-primary-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--color-primary)', flexShrink: 0,
                    }}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-1)', marginBottom: 2 }}>{bill.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{bill.plan}</p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 9px',
                    borderRadius: 'var(--radius-pill)',
                    background: badge.bg, color: badge.color,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {badge.text}
                  </span>
                </div>

                {/* Amount */}
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26,
                  color: 'var(--color-text-1)', letterSpacing: '-0.02em', marginBottom: 6,
                }}>
                  {fmt(bill.amount)}
                </div>

                <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: bill.last_charge ? 4 : 0 }}>
                  Due on day {bill.due_day}{bill.due_month ? ` of ${bill.due_month}` : ' of each month'}
                </p>

                {bill.last_charge && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                    Last charge: {bill.last_charge}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Bill Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Bill">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Bill Name</label>
            <input style={inputStyle} placeholder="Netflix, Rent, Electricity…"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Billing Plan</label>
            <select style={inputStyle} value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
              {['Monthly', 'Yearly', 'Weekly', 'Quarterly'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Amount</label>
            <input style={inputStyle} placeholder="0.00" type="number"
              value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Due Day (1–31)</label>
              <input style={inputStyle} placeholder="15" type="number" min={1} max={31}
                value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Due Month (optional)</label>
              <input style={inputStyle} placeholder="January"
                value={form.due_month} onChange={e => setForm(f => ({ ...f, due_month: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Last Charge Date (optional)</label>
            <input style={inputStyle} type="date"
              value={form.last_charge} onChange={e => setForm(f => ({ ...f, last_charge: e.target.value }))} />
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !form.name || !form.amount || !form.due_day}
            style={{
              height: 46, borderRadius: 'var(--radius-pill)',
              background: 'var(--color-primary)', color: '#fff',
              border: 'none', fontWeight: 600, fontSize: 14,
              fontFamily: 'var(--font-body)', cursor: 'pointer', marginTop: 4,
              opacity: saving || !form.name || !form.amount || !form.due_day ? 0.5 : 1,
            }}
          >
            {saving ? 'Adding…' : 'Add Bill'}
          </button>
        </div>
      </Modal>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
