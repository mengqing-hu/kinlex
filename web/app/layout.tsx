import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AudioProvider } from '@/components/audio/AudioProvider'
import { ActivityHeartbeat } from '@/components/activity/ActivityHeartbeat'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Kinlex',
    template: '%s | Kinlex',
  },
  description: 'Learn German vocabulary through words, examples, and word families.',
}

type RootLayoutProps = Readonly<{
  children: ReactNode
}>

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <AudioProvider>
          <ActivityHeartbeat />
          {children}
        </AudioProvider>
      </body>
    </html>
  )
}
