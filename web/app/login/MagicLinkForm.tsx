'use client'

import Link from 'next/link'
import { type FormEvent, useState } from 'react'

import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { getBrowserSupabase } from '@/lib/supabase/browser'

type SubmissionState = 'idle' | 'submitting' | 'sent' | 'error' | 'oauth_error'

type MagicLinkFormProps = Readonly<{
  callbackFailed: boolean
  nextPath: string
  /** Why the visitor was sent here, when a page needs an account. */
  reason: string | null
}>

export function MagicLinkForm({ callbackFailed, nextPath, reason }: MagicLinkFormProps) {
  const [email, setEmail] = useState('')
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmissionState('submitting')

    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', nextPath)

    const supabase = getBrowserSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: true,
      },
    })

    setSubmissionState(error ? 'error' : 'sent')
  }

  const isSubmitting = submissionState === 'submitting'
  const isSent = submissionState === 'sent'

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <Link className="text-sm font-medium tracking-widest text-neutral-500 uppercase" href="/">
        Kinlex
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sign in</h1>
      {reason && <p className="mt-3 font-medium">{reason}</p>}
      <p className="mt-3 text-neutral-600 dark:text-neutral-300">
        Continue with Google, or enter your email address and we will send you a secure sign-in
        link.
      </p>

      <GoogleSignInButton
        className="mt-8 w-full rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
        nextPath={nextPath}
        onError={() => setSubmissionState('oauth_error')}
      />

      <div className="mt-6 flex items-center gap-3 text-xs text-neutral-500 uppercase">
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        or
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium" htmlFor="email">
            Email address
          </label>
          <input
            required
            autoComplete="email"
            className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-950 outline-none focus:border-neutral-600 focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:focus:border-neutral-400 dark:focus:ring-neutral-700"
            disabled={isSubmitting || isSent}
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (submissionState === 'error') {
                setSubmissionState('idle')
              }
            }}
          />
        </div>

        <button
          className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
          disabled={isSubmitting || isSent}
          type="submit"
        >
          {isSubmitting ? 'Sending link...' : isSent ? 'Link sent' : 'Send sign-in link'}
        </button>
      </form>

      <div aria-live="polite" className="mt-5 text-sm">
        {isSent ? (
          <p className="text-green-700 dark:text-green-400">
            Check your inbox and open the link to finish signing in.
          </p>
        ) : null}
        {submissionState === 'error' ? (
          <p className="text-red-700 dark:text-red-400">
            We could not send the sign-in link. Please try again.
          </p>
        ) : null}
        {submissionState === 'oauth_error' ? (
          <p className="text-red-700 dark:text-red-400">
            We could not start Google sign-in. Please try again.
          </p>
        ) : null}
        {callbackFailed ? (
          <p className="text-red-700 dark:text-red-400">
            Sign-in failed or the link has expired. Please try again.
          </p>
        ) : null}
      </div>
    </main>
  )
}
