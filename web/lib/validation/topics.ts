import { z } from 'zod'

import { languageCodeSchema } from './common'

export const topicListParamsSchema = z.object({
  lang: languageCodeSchema,
})

export const topicSlugSchema = z
  .string({ error: 'topic is required' })
  .trim()
  .min(1, 'topic is required')
  .max(100, 'topic must be at most 100 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'topic must be a lowercase slug')
