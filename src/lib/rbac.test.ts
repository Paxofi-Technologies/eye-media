import { describe, expect, it } from 'vitest'
import { PERMISSIONS, can } from './rbac'

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
  it('keeps submitter PII away from roles that do not moderate', () => {
    expect(can('media_manager', 'submission.contact.view')).toBe(false)
    expect(can('reporter', 'submission.contact.view')).toBe(false)
    expect(can('moderator', 'submission.contact.view')).toBe(true)
  })
  it('reserves user management for admins', () => {
    expect(can('editor', 'users.manage')).toBe(false)
  })
  it('denies anonymous callers', () => {
    expect(can(null, 'video.view')).toBe(false)
    expect(can(undefined, 'queue.view')).toBe(false)
  })
})
