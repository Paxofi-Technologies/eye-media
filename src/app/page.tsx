import { redirect } from 'next/navigation'

// Eye TV is the first Eye Media module to launch; the group homepage (SRS FR-01) replaces this later.
export default function Home() {
  redirect('/tv')
}
