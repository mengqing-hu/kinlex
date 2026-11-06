'use client'

import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react'

import { LanguageSwitcher } from '@/components/nav/LanguageSwitcher'
import { UserMenu } from '@/components/nav/UserMenu'
import { Link, usePathname } from '@/i18n/navigation'
import type { SupportedLanguageCode } from '@/lib/languages'
import { SIDEBAR_STORAGE_KEY } from '@/lib/sidebar'

export type SidebarIcon = 'levels' | 'grammar' | 'roots' | 'flashcards' | 'favorites'

export interface SidebarLink {
  href: string
  icon: SidebarIcon
  label: string
  // The path prefix that marks this link as current, e.g. every level under /de/vocabulary.
  match: string
}

export interface SidebarLabels {
  account: string
  closeMenu: string
  collapseSidebar: string
  expandSidebar: string
  home: string
  learningLanguage: string
  mainNavigation: string
  openMenu: string
  signIn: string
}

interface SidebarProps {
  labels: SidebarLabels
  language: SupportedLanguageCode
  links: readonly SidebarLink[]
}

const iconPaths: Record<SidebarIcon, ReactNode> = {
  levels: <path d="M5 20v-6M12 20V9M19 20V4" />,
  grammar: (
    <path d="M5 19.5V5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2Zm0 0A1.5 1.5 0 0 0 6.5 21H19M9 7.5h6M9 11h4" />
  ),
  roots: <path d="M12 21V9m0 0c0-3 2-5 5-5 0 3-2 5-5 5Zm0 4c0-3-2-5-5-5 0 3 2 5 5 5Z" />,
  flashcards: (
    <>
      <rect height="12" rx="2" width="15" x="6" y="8" />
      <path d="M3 15V6a2 2 0 0 1 2-2h11" />
    </>
  ),
  favorites: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />,
}

function Icon({ children, className = 'size-5' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  )
}

// The collapsed flag lives on <html> so CSS can style it before React runs; React only mirrors it.
function subscribeToCollapsed(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, { attributeFilter: ['data-sidebar'] })
  return () => observer.disconnect()
}

function getCollapsedSnapshot() {
  return document.documentElement.dataset.sidebar === 'collapsed'
}

function setCollapsed(collapsed: boolean) {
  if (collapsed) {
    document.documentElement.dataset.sidebar = 'collapsed'
  } else {
    delete document.documentElement.dataset.sidebar
  }

  try {
    if (collapsed) {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed')
    } else {
      window.localStorage.removeItem(SIDEBAR_STORAGE_KEY)
    }
  } catch {
    // Without storage the choice just lasts until the next page load.
  }
}

// Labels and other expanded-only parts disappear in the collapsed rail (desktop only; the phone
// drawer always opens at full width).
const hideWhenCollapsed = 'md:sidebar-collapsed:hidden'
const navItemClass =
  'md:sidebar-collapsed:justify-center md:sidebar-collapsed:px-0 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none'
const navItemIdleClass = 'text-[var(--mute)] hover:bg-[var(--bg)] hover:text-[var(--ink)]'

export function Sidebar({ labels, language, links }: SidebarProps) {
  const pathname = usePathname()
  const collapsed = useSyncExternalStore(subscribeToCollapsed, getCollapsedSnapshot, () => false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    if (!isDrawerOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDrawerOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDrawerOpen])

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--line)] bg-[color:var(--card)]/95 px-3 backdrop-blur md:hidden">
        <button
          aria-controls="site-sidebar"
          aria-expanded={isDrawerOpen}
          aria-label={labels.openMenu}
          className="inline-flex size-9 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[var(--bg)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
          type="button"
          onClick={() => setIsDrawerOpen(true)}
        >
          <Icon>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </Icon>
        </button>
        <Link className="text-lg font-semibold tracking-tight text-[var(--ink)]" href="/">
          {labels.home}
        </Link>
      </div>

      {isDrawerOpen ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      ) : null}

      <aside
        aria-label={labels.mainNavigation}
        className={`md:sidebar-collapsed:w-16 fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--line)] bg-[var(--card)] transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-dvh md:w-60 md:shrink-0 md:translate-x-0 md:transition-[width] ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        id="site-sidebar"
        // Following a link in the phone drawer should close it.
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('a')) {
            setIsDrawerOpen(false)
          }
        }}
      >
        <div className="md:sidebar-collapsed:justify-center md:sidebar-collapsed:px-0 flex h-14 items-center gap-1 px-3">
          <button
            aria-label={collapsed ? labels.expandSidebar : labels.collapseSidebar}
            className="hidden size-9 shrink-0 items-center justify-center rounded-md text-[var(--mute)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none md:inline-flex"
            title={collapsed ? labels.expandSidebar : labels.collapseSidebar}
            type="button"
            onClick={() => setCollapsed(!collapsed)}
          >
            <Icon>
              <rect height="16" rx="2" width="16" x="4" y="4" />
              <path d="M9.5 4v16" />
            </Icon>
          </button>
          <Link
            className={`${hideWhenCollapsed} rounded-md px-1 text-lg font-semibold tracking-tight text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none`}
            href="/"
          >
            {labels.home}
          </Link>
          <button
            aria-label={labels.closeMenu}
            className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-[var(--mute)] hover:bg-[var(--bg)] hover:text-[var(--ink)] md:hidden"
            type="button"
            onClick={() => setIsDrawerOpen(false)}
          >
            <Icon>
              <path d="M6 6l12 12M18 6 6 18" />
            </Icon>
          </button>
        </div>

        <nav className="md:sidebar-collapsed:px-2 flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-0.5">
            <li>
              <LanguageSwitcher
                collapsed={collapsed}
                currentLanguage={language}
                itemClassName={navItemClass}
                label={labels.learningLanguage}
              />
            </li>
            <li aria-hidden="true" className="mx-1 my-2 h-px bg-[var(--line)]" />
            {links.map((link) => {
              const isCurrent = pathname === link.match || pathname.startsWith(`${link.match}/`)
              return (
                <li key={link.href}>
                  <Link
                    aria-current={isCurrent ? 'page' : undefined}
                    aria-label={collapsed ? link.label : undefined}
                    className={`${navItemClass} ${
                      isCurrent
                        ? 'bg-[var(--bg)] font-semibold text-[var(--ink)]'
                        : navItemIdleClass
                    }`}
                    href={link.href}
                    title={collapsed ? link.label : undefined}
                  >
                    <Icon>{iconPaths[link.icon]}</Icon>
                    <span className={hideWhenCollapsed}>{link.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="md:sidebar-collapsed:px-2 border-t border-[var(--line)] p-3">
          <UserMenu accountLabel={labels.account} signInLabel={labels.signIn} />
        </div>
      </aside>
    </>
  )
}
