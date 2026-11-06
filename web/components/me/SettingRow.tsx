import type { ReactNode } from 'react'

// A label on the left, with an optional hint below it, and its value or control on the right.
export function SettingRow({
  label,
  hint,
  labelFor,
  children,
}: {
  label: string
  hint?: string
  labelFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        {labelFor ? (
          <label className="text-sm text-[var(--ink)]" htmlFor={labelFor}>
            {label}
          </label>
        ) : (
          <p className="text-sm text-[var(--ink)]">{label}</p>
        )}
        {hint ? <p className="mt-0.5 text-sm text-[var(--mute)]">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 shrink-0 justify-end">{children}</div>
    </div>
  )
}
