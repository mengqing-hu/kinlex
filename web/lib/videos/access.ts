import 'server-only'

import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { getSupabase } from '@/lib/supabase/server'

// Video study runs the pipeline and reads downloaded files on this computer, so it is on in local
// development and off on a deployed site unless VIDEOS_ENABLED=true.
export function videosEnabled(): boolean {
  if (process.env.VIDEOS_ENABLED === 'true') return true
  if (process.env.VIDEOS_ENABLED === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function canUseVideos(user: User | null): boolean {
  if (!videosEnabled() || user === null) return false
  const allowed = adminEmails()
  // A local installation without ADMIN_EMAILS has a single learner; a deployed one always needs
  // the list.
  if (allowed.length === 0) return process.env.NODE_ENV !== 'production'
  return Boolean(user.email && allowed.includes(user.email.toLowerCase()))
}

export async function currentUser(): Promise<User | null> {
  const db = await getSupabase()
  const { data } = await db.auth.getUser()
  return data.user ?? null
}

// For video API routes: the signed-in user who may use video study, or the response to send
// instead. Off or not allowed answers 404, so the routes look absent; signed out answers 401.
export async function videoRouteUser(): Promise<
  { user: User; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  if (!videosEnabled()) return { response: new NextResponse(null, { status: 404 }) }
  const user = await currentUser()
  if (!user) return { response: new NextResponse(null, { status: 401 }) }
  if (!canUseVideos(user)) return { response: new NextResponse(null, { status: 404 }) }
  return { user }
}
