import type { ComponentPropsWithoutRef } from 'react'

export function Card({ className = '', ...props }: ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      className={`rounded-xl border border-[var(--line)] bg-[var(--card)] p-5 ${className}`}
      {...props}
    />
  )
}
