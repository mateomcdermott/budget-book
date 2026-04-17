// Auth layout — centered, full-screen, with ambient background orbs.
// Individual pages (login / signup / verify) render inside this shell.
export const dynamic = 'force-dynamic'
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center"
         style={{ background: 'var(--color-bg)' }}>
      {/* Ambient orbs — match the reference HTML mockups */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />
      {children}
    </div>
  )
}
