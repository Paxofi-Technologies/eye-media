import Link from 'next/link'

export function EyeGlyph() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M4 24C10 12 18 7 24 7C30 7 38 12 44 24C38 30 30 33 24 33C18 33 10 30 4 24Z"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M24 15C20 15 17 18 18.5 21.5C19.5 24 22 24.5 22 22.5C22 21 20.5 21 20.5 22.5C20.5 25 24 26 26 23.5"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export function Logo({ href, sub, label }: { href: string; sub: string; label?: string }) {
  return (
    <Link className="brand-mark" href={href} aria-label={label ?? `Eye ${sub}`}>
      <span className="logo-icon">
        <EyeGlyph />
      </span>
      <span className="brand-text" aria-hidden="true">
        <span className="eye">EYE</span>
        <span className="rule" />
        <span className="sub">{sub}</span>
      </span>
    </Link>
  )
}
