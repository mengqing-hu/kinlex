import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import type { Database } from '@/types/db'
import type { TopicSummary } from '@/types/domain'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) {
    throw new RepositoryError(`Failed to ${operation}`, { cause: error })
  }
}

export async function findTopics(
  db: SupabaseClient<Database>,
  language: string,
): Promise<TopicSummary[]> {
  // Counted in the database: reading every word-topic row would stop at the API row limit.
  const { data, error } = await db.rpc('topic_counts', { p_language: language })
  assertQuerySucceeded(error, 'load topics')

  return (data ?? []).map((topic) => ({
    id: topic.id,
    slug: topic.slug,
    name: topic.name,
    icon: topic.icon,
    wordCount: topic.word_count,
  }))
}
