'use client'

import * as SwitchPrimitive from '@radix-ui/react-switch'
import type { ComponentPropsWithoutRef } from 'react'

type SwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>

export function Switch({ className = '', ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={`inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-[var(--line)] p-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--root)] ${className}`}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 rounded-full bg-[var(--card)] shadow-sm transition-transform data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  )
}
