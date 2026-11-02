import { z } from 'zod'

const publicConfigSchema = z.object({
  supabaseUrl: z.url(),
  supabaseAnonKey: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  audioBaseUrl: z.string().min(1, 'NEXT_PUBLIC_AUDIO_BASE_URL is required'),
  siteUrl: z.url(),
})

export const config = publicConfigSchema.parse({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  audioBaseUrl: process.env.NEXT_PUBLIC_AUDIO_BASE_URL,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
})
