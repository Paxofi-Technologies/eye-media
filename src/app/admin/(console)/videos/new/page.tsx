import type { Metadata } from 'next'
import Link from 'next/link'
import { Restricted } from '@/components/admin/Restricted'
import { VideoForm } from '@/components/admin/VideoForm'
import { requireStaff } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { getCategories } from '@/lib/tv'

export const metadata: Metadata = { title: 'New video' }

export default async function NewVideoPage() {
  const user = await requireStaff()
  if (!can(user.role, 'video.edit')) {
    return <Restricted title="Not available for your role">Ask an editor or media manager to register videos.</Restricted>
  }
  const categories = await getCategories()
  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>New video</h1>
          <div className="sub">Videos start as drafts. Submit for review or publish from the video page.</div>
        </div>
        <Link className="btn btn-ghost" href="/admin/videos">Cancel</Link>
      </div>
      <div style={{ maxWidth: 820 }}>
        <VideoForm initial={null} categories={categories} canEdit />
      </div>
    </>
  )
}
