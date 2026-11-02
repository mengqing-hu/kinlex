import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'

import { Footer } from '@/components/layout/Footer'
import { TopNav } from '@/components/nav/TopNav'
import { getLanguageDefinition, isSupportedLanguage } from '@/lib/languages'

type LanguageLayoutProps = Readonly<{
  children: ReactNode
  params: Promise<{ lang: string }>
}>

export default async function LanguageLayout({ children, params }: LanguageLayoutProps) {
  const { lang } = await params

  if (!isSupportedLanguage(lang)) {
    notFound()
  }

  const language = getLanguageDefinition(lang)
  const [navigation, footer] = await Promise.all([
    getTranslations('navigation'),
    getTranslations('footer'),
  ])

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        language={lang}
        labels={{
          account: navigation('account'),
          home: navigation('home'),
          learningLanguage: navigation('learningLanguage', { language: language.name }),
          mainNavigation: navigation('mainNavigation'),
          signIn: navigation('signIn'),
        }}
      />
      <div className="flex-1">{children}</div>
      <Footer
        copyright={footer('copyright', { year: new Date().getUTCFullYear() })}
        description={footer('description')}
      />
    </div>
  )
}
