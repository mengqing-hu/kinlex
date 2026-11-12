import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'

import { Sidebar, type SidebarLink } from '@/components/nav/Sidebar'
import { WORD_PANEL_SLOT_ID } from '@/lib/wordPanel'
import { getLanguageDefinition, type SupportedLanguageCode } from '@/lib/languages'
import { listStudyVideos } from '@/lib/videos/studyFiles'

interface AppShellProps {
  children: ReactNode
  language: SupportedLanguageCode
}

// The site navigation as a left sidebar, with the page beside it.
export async function AppShell({ children, language }: AppShellProps) {
  const [t, videos] = await Promise.all([getTranslations('navigation'), listStudyVideos(language)])
  const base = `/${language}`
  const links: SidebarLink[] = [
    {
      href: `${base}/vocabulary/a1`,
      icon: 'levels',
      label: t('levels'),
      match: `${base}/vocabulary`,
    },
    { href: `${base}/word-parts`, icon: 'roots', label: t('roots'), match: `${base}/word-parts` },
    {
      href: `${base}/flashcards`,
      icon: 'flashcards',
      label: t('flashcards'),
      match: `${base}/flashcards`,
    },
    {
      href: `${base}/favorites`,
      icon: 'favorites',
      label: t('favorites'),
      match: `${base}/favorites`,
    },
    { href: `${base}/videos`, icon: 'videos', label: t('videos'), match: `${base}/videos` },
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
          videos: t('videos'),
          videoLibrary: t('videoLibrary'),
          video: {
            videoOptions: t('videoOptions'),
            rename: t('renameVideo'),
            delete: t('deleteVideo'),
            deleteConfirm: t.raw('deleteVideoConfirm') as string,
          },
        }}
        language={language}
        links={links}
        videos={videos.map((video) => ({
          id: video.id,
          href: `${base}/videos/${video.id}`,
          title: video.title,
        }))}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {/* The word detail panel portals in here, becoming the third column on wide screens. */}
      <div className="contents" id={WORD_PANEL_SLOT_ID} />
    </div>
  )
}
