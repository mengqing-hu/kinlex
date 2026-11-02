'use server'

import { redirect } from 'next/navigation'

import { getSupabase } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await getSupabase()
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error('Failed to sign out')
  }

  redirect('/login')
}
