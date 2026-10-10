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
  reporter: ['video.view'],
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
