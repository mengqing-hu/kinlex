'use client'

import { type ReactElement, useState } from 'react'

import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Link, usePathname } from '@/i18n/navigation'

interface SignInPromptProps {
  /** The control a guest clicked; for a guest it opens the prompt instead of doing its job. */
  children: ReactElement
  message: string
}

// Marking words needs an account. A guest who tries is asked to sign in right there, and comes
// back to the same page afterwards.
export function SignInPrompt({ children, message }: SignInPromptProps) {
  // Without the language: the login page and the sign-in callback keep the current one.
  const pathname = usePathname()
  const [returnPath, setReturnPath] = useState('/')

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setReturnPath(`${pathname}${window.location.search}`)
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="space-y-3"
        // Rows and cards open their word on a click anywhere inside, and React passes clicks in
        // the prompt up to them although it is drawn elsewhere on the page.
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-semibold">{message}</p>
        <GoogleSignInButton
          className="w-full rounded-md border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--info)]"
          nextPath={returnPath}
        />
        <Link
          className="block text-center text-sm text-[var(--mute)] hover:text-[var(--ink)]"
          href={`/login?next=${encodeURIComponent(returnPath)}`}
        >
          Sign in with email
        </Link>
      </PopoverContent>
    </Popover>
  )
}
