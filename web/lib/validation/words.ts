import { z } from 'zod'

import { languageCodeSchema, limitSchema, optionalLanguageCodeSchema } from './common'

const filterSchema = z.string().trim().min(1).max(100)
export const wordLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export const wordSorts = ['familiarity_asc', 'familiarity_desc'] as const

export const wordListParamsSchema = z.object({
  lang: languageCodeSchema,
  explain: optionalLanguageCodeSchema.default('en'),
  level: z.enum(wordLevels).optional(),
  q: filterSchema.optional(),
  pos: filterSchema.optional(),
  topic: filterSchema.optional(),
  morpheme: filterSchema.optional(),
  sort: z.enum(wordSorts).optional(),
  cursor: z.string().trim().min(1, 'cursor cannot be empty').max(500).optional(),
  limit: limitSchema,
})

export type WordListParams = z.infer<typeof wordListParamsSchema>

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
