import { z } from 'zod'

export const languageCodeSchema = z
  .string({ error: 'lang is required' })
  .regex(/^[a-z]{2,3}$/, 'lang must be a two or three letter lowercase language code')

export const optionalLanguageCodeSchema = z
  .string()
  .regex(/^[a-z]{2,3}$/, 'must be a two or three letter lowercase language code')

export const limitSchema = z.coerce
  .number({ error: 'limit must be a number' })
  .int('limit must be an integer')
  .min(1, 'limit must be at least 1')
  .max(100, 'limit must be at most 100')
  .default(50)

export function formatValidationError(error: z.ZodError): string {
  const issue = error.issues[0]

  if (!issue) {
    return 'Invalid request parameters'
  }

  const field = issue.path.join('.')
  return field && !issue.message.startsWith(field) ? `${field}: ${issue.message}` : issue.message
}
