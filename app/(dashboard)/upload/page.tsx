'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, CheckCircle, FileText, ArrowRight } from 'lucide-react'

// ── CSV parser (no external dep needed) ──────────────────────────────────────
function parseLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    const nx = line[i + 1]
    if (ch === '"') {
      if (quoted && nx === '"') { field += '"'; i++ }
      else quoted = !quoted
    } else if (ch === ',' && !quoted) {
      fields.push(field.trim()); field = ''
    } else {
      field += ch
    }
  }
  fields.push(field.trim())
  return fields
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
  return { headers, rows }
}

// Auto-map a header to a field name by keyword matching
function autoMap(headers: string[], keywords: string[]): string {
  return headers.find(h => keywords.some(k => h.toLowerCase().includes(k))) ?? ''
}

type Stage = 'idle' | 'mapping' | 'preview' | 'success'

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

const selectStyle: React.CSSProperties = {
  height: 44, borderRadius: 'var(--radius-input)',
  border: '1.5px solid var(--color-border-solid)',
  background: 'var(--color-bg)', padding: '0 14px',
  fontSize: 14, fontFamily: 'var(--font-body)',
  color: 'var(--color-text-1)', outline: 'none', width: '100%',
}

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('idle')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState({ name: '', amount: '', date: '', category: '' })
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)

  function processFile(file: File) {
    if (!file.name.endsWith('.csv')) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const { headers: h, rows: r } = parseCSV(e.target?.result as string)
      setHeaders(h)
      setRows(r)
      setMapping({
        name:     autoMap(h, ['name', 'description', 'merchant', 'payee', 'memo']),
        amount:   autoMap(h, ['amount', 'sum', 'value', 'debit', 'credit']),
        date:     autoMap(h, ['date', 'time', 'posted', 'transaction date']),
        category: autoMap(h, ['category', 'type', 'label', 'tag']),
      })
      setStage('mapping')
    }
    reader.readAsText(file)
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
    setHeaders([])
    setRows([])
    setMapping({ name: '', amount: '', date: '', category: '' })
    setImportedCount(0)
  }

  async function handleImport() {
    if (!mapping.name || !mapping.amount || !mapping.date) return
    setImporting(true)

    const inserts = rows
      .map(row => {
        const rawAmt = parseFloat(row[mapping.amount]?.replace(/[^0-9.\-]/g, '') || '0')
        const amt = isNaN(rawAmt) ? 0 : rawAmt
        return {
          name: row[mapping.name] || 'Unknown',
          amount: Math.abs(amt),
          date: row[mapping.date] || new Date().toISOString().split('T')[0],
          category: mapping.category ? (row[mapping.category] || 'Uncategorized') : 'Uncategorized',
          type: amt < 0 ? 'expense' : 'income',
        }
      })
      .filter(r => r.name && r.date)

    // Insert in batches of 100
    for (let i = 0; i < inserts.length; i += 100) {
      await supabase.from('transactions').insert(inserts.slice(i, i + 100))
    }

    setImportedCount(inserts.length)
    setImporting(false)
    setStage('success')
  }

  const previewRows = rows.slice(0, 7)
  const mappedCols = [mapping.name, mapping.amount, mapping.date, mapping.category].filter(Boolean)

  const cardBase: React.CSSProperties = {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border-solid)',
  }

  // ── IDLE ──────────────────────────────────────────────────────────────────
  const BANKS = [
    'Chase', 'Bank of America', 'Amex', 'Citi', 'Wells Fargo',
    'Capital One', 'Apple Card', 'Discover', 'Venmo', 'Cash App',
    'TD Bank', 'US Bank', 'Ally', 'Fidelity', 'SoFi',
  ]

  if (stage === 'idle') return (
    <div style={{ padding: '24px', maxWidth: 720, margin: '0 auto' }}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          borderRadius: 'var(--radius-card)',
          border: `2px dashed ${dragging ? 'var(--color-primary)' : '#D4D0C8'}`,
          background: dragging ? 'var(--color-primary-light)' : 'var(--color-bg)',
          padding: '64px 40px 56px',
          textAlign: 'center',
          transition: 'border-color 0.15s, background 0.15s',
          cursor: 'pointer',
        }}
      >
        <Upload
          size={40}
          strokeWidth={1.5}
          style={{ color: 'var(--color-text-3)', marginBottom: 20, display: 'block', margin: '0 auto 20px' }}
        />
        <p style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28,
          color: 'var(--color-text-1)', letterSpacing: '-0.02em', marginBottom: 10,
        }}>
          Drop your statement here
        </p>
        <p style={{
          fontSize: 14, color: 'var(--color-text-2)',
          fontFamily: 'var(--font-body)',
        }}>
          CSV export or PDF statement — we&apos;ll figure the rest out
        </p>
      </div>

      {/* Bank marquee */}
      <div style={{ position: 'relative', overflow: 'hidden', marginTop: 24 }}>
        {/* Fade masks */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, zIndex: 1,
          background: 'linear-gradient(to right, var(--color-bg), transparent)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, zIndex: 1,
          background: 'linear-gradient(to left, var(--color-bg), transparent)',
          pointerEvents: 'none',
        }} />

        {/* Scrolling track — duplicated for seamless loop */}
        <div style={{ display: 'flex', gap: 10, width: 'max-content', animation: 'marquee 28s linear infinite' }}>
          {[...BANKS, ...BANKS].map((bank, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '6px 16px', borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border-solid)',
              background: 'var(--color-card)',
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)',
              color: 'var(--color-text-2)', whiteSpace: 'nowrap',
              letterSpacing: '0.04em', textTransform: 'uppercase' as const,
            }}>
              {bank}
            </span>
          ))}
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileInput} />

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )

  // ── MAPPING ───────────────────────────────────────────────────────────────
  if (stage === 'mapping') return (
    <div style={{ padding: '24px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--color-primary-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-primary)',
        }}>
          <FileText size={18} />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-1)' }}>{fileName}</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)' }}>{rows.length} rows detected</p>
        </div>
        <button onClick={reset} style={{ ...btnGhost, marginLeft: 'auto', height: 36, padding: '0 14px', fontSize: 13 }}>
          <X size={13} /> Remove
        </button>
      </div>

      <div style={{ ...cardBase, padding: '28px' }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
          color: 'var(--color-text-1)', marginBottom: 4,
        }}>
          Map your columns
        </p>
        <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 24 }}>
          Tell us which CSV columns correspond to each transaction field.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {([
            { field: 'name' as const, label: 'Transaction Name', required: true },
            { field: 'amount' as const, label: 'Amount', required: true },
            { field: 'date' as const, label: 'Date', required: true },
            { field: 'category' as const, label: 'Category', required: false },
          ] as const).map(({ field, label, required }) => (
            <div key={field}>
              <label style={{
                fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)',
                fontFamily: 'var(--font-body)', display: 'block', marginBottom: 6,
              }}>
                {label} {required && <span style={{ color: 'var(--color-expense)' }}>*</span>}
              </label>
              <select
                value={mapping[field]}
                onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}
                style={selectStyle}
              >
                <option value="">— select column —</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 28 }}>
          <button onClick={reset} style={btnGhost}>Cancel</button>
          <button
            onClick={() => setStage('preview')}
            disabled={!mapping.name || !mapping.amount || !mapping.date}
            style={{ ...btnPrimary, opacity: !mapping.name || !mapping.amount || !mapping.date ? 0.5 : 1 }}
          >
            Preview <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )

  // ── PREVIEW ───────────────────────────────────────────────────────────────
  if (stage === 'preview') return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
            color: 'var(--color-text-1)', marginBottom: 2,
          }}>
            Preview — first {Math.min(7, rows.length)} of {rows.length} rows
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
            Highlighted columns will be imported.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setStage('mapping')} style={btnGhost}>Back</button>
          <button
            onClick={handleImport}
            disabled={importing}
            style={{ ...btnPrimary, opacity: importing ? 0.6 : 1 }}
          >
            {importing ? 'Importing…' : `Import ${rows.length} transactions`}
          </button>
        </div>
      </div>

      <div style={{ ...cardBase, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-body)' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg)' }}>
              {headers.map(h => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 700, color: 'var(--color-text-3)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: mappedCols.includes(h) ? 'var(--color-primary-light)' : 'var(--color-bg)',
                  borderBottom: '1px solid var(--color-border-solid)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                  {mappedCols.includes(h) && (
                    <span style={{ color: 'var(--color-primary)', marginLeft: 4 }}>✓</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: ri < previewRows.length - 1 ? '1px solid var(--color-border-solid)' : 'none' }}>
                {headers.map(h => (
                  <td key={h} style={{
                    padding: '10px 16px',
                    background: mappedCols.includes(h) ? 'var(--color-primary-light)' : 'transparent',
                    color: 'var(--color-text-1)',
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px', maxWidth: 480, margin: '64px auto 0', textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'var(--color-income-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
        color: 'var(--color-income)',
      }}>
        <CheckCircle size={36} />
      </div>
      <p style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
        color: 'var(--color-text-1)', letterSpacing: '-0.02em', marginBottom: 8,
      }}>
        Import complete
      </p>
      <p style={{ fontSize: 15, color: 'var(--color-text-2)', marginBottom: 32 }}>
        {importedCount} transaction{importedCount !== 1 ? 's' : ''} imported successfully.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button style={btnPrimary} onClick={() => router.push('/transactions')}>
          View Transactions <ArrowRight size={14} />
        </button>
        <button style={btnGhost} onClick={reset}>
          Upload Another
        </button>
      </div>
    </div>
  )
}
