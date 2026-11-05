import { z } from 'zod'

import { wordLevels } from '@/lib/constants'
import { FLASHCARD_DEFAULT_COUNT, FLASHCARD_MAX_COUNT, flashcardSources } from '@/lib/flashcards'

import { languageCodeSchema, optionalLanguageCodeSchema } from './common'

// Fields left out stay as they are, so the profile page and the settings page each save only
// their own.
export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).nullable(),
    // A file the user uploaded to their own folder of the avatars bucket.
    avatarPath: z
      .string()
      .regex(/^[0-9a-f-]{36}\/[\w-]+\.(webp|png)$/)
      .nullable(),
    nativeLanguage: languageCodeSchema,
    uiLanguage: languageCodeSchema,
    timezone: z.string().trim().min(1).max(100),
    profilePublic: z.boolean(),
  })
  .partial()

export const favoriteWordIdSchema = z.coerce.number().int().positive()

export const familiarityLevelSchema = z.number().int().min(0).max(5)

export const familiarityUpdateSchema = z.object({
  level: familiarityLevelSchema,
})

export const wordStateResetSchema = z.object({
  field: z.enum(['familiarity', 'favorites']),
  wordIds: z.array(z.number().int().positive()).max(20000),
})

export const flashcardDeckParamsSchema = z.object({
  lang: languageCodeSchema,
  explain: optionalLanguageCodeSchema.default('en'),
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(FLASHCARD_MAX_COUNT, `limit must be at most ${FLASHCARD_MAX_COUNT}`)
    .default(FLASHCARD_DEFAULT_COUNT),
  source: z.enum(flashcardSources).default('all'),
  // A comma-separated list such as "A1,B1"; empty or missing means every level.
  levels: z
    .string()
    .default('')
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.enum(wordLevels)).max(wordLevels.length)),
})

export const flashcardResults = ['know', 'learning'] as const

export const flashcardReviewSchema = z.object({
  result: z.enum(flashcardResults),
})

export const activityEventSchema = z.object({
  clientEventId: z.uuid(),
  language: languageCodeSchema,
  eventType: z.enum([
    'view_word',
    'play_audio',
    'favorite',
    'unfavorite',
    'self_test',
    'study_heartbeat',
  ]),
  targetType: z.string().trim().min(1).max(50).nullable(),
  targetId: z.number().int().positive().nullable(),
  value: z.number().int().min(0).max(3600).nullable(),
  occurredAt: z.iso.datetime(),
})

export const activityBatchSchema = z.object({
  events: z.array(activityEventSchema).min(1).max(100),
})

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>
export type FlashcardDeckParams = z.infer<typeof flashcardDeckParamsSchema>
export type FlashcardResult = (typeof flashcardResults)[number]
export type ActivityEventInput = z.infer<typeof activityEventSchema>
