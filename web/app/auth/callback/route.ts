import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getSupabase } from '@/lib/supabase/server'
import { getSafeRedirectPath } from '@/lib/utils/redirect'

function createLoginErrorResponse(request: NextRequest, nextPath: string) {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  loginUrl.searchParams.set('error', 'auth_callback_failed')
  loginUrl.searchParams.set('next', nextPath)

  return NextResponse.redirect(loginUrl)
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const nextPath = getSafeRedirectPath(request.nextUrl.searchParams.get('next'))

  if (!code) {
    return createLoginErrorResponse(request, nextPath)
  }

  const supabase = await getSupabase()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return createLoginErrorResponse(request, nextPath)
  }

  return NextResponse.redirect(new URL(nextPath, request.url))
}
