import { z } from 'zod'

import { languageCodeSchema } from './common'

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(80).nullable(),
  nativeLanguage: languageCodeSchema,
  uiLanguage: languageCodeSchema,
  timezone: z.string().trim().min(1).max(100),
  profilePublic: z.boolean(),
})

export const favoriteWordIdSchema = z.coerce.number().int().positive()

export const favoriteMergeSchema = z.object({
  wordIds: z.array(z.number().int().positive()).max(500),
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
export type ActivityEventInput = z.infer<typeof activityEventSchema>
