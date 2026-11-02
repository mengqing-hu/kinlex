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
  const [topicsResult, relationsResult] = await Promise.all([
    db
      .from('tags')
      .select('id, slug, name, icon')
      .eq('type', 'topic')
      .order('name', { ascending: true }),
    db.from('word_tags').select('tag_id, words!inner(language)').eq('words.language', language),
  ])

  assertQuerySucceeded(topicsResult.error, 'load topics')
  assertQuerySucceeded(relationsResult.error, 'count topic words')

  const wordCountByTopicId = new Map<number, number>()
  for (const relation of relationsResult.data ?? []) {
    wordCountByTopicId.set(relation.tag_id, (wordCountByTopicId.get(relation.tag_id) ?? 0) + 1)
  }

  return (topicsResult.data ?? []).map((topic) => ({
    ...topic,
    wordCount: wordCountByTopicId.get(topic.id) ?? 0,
  }))
}
