import Link from 'next/link'

import { LanguageSwitcher } from '@/components/nav/LanguageSwitcher'
import { UserMenu } from '@/components/nav/UserMenu'
import type { SupportedLanguageCode } from '@/lib/languages'

interface TopNavLabels {
  account: string
  home: string
  learningLanguage: string
  mainNavigation: string
  signIn: string
}

interface TopNavProps {
  language: SupportedLanguageCode
  labels: TopNavLabels
}

export function TopNav({ language, labels }: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color:var(--card)]/95 backdrop-blur">
      <nav
        aria-label={labels.mainNavigation}
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-5 py-3 sm:px-8"
      >
        <Link
          aria-label={labels.home}
          className="mr-auto rounded-lg px-1 py-2 text-lg font-semibold tracking-tight text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
          href="/"
        >
          {labels.home}
        </Link>

        <LanguageSwitcher currentLanguage={language} label={labels.learningLanguage} />
        <UserMenu accountLabel={labels.account} signInLabel={labels.signIn} />
      </nav>
    </header>
  )
}
