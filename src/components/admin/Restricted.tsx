export function Restricted({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="4" y="10" width="16" height="10" rx="1" />
        <path d="M8 10V7a4 4 0 118 0v3" />
      </svg>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}
