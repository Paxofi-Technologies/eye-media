import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="wrap" style={{ padding: '80px 24px', textAlign: 'center' }}>
      <h1 style={{ fontWeight: 800 }}>Page not found</h1>
      <p style={{ color: 'var(--fg-lo)' }}>The page you are looking for has moved or was never published.</p>
      <Link className="btn btn-primary" href="/tv">
        Go to Eye TV
      </Link>
    </div>
  )
}
