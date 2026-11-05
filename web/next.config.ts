import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const securityHeaders = [
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=()',
  },
]

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  // The vocabulary and word part pages used to live under /levels and /roots; old links and
  // search results move along, keeping their query, such as an open word.
  async redirects() {
    return [
      {
        source: '/:lang([a-z]{2,3})/levels/:level',
        destination: '/:lang/vocabulary/:level',
        permanent: true,
      },
      { source: '/:lang([a-z]{2,3})/roots', destination: '/:lang/word-parts', permanent: true },
      {
        source: '/:lang([a-z]{2,3})/roots/:root',
        destination: '/:lang/word-parts/:root',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

export default withNextIntl(nextConfig)
