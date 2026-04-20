import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  trend?: { value: string; up: boolean }
}

export function StatCard({ label, value, icon: Icon, iconColor, iconBg, trend }: StatCardProps) {
  return (
    <div style={{
      background: 'var(--color-card)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--color-border-solid)',
      padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)', fontFamily: 'var(--font-body)' }}>
          {label}
        </span>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor,
        }}>
          <Icon size={17} />
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700, fontSize: 26,
        color: 'var(--color-text-1)',
        letterSpacing: '-0.02em',
        marginBottom: trend ? 8 : 0,
      }}>
        {value}
      </div>
      {trend && (
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: trend.up ? 'var(--color-income)' : 'var(--color-expense)',
          fontFamily: 'var(--font-body)',
        }}>
          {trend.up ? '▲' : '▼'} {trend.value}
        </div>
      )}
    </div>
  )
}

export default StatCard
