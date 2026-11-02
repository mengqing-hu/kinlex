import { z } from 'zod'

import { languageCodeSchema } from '@/lib/validation/common'

export const morphemeWordsParamsSchema = z.object({
  lang: languageCodeSchema,
})

export const morphemeIdSchema = z.coerce
  .number({ error: 'id must be a number' })
  .int('id must be an integer')
  .positive('id must be positive')

export type MorphemeWordsParams = z.infer<typeof morphemeWordsParamsSchema>
