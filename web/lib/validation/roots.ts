import { z } from 'zod'

import { languageCodeSchema, optionalLanguageCodeSchema } from './common'

export const rootListParamsSchema = z.object({
  lang: languageCodeSchema,
  explain: optionalLanguageCodeSchema.default('en'),
})

export const rootSlugSchema = z
  .string({ error: 'root is required' })
  .trim()
  .min(1, 'root is required')
  .max(100, 'root must be at most 100 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'root must be a lowercase slug')
