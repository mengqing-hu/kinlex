import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

import { config } from '@/lib/config'
import type { Database } from '@/types/db'

// The content tables are only readable with this key, which the browser never sees, so the
// dictionary cannot be paged through with the public anon key alone.
function getServerKeyHeaders(): Record<string, string> {
  const serverKey = process.env.SUPABASE_SERVER_KEY
  if (!serverKey) throw new Error('SUPABASE_SERVER_KEY is required')
  return { 'x-kinlex-server-key': serverKey }
}

export function getPublicSupabase() {
  return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: getServerKeyHeaders() },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

export async function getSupabase() {
  const cookieStore = await cookies()

  return createServerClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: getServerKeyHeaders() },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the session.
        }
      },
    },
  })
}
