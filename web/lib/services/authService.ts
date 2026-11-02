import type { SupabaseClient, User } from '@supabase/supabase-js'

import { UnauthorizedError } from '@/lib/errors'
import type { Database } from '@/types/db'

export async function requireUser(db: SupabaseClient<Database>): Promise<User> {
  const { data, error } = await db.auth.getUser()
  if (error || !data.user) throw new UnauthorizedError()
  return data.user
}
