import type { ReactNode } from 'react'

/** Label + control + hint/error wiring with the right aria attributes. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <div className="field-hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
      {error && (
        <div className="field-error" id={`${id}-error`}>
          {error}
        </div>
      )}
    </div>
  )
}
