import { z } from 'zod'

import { languageCodeSchema, limitSchema, optionalLanguageCodeSchema } from './common'

export const searchParamsSchema = z.object({
  lang: languageCodeSchema.default('de'),
  q: z.string().trim().min(1, 'q is required').max(100, 'q must be at most 100 characters'),
  explain: optionalLanguageCodeSchema.default('en'),
  limit: limitSchema.default(20),
})

export type SearchParams = z.infer<typeof searchParamsSchema>
