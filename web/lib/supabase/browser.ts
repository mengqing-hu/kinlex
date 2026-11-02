import { createBrowserClient } from '@supabase/ssr'

import { config } from '@/lib/config'
import type { Database } from '@/types/db'

export function getBrowserSupabase() {
  return createBrowserClient<Database>(config.supabaseUrl, config.supabaseAnonKey)
}
