import 'server-only'
import { db, schema } from '@/db'
import type { SessionUser } from './auth'

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'submission.created'
  | 'video.created'
  | 'video.updated'
  | 'video.published'
  | 'video.unpublished'
  | 'video.status_changed'
  | 'moderation.approved'
  | 'moderation.rejected'
  | 'moderation.flagged'
  | 'live.updated'
  | 'live.started'
  | 'live.ended'
  | 'live.cancelled'
  | 'live.event_created'
  | 'live.event_updated'
  | 'live.event_deleted'
  | 'live.replay_created'
  | 'schedule.created'
  | 'schedule.deleted'
  | 'user.created'
  | 'user.deactivated'
  | 'user.reactivated'

export const AUDIT_LABELS: Record<AuditAction, string> = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'submission.created': 'Submitted',
  'video.created': 'Created video',
  'video.updated': 'Edited metadata',
  'video.published': 'Published',
  'video.unpublished': 'Unpublished',
  'video.status_changed': 'Changed status',
  'moderation.approved': 'Approved & published',
  'moderation.rejected': 'Rejected',
  'moderation.flagged': 'Flagged for senior review',
  'live.updated': 'Updated live settings',
  'live.started': 'Went live',
  'live.ended': 'Ended live stream',
  'live.cancelled': 'Cancelled live event',
  'live.event_created': 'Scheduled live event',
  'live.event_updated': 'Edited live event',
  'live.event_deleted': 'Deleted live event',
  'live.replay_created': 'Created replay from live event',
  'schedule.created': 'Added schedule slot',
  'schedule.deleted': 'Removed schedule slot',
  'user.created': 'Created staff user',
  'user.deactivated': 'Deactivated staff user',
  'user.reactivated': 'Reactivated staff user',
}

export async function recordAudit(
  actor: Pick<SessionUser, 'id' | 'name'> | { id: null; name: string },
  action: AuditAction,
  target: { type: string; id?: string | null; label?: string | null },
  notes?: string | null,
) {
  await db.insert(schema.auditLog).values({
    actorId: actor.id,
    actorName: actor.name,
    action,
    targetType: target.type,
    targetId: target.id ?? null,
    targetLabel: target.label?.slice(0, 200) ?? null,
    notes: notes ?? null,
  })
}
