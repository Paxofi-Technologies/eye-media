import Link from 'next/link'

export default function TvNotFound() {
  return (
    <div className="wrap section-pad" style={{ textAlign: 'center' }}>
      <h1 style={{ fontWeight: 800 }}>Report not found</h1>
      <p style={{ color: 'var(--fg-lo)' }}>This report may have been unpublished, or the link is incorrect.</p>
      <Link className="btn btn-primary" href="/tv/archive">
        Search the archive
      </Link>
    </div>
  )
}
