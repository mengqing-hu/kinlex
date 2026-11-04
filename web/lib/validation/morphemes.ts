import { z } from 'zod'

import { languageCodeSchema, optionalLanguageCodeSchema } from '@/lib/validation/common'

export const morphemeWordsParamsSchema = z.object({
  lang: languageCodeSchema,
  explain: optionalLanguageCodeSchema.default('en'),
  // A few for the hover card by default; the roots page's side panel asks for every word.
  limit: z.coerce
    .number({ error: 'limit must be a number' })
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(500, 'limit must be at most 500')
    .default(8),
})

export const morphemeIdSchema = z.coerce
  .number({ error: 'id must be a number' })
  .int('id must be an integer')
  .positive('id must be positive')

export type MorphemeWordsParams = z.infer<typeof morphemeWordsParamsSchema>
