import type { Metadata } from 'next'
import { getCategories } from '@/lib/tv'
import { uploadsEnabled } from '@/lib/uploads'
import { SubmitForm } from './SubmitForm'

export const metadata: Metadata = {
  title: 'Report a story',
  description: 'Send a story or video to the Eye Media newsroom. Every submission is reviewed by an editor.',
  alternates: { canonical: '/tv/submit' },
}

export default async function SubmitPage() {
  const categories = await getCategories()
  return (
    <div className="wrap narrow section-pad">
      <div className="section-head">
        <h1>Report a story</h1>
      </div>
      <p className="page-intro">
        Eye TV is powered by people like you. Tell us what is happening in your community — an editor will review it,
        may contact you to verify details, and will publish it if it meets our standards.
      </p>
      <SubmitForm categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} uploadsEnabled={uploadsEnabled()} />
    </div>
  )
}
