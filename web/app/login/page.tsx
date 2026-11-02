import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getSupabase } from '@/lib/supabase/server'
import { getSafeRedirectPath } from '@/lib/utils/redirect'

import { MagicLinkForm } from './MagicLinkForm'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Kinlex with a secure email link.',
}

type LoginPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>
}>

function getSearchParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const nextPath = getSafeRedirectPath(getSearchParam(params.next))
  const callbackFailed = getSearchParam(params.error) === 'auth_callback_failed'

  const supabase = await getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(nextPath)
  }

  return <MagicLinkForm callbackFailed={callbackFailed} nextPath={nextPath} />
}
