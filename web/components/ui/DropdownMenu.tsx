'use client'

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import type { ComponentPropsWithoutRef } from 'react'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

type DropdownMenuContentProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>

export function DropdownMenuContent({
  align = 'start',
  className = '',
  sideOffset = 8,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        className={`z-50 min-w-40 rounded-xl border border-[var(--line)] bg-[var(--card)] p-1.5 text-[var(--ink)] shadow-xl outline-none ${className}`}
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

type DropdownMenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>

export function DropdownMenuItem({ className = '', ...props }: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={`flex cursor-default items-center rounded-lg px-3 py-2 text-sm font-medium outline-none select-none focus:bg-[var(--bg)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
      {...props}
    />
  )
}

type DropdownMenuSeparatorProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>

export function DropdownMenuSeparator({ className = '', ...props }: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      className={`-mx-1.5 my-1.5 h-px bg-[var(--line)] ${className}`}
      {...props}
    />
  )
}

export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

type DropdownMenuRadioItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>

// A choice in a single-select menu; the chosen one shows a check mark.
export function DropdownMenuRadioItem({
  children,
  className = '',
  ...props
}: DropdownMenuRadioItemProps) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={`relative flex cursor-default items-center rounded-lg py-2 pr-3 pl-8 text-sm outline-none select-none focus:bg-[var(--bg)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=checked]:font-semibold ${className}`}
      {...props}
    >
      <DropdownMenuPrimitive.ItemIndicator className="absolute left-2.5 inline-flex">
        <svg
          aria-hidden="true"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
          viewBox="0 0 24 24"
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </DropdownMenuPrimitive.ItemIndicator>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}
