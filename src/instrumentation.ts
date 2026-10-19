/** Runs once when the server starts. Keeps the EyeReport callback outbox moving without needing a cron job. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const g = globalThis as { __eyeReportTimer?: NodeJS.Timeout }
  if (g.__eyeReportTimer) return
  const { processOutbox } = await import('./lib/eye-report-callback')
  g.__eyeReportTimer = setInterval(() => void processOutbox().catch(() => undefined), 60_000)
  g.__eyeReportTimer.unref()
}
