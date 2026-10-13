import type { VideoStatus } from '@/db/schema'

const LABELS: Record<VideoStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  flagged: 'Flagged',
  published: 'Published',
  rejected: 'Rejected',
  unpublished: 'Unpublished',
}

export function StatusPill({ status, extra }: { status: VideoStatus | 'live'; extra?: string }) {
  const label = status === 'live' ? 'Live' : LABELS[status]
  return (
    <span className={`status-pill status-${status}`}>
      {label}
      {extra ? ` · ${extra}` : ''}
    </span>
  )
}

export const STATUS_OPTIONS = Object.entries(LABELS) as [VideoStatus, string][]
