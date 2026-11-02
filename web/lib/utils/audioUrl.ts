import { config } from '@/lib/config'

export function getAudioUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null
  }

  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const baseUrl = /^https?:\/\//i.test(config.audioBaseUrl)
    ? config.audioBaseUrl
    : new URL(config.audioBaseUrl, config.siteUrl).toString()
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

  return new URL(path.replace(/^\/+/, ''), normalizedBase).toString()
}
