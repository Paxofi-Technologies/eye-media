export function PlayIcon({ size = 46 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="rgba(0,0,0,0.6)" stroke="#fff" strokeWidth="1.5" />
      <polygon points="26,20 46,32 26,44" fill="#fff" />
    </svg>
  )
}
