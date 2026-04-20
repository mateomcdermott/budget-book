interface ProgressBarProps {
  pct: number       // 0–1
  color?: string
  height?: number
}

export function ProgressBar({ pct, color = 'var(--color-primary)', height = 8 }: ProgressBarProps) {
  const w = Math.min(100, Math.max(0, pct * 100))
  return (
    <div style={{
      width: '100%', height,
      background: 'var(--color-border-solid)',
      borderRadius: height,
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${w}%`, height: '100%',
        background: color, borderRadius: height,
        transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
      }} />
    </div>
  )
}

export default ProgressBar
