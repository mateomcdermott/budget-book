'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GoalArc } from '@/components/ui/GoalArc'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Modal } from '@/components/ui/Modal'
import type { Goal } from '@/types'
import { Plus, Target, CheckCircle } from 'lucide-react'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

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

export default function GoalsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', target: '', achieved: '0', deadline: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('goals').select('*').order('created_at', { ascending: false })
    setGoals(data ?? [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!form.name || !form.target || !form.deadline) return
    setSaving(true)
    await supabase.from('goals').insert({
      name: form.name,
      target: parseFloat(form.target),
      achieved: parseFloat(form.achieved || '0'),
      deadline: form.deadline,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ name: '', target: '', achieved: '0', deadline: '' })
    await load()
    router.refresh()
  }

  const cardBase: React.CSSProperties = {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border-solid)',
    padding: '24px',
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <p style={{ fontSize: 14, color: 'var(--color-text-2)' }}>Set and track your savings goals.</p>
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
          <Plus size={14} /> New Goal
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ ...cardBase, height: 340, opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div style={{ ...cardBase, textAlign: 'center', padding: '64px 24px' }}>
          <Target size={40} style={{ color: 'var(--color-text-3)', marginBottom: 16 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--color-text-1)', marginBottom: 6 }}>
            No goals yet
          </p>
          <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 20 }}>
            Set your first savings goal to start tracking your progress.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              height: 42, padding: '0 24px', borderRadius: 'var(--radius-pill)',
              background: 'var(--color-primary)', color: '#fff',
              border: 'none', fontWeight: 600, fontSize: 14,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
            }}
          >
            Create your first goal
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {goals.map(goal => {
            const pct = goal.target > 0 ? Math.min(1, goal.achieved / goal.target) : 0
            const done = goal.achieved >= goal.target
            const remaining = Math.max(0, goal.target - goal.achieved)

            return (
              <div key={goal.id} style={cardBase}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: done ? 'var(--color-income-light)' : 'var(--color-primary-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: done ? 'var(--color-income)' : 'var(--color-primary)',
                    }}>
                      {done ? <CheckCircle size={18} /> : <Target size={18} />}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-1)', marginBottom: 2 }}>{goal.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Due {goal.deadline}</p>
                    </div>
                  </div>
                  {done && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--color-income-light)', color: 'var(--color-income)',
                    }}>
                      Done
                    </span>
                  )}
                </div>

                {/* GoalArc gauge */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                  <GoalArc achieved={goal.achieved} target={goal.target} size={150} strokeWidth={13} />
                </div>

                {/* Achieved / Target */}
                <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 18 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Achieved</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--color-income)', letterSpacing: '-0.02em' }}>
                      {fmt(goal.achieved)}
                    </p>
                  </div>
                  <div style={{ width: 1, background: 'var(--color-border-solid)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Target</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--color-text-1)', letterSpacing: '-0.02em' }}>
                      {fmt(goal.target)}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 10 }}>
                  <ProgressBar
                    pct={pct}
                    color={done ? 'var(--color-income)' : 'var(--color-primary)'}
                  />
                </div>

                {!done && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-3)', textAlign: 'center' }}>
                    {fmt(remaining)} remaining
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New Goal Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Goal">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Goal Name</label>
            <input style={inputStyle} placeholder="Emergency fund, New car…"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Target Amount</label>
            <input style={inputStyle} placeholder="10000" type="number"
              value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Amount Already Saved</label>
            <input style={inputStyle} placeholder="0" type="number"
              value={form.achieved} onChange={e => setForm(f => ({ ...f, achieved: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Target Deadline</label>
            <input style={inputStyle} type="date"
              value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !form.name || !form.target || !form.deadline}
            style={{
              height: 46, borderRadius: 'var(--radius-pill)',
              background: 'var(--color-primary)', color: '#fff',
              border: 'none', fontWeight: 600, fontSize: 14,
              fontFamily: 'var(--font-body)', cursor: 'pointer', marginTop: 4,
              opacity: saving || !form.name || !form.target || !form.deadline ? 0.5 : 1,
            }}
          >
            {saving ? 'Creating…' : 'Create Goal'}
          </button>
        </div>
      </Modal>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
