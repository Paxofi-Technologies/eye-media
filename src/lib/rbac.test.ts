import { describe, expect, it } from 'vitest'
import { PERMISSIONS, can, canEditVideo, canViewVideo } from './rbac'

describe('can', () => {
  it('grants admins everything', () => {
    for (const p of PERMISSIONS) expect(can('admin', p)).toBe(true)
  })
  it('only lets editors and admins publish', () => {
    expect(can('editor', 'video.publish')).toBe(true)
    expect(can('moderator', 'video.publish')).toBe(false)
    expect(can('media_manager', 'video.publish')).toBe(false)
    expect(can('reporter', 'video.publish')).toBe(false)
  })
  it('reserves user management for admins', () => {
    expect(can('editor', 'users.manage')).toBe(false)
  })
  it('denies anonymous callers', () => {
    expect(can(null, 'video.view')).toBe(false)
    expect(can(undefined, 'queue.view')).toBe(false)
  })
})

describe('reporters', () => {
  const me = { id: 'u1', role: 'reporter' as const }
  it('can create videos but not publish or moderate', () => {
    expect(can('reporter', 'video.edit')).toBe(true)
    expect(can('reporter', 'video.publish')).toBe(false)
    expect(can('reporter', 'queue.moderate')).toBe(false)
  })
  it('can edit only their own drafts', () => {
    expect(canEditVideo(me, { reporterId: 'u1', status: 'draft' })).toBe(true)
    expect(canEditVideo(me, { reporterId: 'u1', status: 'rejected' })).toBe(true)
    expect(canEditVideo(me, { reporterId: 'u1', status: 'pending' })).toBe(false)
    expect(canEditVideo(me, { reporterId: 'u1', status: 'published' })).toBe(false)
    expect(canEditVideo(me, { reporterId: 'u2', status: 'draft' })).toBe(false)
  })
  it('can see only their own videos, while editors see all', () => {
    expect(canViewVideo(me, { reporterId: 'u1' })).toBe(true)
    expect(canViewVideo(me, { reporterId: 'u2' })).toBe(false)
    expect(canViewVideo({ id: 'e1', role: 'editor' }, { reporterId: 'u2' })).toBe(true)
  })
})
