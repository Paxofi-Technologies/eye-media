import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Editorial policy',
  description: 'How Eye TV reviews and verifies reports before publication.',
  alternates: { canonical: '/tv/editorial-policy' },
}

export default function EditorialPolicyPage() {
  return (
    <div className="wrap narrow section-pad prose">
      <div className="section-head">
        <h1>Editorial policy</h1>
      </div>
      <p>
        Eye TV is produced by Eye Media staff and reporters. Nothing is published until an Eye Media editor has
        reviewed it. Members of the public who want to report something can do so through Eye Report.
      </p>
      <h2 id="review">How reports are reviewed</h2>
      <ol>
        <li>A reporter’s video enters a private review queue.</li>
        <li>An editor checks the source, the footage and the location and time of the events shown.</li>
        <li>Content that is graphic, identifies minors or cannot be corroborated is not published.</li>
        <li>Approved reports are published to Eye TV. Reports marked “Verified” have passed every check.</li>
      </ol>
      <h2>Corrections</h2>
      <p>
        If you believe a published report is inaccurate, contact the newsroom quoting the report title. Every change
        to a published report is recorded in our internal audit log.
      </p>
    </div>
  )
}
