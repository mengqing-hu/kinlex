import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'

import { AudioProvider } from '@/components/audio/AudioProvider'
import { ActivityHeartbeat } from '@/components/activity/ActivityHeartbeat'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { getMessageLocale, getTextDirection, translatedLocales } from '@/i18n/locales'
import { routing } from '@/i18n/routing'
import { SIDEBAR_STORAGE_KEY } from '@/lib/sidebar'
import { themeScript } from '@/lib/theme'

import '../globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Kinlex',
    template: '%s | Kinlex',
  },
  description: 'Learn German vocabulary through words, examples, and word families.',
}

// Languages without their own interface text are rendered on their first visit instead.
export function generateStaticParams() {
  return translatedLocales.map((locale) => ({ locale }))
}

// Runs before the page paints, so a collapsed sidebar never flashes open. Reading the preference
// on the server would need a cookie, which would make every cached page dynamic.
const sidebarScript = `try{if(localStorage.getItem('${SIDEBAR_STORAGE_KEY}')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch(e){}`

type LocaleLayoutProps = Readonly<{
  children: ReactNode
  params: Promise<{ locale: string }>
}>

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  setRequestLocale(locale)
  const messageLocale = getMessageLocale(locale)

  return (
    <html dir={getTextDirection(messageLocale)} lang={messageLocale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: sidebarScript }} />
      </head>
      <body>
        {/* Gives client components the language for their links. Their text comes in as props,
            so the messages are not sent along. */}
        <NextIntlClientProvider messages={null}>
          <AudioProvider>
            {/* Hover meanings in example sentences show at once, as the reader moves along. */}
            <TooltipProvider delayDuration={0} skipDelayDuration={0}>
              <ActivityHeartbeat />
              {children}
            </TooltipProvider>
          </AudioProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
