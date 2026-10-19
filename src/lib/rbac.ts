import type { Role } from '@/db/schema'

/**
 * Central permission map (SRS FR-09: "implemented centrally rather than separately inside each module").
 * Every server action and admin page checks one of these permissions; UI hiding is cosmetic only.
 */
export const PERMISSIONS = [
  'queue.view',
  'queue.moderate',
  'video.view',
  'video.edit',
  'video.publish',
  'live.manage',
  'schedule.manage',
  'audit.view',
  'users.manage',
  'submission.contact.view',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  editor: [
    'queue.view',
    'queue.moderate',
    'video.view',
    'video.edit',
    'video.publish',
    'live.manage',
    'schedule.manage',
    'audit.view',
    'submission.contact.view',
  ],
  moderator: ['queue.view', 'queue.moderate', 'video.view', 'submission.contact.view'],
  media_manager: ['video.view', 'video.edit', 'live.manage', 'schedule.manage'],
  // Reporters (Eye Media staff in the field) create and edit their own drafts and send them for review.
  reporter: ['video.view', 'video.edit'],
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  editor: 'Editor',
  moderator: 'Moderator',
  media_manager: 'Media manager',
  reporter: 'Reporter',
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role].includes(permission)
}

type OwnedVideo = { reporterId: string | null; status: string }

/** Reporters may only see their own videos. Everyone else with `video.view` sees all. */
export function canViewVideo(user: { id: string; role: Role }, video: Pick<OwnedVideo, 'reporterId'>): boolean {
  if (!can(user.role, 'video.view')) return false
  return user.role !== 'reporter' || video.reporterId === user.id
}

/** Reporters may edit only their own drafts (or ones sent back to them); editors and managers edit any video. */
export function canEditVideo(user: { id: string; role: Role }, video: OwnedVideo): boolean {
  if (!can(user.role, 'video.edit')) return false
  if (user.role !== 'reporter') return true
  return video.reporterId === user.id && (video.status === 'draft' || video.status === 'rejected')
}
