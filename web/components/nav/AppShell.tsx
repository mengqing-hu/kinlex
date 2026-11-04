import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'

import { Sidebar, type SidebarLink } from '@/components/nav/Sidebar'
import { WORD_PANEL_SLOT_ID } from '@/lib/wordPanel'
import { getLanguageDefinition, type SupportedLanguageCode } from '@/lib/languages'

interface AppShellProps {
  children: ReactNode
  language: SupportedLanguageCode
}

// The site navigation as a left sidebar, with the page beside it.
export async function AppShell({ children, language }: AppShellProps) {
  const t = await getTranslations('navigation')
  const base = `/${language}`
  const links: SidebarLink[] = [
    { href: `${base}/levels/a1`, icon: 'levels', label: t('levels'), match: `${base}/levels` },
    { href: `${base}/topics`, icon: 'topics', label: t('topics'), match: `${base}/topics` },
    { href: `${base}/roots`, icon: 'roots', label: t('roots'), match: `${base}/roots` },
    { href: '/search', icon: 'search', label: t('search'), match: '/search' },
  ]

  return (
    <div className="min-h-screen md:flex">
      <Sidebar
        labels={{
          account: t('account'),
          closeMenu: t('closeMenu'),
          collapseSidebar: t('collapseSidebar'),
          expandSidebar: t('expandSidebar'),
          home: t('home'),
          learningLanguage: t('learningLanguage', {
            language: getLanguageDefinition(language).name,
          }),
          mainNavigation: t('mainNavigation'),
          openMenu: t('openMenu'),
          signIn: t('signIn'),
        }}
        language={language}
        links={links}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {/* The word detail panel portals in here, becoming the third column on wide screens. */}
      <div className="contents" id={WORD_PANEL_SLOT_ID} />
    </div>
  )
}
