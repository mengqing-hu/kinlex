import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

import { isLocale } from '@/i18n/locales'
import { config } from '@/lib/config'
import type { Database } from '@/types/db'

// The language of an account page such as /zh/me/settings, or null for any other page.
function getAccountPageLocale(pathname: string): string | null {
  const [, locale = '', section] = pathname.split('/')
  return isLocale(locale) && section === 'me' ? locale : null
}

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        response = NextResponse.next({ request })

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const accountPageLocale = getAccountPageLocale(request.nextUrl.pathname)
  if (!user && accountPageLocale) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = `/${accountPageLocale}/login`
    // The way back leaves out the language, as the login page expects.
    const pathWithoutLocale = request.nextUrl.pathname.slice(accountPageLocale.length + 1)
    loginUrl.searchParams.set('next', `${pathWithoutLocale}${request.nextUrl.search}`)

    const redirectResponse = NextResponse.redirect(loginUrl)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })

    return { response: redirectResponse, user }
  }

  return { response, user }
}
