'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import type { Account } from '@/types'
import { Plus, Trash2 } from 'lucide-react'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const ACCENT_COLORS = [
  '#3B7DD8', '#4CAF82', '#E07060', '#7C5CBF', '#F59E0B', '#0EA5E9', '#EC4899', '#10B981',
]

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

export default function BalancesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: 'Checking',
    bank: '',
    number: '',
    balance: '',
    accent: ACCENT_COLORS[0],
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('accounts').select('*').order('created_at', { ascending: true })
    setAccounts(data ?? [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!form.bank || !form.number || !form.balance) return
    setSaving(true)
    await supabase.from('accounts').insert({
      type: form.type,
      bank: form.bank,
      number: form.number,
      balance: parseFloat(form.balance),
      accent: form.accent,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ type: 'Checking', bank: '', number: '', balance: '', accent: ACCENT_COLORS[0] })
    await load()
    router.refresh()
  }

  async function handleRemove(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    setAccounts(prev => prev.filter(a => a.id !== id))
    router.refresh()
  }

  const cardBase: React.CSSProperties = {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border-solid)',
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1180, margin: '0 auto' }}>
      <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 28 }}>
        Track all your linked accounts.
      </p>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ ...cardBase, height: 200, opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {accounts.map(account => (
            <div key={account.id} style={cardBase}>
              {/* Accent top bar */}
              <div style={{ height: 6, background: account.accent, borderRadius: '24px 24px 0 0' }} />
              <div style={{ padding: '20px 24px 24px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                        color: 'var(--color-text-1)',
                      }}>
                        {account.type}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        background: account.accent + '22',
                        color: account.accent,
                      }}>
                        {account.bank}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--color-text-2)' }}>
                      •••• •••• •••• {account.number?.slice(-4)}
                    </p>
                  </div>
                </div>

                {/* Balance */}
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28,
                  color: 'var(--color-text-1)', letterSpacing: '-0.03em', marginBottom: 20,
                }}>
                  {fmt(account.balance)}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleRemove(account.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 10,
                      border: '1.5px solid var(--color-border-solid)',
                      background: 'none', fontSize: 13, fontWeight: 600,
                      color: 'var(--color-text-2)', cursor: 'pointer',
                      fontFamily: 'var(--font-body)', transition: 'color 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-expense)'
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-expense)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-2)'
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-solid)'
                    }}
                  >
                    <Trash2 size={13} />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add Account card */}
          <button
            onClick={() => setShowModal(true)}
            style={{
              ...cardBase,
              border: '2px dashed var(--color-border-solid)',
              background: 'transparent',
              boxShadow: 'none',
              minHeight: 200,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
              cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--color-primary-light)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-solid)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--color-primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-primary)',
            }}>
              <Plus size={22} />
            </div>
            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-2)', fontFamily: 'var(--font-body)' }}>
              Add Account
            </p>
          </button>
        </div>
      )}

      {/* Add Account Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Account">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Account Type</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              style={{ ...inputStyle }}
            >
              {['Checking', 'Savings', 'Credit Card', 'Investment', 'Loan', 'Other'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Bank Name</label>
            <input
              style={inputStyle} placeholder="Chase, Wells Fargo…"
              value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Account Number (last 4 digits)</label>
            <input
              style={inputStyle} placeholder="1234" maxLength={16}
              value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Current Balance</label>
            <input
              style={inputStyle} placeholder="0.00" type="number"
              value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Accent Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ACCENT_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setForm(f => ({ ...f, accent: color }))}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: color,
                    border: form.accent === color ? '3px solid var(--color-text-1)' : '3px solid transparent',
                    cursor: 'pointer', outline: 'none',
                  }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !form.bank || !form.number || !form.balance}
            style={{
              height: 46, borderRadius: 'var(--radius-pill)',
              background: 'var(--color-primary)', color: '#fff',
              border: 'none', fontWeight: 600, fontSize: 14,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
              opacity: saving || !form.bank || !form.number || !form.balance ? 0.5 : 1,
              marginTop: 4,
            }}
          >
            {saving ? 'Adding…' : 'Add Account'}
          </button>
        </div>
      </Modal>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
