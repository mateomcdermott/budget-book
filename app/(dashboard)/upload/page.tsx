'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, ArrowRight, AlertTriangle, X } from 'lucide-react'
import { Lock, ShieldCheck, EyeOff, Ban } from 'lucide-react'
import type { ParsedTransaction } from '@/lib/csvParser'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

const fmt = (n: number) =>
  Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const BANKS = [
  'Chase', 'Bank of America', 'Amex', 'Citi', 'Wells Fargo',
  'Capital One', 'Apple Card', 'Discover', 'Venmo', 'Cash App',
  'TD Bank', 'US Bank', 'Ally', 'Fidelity', 'SoFi',
]

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  height: 46, padding: '0 24px', borderRadius: 'var(--radius-pill)',
  background: 'var(--color-primary)', color: '#fff',
  border: 'none', fontWeight: 600, fontSize: 14,
  fontFamily: 'var(--font-body)', cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  height: 42, padding: '0 20px', borderRadius: 'var(--radius-pill)',
  background: 'none', color: 'var(--color-text-2)',
  border: '1.5px solid var(--color-border-solid)', fontWeight: 600, fontSize: 14,
  fontFamily: 'var(--font-body)', cursor: 'pointer',
}

type Stage = 'idle' | 'parsing' | 'preview' | 'success'

type AnnotatedTx = ParsedTransaction & { _action: 'insert' | 'skip' | 'replace' }

function dupeColor(status?: string) {
  if (status === 'likely_duplicate') return { bg: 'var(--color-expense-light)', color: 'var(--color-expense)', label: 'Likely duplicate' }
  if (status === 'possible_duplicate') return { bg: '#FEF3C7', color: '#92400E', label: 'Possible duplicate' }
  return null
}

