interface GoalArcProps {
  achieved: number
  target: number
  size?: number
  strokeWidth?: number
}

export function GoalArc({ achieved, target, size = 120, strokeWidth = 10 }: GoalArcProps) {
  const pct = target > 0 ? Math.min(1, achieved / target) : 0
  const done = achieved >= target
  const color = done ? 'var(--color-income)' : 'var(--color-primary)'

  const r = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2

  // 270° arc: starts at 135° (bottom-left), sweeps clockwise to 45° (bottom-right)
  const startAngle = 135
  const sweep = 270

  function toXY(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function arc(start: number, end: number) {
    const s = toXY(start)
    const e = toXY(end)
    const large = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const trackPath = arc(startAngle, startAngle + sweep)
  const fillPath = pct > 0 ? arc(startAngle, startAngle + sweep * pct) : null
  const label = `${Math.round(pct * 100)}%`

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: 'block' }}>
        <path d={trackPath} fill="none" stroke="var(--color-border-solid)" strokeWidth={strokeWidth} strokeLinecap="round" />
        {fillPath && (
          <path d={fillPath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingBottom: size * 0.1,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: size * 0.18,
          color: done ? 'var(--color-income)' : 'var(--color-text-1)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {label}
        </span>
        {done && (
          <span style={{ fontSize: size * 0.1, color: 'var(--color-income)', marginTop: 2 }}>Done</span>
        )}
      </div>
    </div>
  )
}

export default GoalArc
