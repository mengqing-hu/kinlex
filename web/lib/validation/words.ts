import { z } from 'zod'

import { sortOrders, wordLevels, wordSorts } from '@/lib/constants'

import { languageCodeSchema, limitSchema, optionalLanguageCodeSchema } from './common'

export { wordLevels, wordSorts }

const filterSchema = z.string().trim().min(1).max(100)

export const wordListParamsSchema = z.object({
  lang: languageCodeSchema,
  explain: optionalLanguageCodeSchema.default('en'),
  level: z.enum(wordLevels).optional(),
  q: filterSchema.optional(),
  pos: filterSchema.optional(),
  topic: filterSchema.optional(),
  morpheme: filterSchema.optional(),
  sort: z.enum(wordSorts).optional(),
  order: z.enum(sortOrders).optional(),
  favorites: z
    .literal('1')
    .transform(() => true)
    .optional(),
  cursor: z.string().trim().min(1, 'cursor cannot be empty').max(500).optional(),
  limit: limitSchema,
})

export type WordListParams = z.infer<typeof wordListParamsSchema>

export const wordIdsParamsSchema = wordListParamsSchema.extend({
  // Only the words the user has given a familiarity or marked as a favorite.
  marked: z.enum(['familiarity', 'favorites']).optional(),
})

export type WordIdsParams = z.infer<typeof wordIdsParamsSchema>

export const wordDetailParamsSchema = z.object({
  lang: languageCodeSchema,
  explain: optionalLanguageCodeSchema.default('en'),
})

export const wordSlugSchema = z
  .string({ error: 'slug is required' })
  .trim()
  .min(1, 'slug is required')
  .max(200, 'slug must be at most 200 characters')

export type WordDetailParams = z.infer<typeof wordDetailParamsSchema>
