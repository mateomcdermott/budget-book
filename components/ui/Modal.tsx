'use client'

import { useEffect, ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: number
}

export function Modal({ open, onClose, title, children, maxWidth = 480 }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(26,26,46,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'bb-fadeIn 0.15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-card)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-elevated)',
          width: '100%', maxWidth,
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          animation: 'bb-slideUp 0.2s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {title != null && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '22px 24px 18px',
            borderBottom: '1px solid var(--color-border-solid)',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
              color: 'var(--color-text-1)', letterSpacing: '-0.01em', margin: 0,
            }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 8,
                border: 'none', background: 'var(--color-border-solid)',
                color: 'var(--color-text-2)', cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}
        <div style={{ padding: 24 }}>{children}</div>
      </div>
      <style>{`
        @keyframes bb-fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bb-slideUp { from { opacity: 0; transform: translateY(12px) scale(0.97) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  )
}

export default Modal
