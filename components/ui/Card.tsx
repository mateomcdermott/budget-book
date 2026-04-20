import { CSSProperties, ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  style?: CSSProperties
}

export function Card({ children, style }: CardProps) {
  return (
    <div style={{
      background: 'var(--color-card)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--color-border-solid)',
      ...style,
    }}>
      {children}
    </div>
  )
}

export default Card
