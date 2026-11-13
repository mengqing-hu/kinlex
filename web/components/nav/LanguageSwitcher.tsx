'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Link } from '@/i18n/navigation'
import { supportedLanguages, type SupportedLanguageCode } from '@/lib/languages'

interface LanguageSwitcherProps {
  collapsed: boolean
  currentLanguage: SupportedLanguageCode
  // The sidebar's shared item styling, so the switcher lines up with the links below it.
  itemClassName: string
  label: string
  // Each learning language's name in the interface language, by code.
  languageNames: Record<string, string>
}

export function LanguageSwitcher({
  collapsed,
  currentLanguage,
  itemClassName,
  label,
  languageNames,
}: LanguageSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={collapsed ? label : undefined}
          className={`${itemClassName} text-[var(--ink)] hover:bg-[var(--bg)] data-[state=open]:bg-[var(--bg)]`}
          title={collapsed ? label : undefined}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="8.5" />
            <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5Z" />
          </svg>
          <span className="md:sidebar-collapsed:hidden flex-1 truncate text-left font-medium">
            {label}
          </span>
          <svg
            aria-hidden="true"
            className="md:sidebar-collapsed:hidden size-3 shrink-0 text-[var(--mute)]"
            viewBox="0 0 12 12"
          >
            <path d="m2.5 4.5 3.5 3 3.5-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" sideOffset={12}>
        {supportedLanguages.map((language) => {
          const isCurrent = language.code === currentLanguage
          return (
            <DropdownMenuItem asChild key={language.code}>
              <Link
                aria-current={isCurrent ? 'page' : undefined}
                className={isCurrent ? 'bg-[var(--bg)] text-[var(--ink)]' : ''}
                href={`/${language.code}/vocabulary/a1`}
              >
                {languageNames[language.code] ?? language.name}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
