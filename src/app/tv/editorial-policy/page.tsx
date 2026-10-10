import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Editorial policy',
  description: 'How Eye TV reviews and verifies citizen and staff reports before publication.',
  alternates: { canonical: '/tv/editorial-policy' },
}

export default function EditorialPolicyPage() {
  return (
    <div className="wrap narrow section-pad prose">
      <div className="section-head">
        <h1>Editorial policy</h1>
      </div>
      <div className="alert alert-info">
        Draft for owner review. Final wording of the editorial, privacy and contributor terms must be approved by Eye
        Media Group before public launch.
      </div>
      <p>
        Eye TV operates on an <strong>Open Access + Professional Gatekeeping</strong> model: anyone can send us a
        story, but nothing is published until a trained Eye Media editor has reviewed it.
      </p>
      <h2 id="submissions">How submissions are reviewed</h2>
      <ol>
        <li>Your submission enters a private moderation queue with a unique reference number.</li>
        <li>An editor checks the source, the footage and the location and time of the events shown.</li>
        <li>Content that is graphic, identifies minors or cannot be corroborated is not published.</li>
        <li>Approved reports are published to Eye TV. Reports marked “Verified” have passed every check.</li>
      </ol>
      <h2>Your personal information</h2>
      <p>
        Contact details you give us are only visible to Eye Media editors, are used solely to verify your report, and
        are never published.
      </p>
      <h2>Corrections</h2>
      <p>
        If you believe a published report is inaccurate, contact the newsroom quoting the report title. Every change
        to a published report is recorded in our internal audit log.
      </p>
      <p>
        <Link className="btn btn-primary" href="/tv/submit">
          Report a story
        </Link>
      </p>
    </div>
  )
}
