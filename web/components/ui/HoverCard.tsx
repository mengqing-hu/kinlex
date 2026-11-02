'use client'

import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import type { ComponentPropsWithoutRef } from 'react'

export const HoverCard = HoverCardPrimitive.Root
export const HoverCardTrigger = HoverCardPrimitive.Trigger

type HoverCardContentProps = ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>

export function HoverCardContent({
  className = '',
  sideOffset = 8,
  ...props
}: HoverCardContentProps) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        className={`data-[state=closed]:animate-out data-[state=open]:animate-in z-50 w-80 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 text-[var(--ink)] shadow-xl outline-none ${className}`}
        sideOffset={sideOffset}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
}