export default function UploadPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  const [stage, setStage]               = useState<Stage>('idle')
  const [dragging, setDragging]         = useState(false)
  const [fileName, setFileName]         = useState('')
  const [source, setSource]             = useState('')
  const [transactions, setTransactions] = useState<AnnotatedTx[]>([])
  const [errors, setErrors]             = useState<string[]>([])
  const [importing, setImporting]       = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [parseError, setParseError]     = useState('')

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Only CSV files are supported right now.')
      return
    }
    setFileName(file.name)
    setParseError('')
    setStage('parsing')

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/upload', { method: 'POST', body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setParseError(err.error ?? 'Upload failed. Please try again.')
      setStage('idle')
      return
    }

    const data = await res.json()
    setSource(data.source)
    setErrors(data.errors ?? [])
    setTransactions(
      (data.transactions as ParsedTransaction[]).map(t => ({
        ...t,
        _action: t.duplicate_status === 'likely_duplicate' ? 'skip' : 'insert',
      }))
    )
    setStage('preview')
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  function reset() {
    setStage('idle')
    setFileName('')
    setSource('')
    setTransactions([])
    setErrors([])
    setParseError('')
    setImportedCount(0)
  }

  function toggleAction(idx: number, action: AnnotatedTx['_action']) {
    setTransactions(prev => prev.map((t, i) => i === idx ? { ...t, _action: action } : t))
  }

  async function handleConfirm() {
    const toSend = transactions.filter(t => t._action !== 'skip')
    if (toSend.length === 0) { setStage('success'); setImportedCount(0); return }
    setImporting(true)

    const res = await fetch('/api/upload/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: toSend, filename: fileName }),
    })
    const data = await res.json()
    setImportedCount((data.inserted ?? 0) + (data.replaced ?? 0))
    setImporting(false)
    setStage('success')
  }

  const cardBase: React.CSSProperties = {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border-solid)',
  }

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (stage === 'idle' || stage === 'parsing') return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 720, margin: '0 auto' }}>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => stage === 'idle' && fileRef.current?.click()}
        style={{
          borderRadius: 'var(--radius-card)',
          border: `2px dashed ${dragging ? 'var(--color-primary)' : '#D4D0C8'}`,
          background: dragging ? 'var(--color-primary-light)' : 'var(--color-bg)',
          padding: isMobile ? '48px 24px' : '64px 40px 56px',
          textAlign: 'center',
          transition: 'border-color 0.15s, background 0.15s',
          cursor: stage === 'idle' ? 'pointer' : 'default',
        }}
      >
        {stage === 'parsing' ? (
          <>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid var(--color-primary-light)',
              borderTop: '3px solid var(--color-primary)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--color-text-1)', letterSpacing: '-0.02em' }}>
              Parsing {fileName}…
            </p>
          </>
        ) : (
          <>
            <Upload size={40} strokeWidth={1.5} style={{ color: 'var(--color-text-3)', display: 'block', margin: '0 auto 20px' }} />
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: isMobile ? 22 : 28, color: 'var(--color-text-1)', letterSpacing: '-0.02em', marginBottom: 10 }}>
              Drop your statement here
            </p>
            <p style={{ fontSize: 14, color: 'var(--color-text-2)', fontFamily: 'var(--font-body)' }}>
              CSV export or PDF statement — we&apos;ll figure the rest out
            </p>
            {parseError && (
              <p style={{ marginTop: 16, fontSize: 13, color: 'var(--color-expense)', fontFamily: 'var(--font-body)' }}>
                {parseError}
              </p>
            )}
          </>
        )}
      </div>

      {/* Security trust row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '28px 4px', justifyContent: 'space-between' }}>
        {[
          { Icon: Lock,        label: 'Encrypted',         detail: 'TLS in transit · AES-256 at rest' },
          { Icon: ShieldCheck, label: 'SOC 2 Compliant',   detail: 'Supabase is SOC 2 Type II certified' },
          { Icon: EyeOff,      label: 'Private by Design', detail: 'Row Level Security isolates your account' },
          { Icon: Ban,         label: 'Never Shared',      detail: 'Your data is never sold or shared' },
        ].map(({ Icon, label, detail }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: '1 1 180px' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'var(--color-primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-primary)',
            }}>
              <Icon size={16} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)', fontFamily: 'var(--font-body)', marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-3)', fontFamily: 'var(--font-body)', lineHeight: 1.4 }}>{detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bank marquee */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, zIndex: 1, background: 'linear-gradient(to right, var(--color-bg), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, zIndex: 1, background: 'linear-gradient(to left, var(--color-bg), transparent)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', gap: 10, width: 'max-content', animation: 'marquee 28s linear infinite' }}>
          {[...BANKS, ...BANKS].map((bank, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '6px 16px', borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border-solid)',
              background: 'var(--color-card)',
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)',
              color: 'var(--color-text-2)', whiteSpace: 'nowrap',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              {bank}
            </span>
          ))}
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileInput} />

      <style>{`
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )

  // ── PREVIEW ───────────────────────────────────────────────────────────────
  if (stage === 'preview') {
    const active  = transactions.filter(t => t._action !== 'skip')
    const toImport = active.length
    const dupes    = transactions.filter(t => t.duplicate_status !== 'unique').length
    const totalExpenses = active.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const totalIncome   = active.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0)
    const net = totalIncome - totalExpenses

    return (
      <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--color-text-1)', marginBottom: 2 }}>
              {fileName} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-3)' }}>({source})</span>
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
              {transactions.length} transactions found · {toImport} will be imported
              {dupes > 0 && ` · ${dupes} possible duplicate${dupes !== 1 ? 's' : ''} flagged`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={reset} style={btnGhost}><X size={13} /> Cancel</button>
            <button onClick={handleConfirm} disabled={importing} style={{ ...btnPrimary, opacity: importing ? 0.6 : 1 }}>
              {importing ? 'Importing…' : `Import ${toImport}`} {!importing && <ArrowRight size={14} />}
            </button>
          </div>
        </div>

        {/* Metrics bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Importing',  value: `${toImport}`,                      sub: 'transactions',  color: 'var(--color-text-1)',  bg: 'var(--color-card)' },
            { label: 'Expenses',   value: fmt(totalExpenses),                  sub: 'debits',        color: 'var(--color-expense)', bg: 'var(--color-expense-light)' },
            { label: 'Income',     value: fmt(totalIncome),                    sub: 'credits',       color: 'var(--color-income)',  bg: 'var(--color-income-light)' },
            { label: 'Net',        value: `${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}`, sub: 'balance', color: net >= 0 ? 'var(--color-income)' : 'var(--color-expense)', bg: 'var(--color-card)' },
          ].map(({ label, value, sub, color, bg }) => (
            <div key={label} style={{
              background: bg, borderRadius: 16, padding: isMobile ? '12px 14px' : '14px 18px',
              border: '1px solid var(--color-border-solid)', boxShadow: 'var(--shadow-card)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-3)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color, fontFamily: 'var(--font-body)', lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 11, color: 'var(--color-text-3)', fontFamily: 'var(--font-body)', marginTop: 3 }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Dupe alert */}
        {dupes > 0 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '14px 18px', borderRadius: 16, marginBottom: 16,
            background: '#FEF3C7', border: '1px solid #FDE68A',
          }}>
            <AlertTriangle size={16} style={{ color: '#92400E', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: '#78350F', fontFamily: 'var(--font-body)' }}>
              {dupes} transaction{dupes !== 1 ? 's were' : ' was'} flagged as possible duplicates and set to <strong>Skip</strong>. Review below and change to <strong>Import</strong> if needed.
            </p>
          </div>
        )}

        {errors.length > 0 && (
          <div style={{ ...cardBase, padding: '12px 16px', marginBottom: 16, borderColor: 'var(--color-expense)' }}>
            {errors.map((e, i) => <p key={i} style={{ fontSize: 12, color: 'var(--color-expense)' }}>{e}</p>)}
          </div>
        )}

        {/* Table */}
        <div style={{ ...cardBase, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-body)', minWidth: 600 }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)' }}>
                {['Date', 'Name', 'Category', 'Amount', 'Status', 'Action'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: h === 'Amount' ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--color-text-3)',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    borderBottom: '1px solid var(--color-border-solid)', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, i) => {
                const dupe = dupeColor(tx.duplicate_status)
                const isSkip = tx._action === 'skip'
                return (
                  <tr key={i} style={{
                    borderBottom: i < transactions.length - 1 ? '1px solid var(--color-border-solid)' : 'none',
                    background: isSkip ? 'var(--color-bg)' : 'transparent',
                    opacity: isSkip ? 0.55 : 1,
                  }}>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{tx.date}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-1)', fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.name}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-2)' }}>{tx.category || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: tx.amount >= 0 ? 'var(--color-income)' : 'var(--color-expense)', whiteSpace: 'nowrap' }}>
                      {tx.amount >= 0 ? '+' : '−'}{fmt(tx.amount)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {dupe ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: dupe.bg, color: dupe.color }}>
                          {dupe.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--color-income-light)', color: 'var(--color-income)' }}>
                          New
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['insert', 'skip'] as const).map(action => (
                          <button
                            key={action}
                            onClick={() => toggleAction(i, action)}
                            style={{
                              fontSize: 11, fontWeight: 600, padding: '3px 10px',
                              borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                              fontFamily: 'var(--font-body)',
                              border: tx._action === action ? 'none' : '1px solid var(--color-border-solid)',
                              background: tx._action === action
                                ? (action === 'insert' ? 'var(--color-primary)' : 'var(--color-expense-light)')
                                : 'transparent',
                              color: tx._action === action
                                ? (action === 'insert' ? '#fff' : 'var(--color-expense)')
                                : 'var(--color-text-3)',
                            }}
                          >
                            {action === 'insert' ? 'Import' : 'Skip'}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px', maxWidth: 480, margin: '64px auto 0', textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'var(--color-income-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px', color: 'var(--color-income)',
      }}>
        <CheckCircle size={36} />
      </div>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--color-text-1)', letterSpacing: '-0.02em', marginBottom: 8 }}>
        Import complete
      </p>
      <p style={{ fontSize: 15, color: 'var(--color-text-2)', marginBottom: 32 }}>
        {importedCount} transaction{importedCount !== 1 ? 's' : ''} imported successfully.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button style={btnPrimary} onClick={() => router.push('/transactions')}>
          View Transactions <ArrowRight size={14} />
        </button>
        <button style={btnGhost} onClick={reset}>Upload Another</button>
      </div>
    </div>
  )
}
