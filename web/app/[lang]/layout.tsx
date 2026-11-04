import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { AppShell } from '@/components/nav/AppShell'
import { isSupportedLanguage } from '@/lib/languages'

type LanguageLayoutProps = Readonly<{
  children: ReactNode
  params: Promise<{ lang: string }>
}>

export default async function LanguageLayout({ children, params }: LanguageLayoutProps) {
  const { lang } = await params

  if (!isSupportedLanguage(lang)) {
    notFound()
  }

  return (
    <AppShell language={lang}>
      <div className="flex-1">{children}</div>
    </AppShell>
  )
}
