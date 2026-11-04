'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { ComponentPropsWithoutRef } from 'react'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

type PopoverContentProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>

export function PopoverContent({
  align = 'end',
  className = '',
  sideOffset = 8,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        className={`z-50 w-64 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 text-[var(--ink)] shadow-xl outline-none ${className}`}
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
