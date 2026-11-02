import { NextResponse } from 'next/server'

import packageMetadata from '@/package.json'
import { getSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await getSupabase()
    const { error } = await supabase.from('words').select('id', { head: true }).limit(1)

    if (error) {
      return NextResponse.json(
        {
          status: 'error',
          version: packageMetadata.version,
          checks: { database: 'unavailable' },
        },
        { status: 503 },
      )
    }

    return NextResponse.json({
      status: 'ok',
      version: packageMetadata.version,
      checks: { database: 'connected' },
    })
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        version: packageMetadata.version,
        checks: { database: 'unavailable' },
      },
      { status: 503 },
    )
  }
}
