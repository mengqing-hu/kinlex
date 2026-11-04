import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AudioProvider } from '@/components/audio/AudioProvider'
import { ActivityHeartbeat } from '@/components/activity/ActivityHeartbeat'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { SIDEBAR_STORAGE_KEY } from '@/lib/sidebar'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Kinlex',
    template: '%s | Kinlex',
  },
  description: 'Learn German vocabulary through words, examples, and word families.',
}

// Runs before the page paints, so a collapsed sidebar never flashes open. Reading the preference
// on the server would need a cookie, which would make every cached page dynamic.
const sidebarScript = `try{if(localStorage.getItem('${SIDEBAR_STORAGE_KEY}')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch(e){}`

type RootLayoutProps = Readonly<{
  children: ReactNode
}>

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: sidebarScript }} />
      </head>
      <body>
        <AudioProvider>
          {/* Hover meanings in example sentences show at once, as the reader moves along. */}
          <TooltipProvider delayDuration={0} skipDelayDuration={0}>
            <ActivityHeartbeat />
            {children}
          </TooltipProvider>
        </AudioProvider>
      </body>
    </html>
  )
}
