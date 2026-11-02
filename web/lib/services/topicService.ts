import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError, UnsupportedLanguageError } from '@/lib/errors'
import { isSupportedLanguage } from '@/lib/languages'
import { findTopics } from '@/lib/repositories/topicRepository'
import type { Database } from '@/types/db'
import type { TopicSummary } from '@/types/domain'

export async function listTopics(
  db: SupabaseClient<Database>,
  language: string,
): Promise<TopicSummary[]> {
  if (!isSupportedLanguage(language)) {
    throw new UnsupportedLanguageError(language)
  }

  return findTopics(db, language)
}

export async function getTopic(
  db: SupabaseClient<Database>,
  language: string,
  slug: string,
): Promise<TopicSummary> {
  const topics = await listTopics(db, language)
  const topic = topics.find((candidate) => candidate.slug === slug)

  if (!topic) {
    throw new NotFoundError('Topic not found')
  }

  return topic
}
