'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentPropsWithoutRef } from 'react'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

type TooltipContentProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>

// Rendered at the top of the page, so a tooltip is not cut off by a row that clips its text.
export function TooltipContent({ className = '', sideOffset = 6, ...props }: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={`z-50 rounded-md bg-[var(--ink)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[var(--card)] not-italic shadow-md ${className}`}
        sideOffset={sideOffset}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}
