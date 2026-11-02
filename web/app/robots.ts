import type { MetadataRoute } from 'next'

import { config } from '@/lib/config'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = config.siteUrl.replace(/\/$/, '')

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/login', '/me'],
    },
    host: baseUrl,
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
