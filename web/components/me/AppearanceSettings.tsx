'use client'

import { type ReactNode, useSyncExternalStore } from 'react'

import { Card } from '@/components/ui/Card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import {
  THEME_STORAGE_KEY,
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
  themePreferences,
} from '@/lib/theme'

function ThemeIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
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

const themeOptions: Record<ThemePreference, { label: string; icon: ReactNode }> = {
  system: {
    label: 'System',
    icon: (
      <ThemeIcon>
        <rect height="12" rx="1.5" width="18" x="3" y="4" />
        <path d="M9 20h6M12 16v4" />
      </ThemeIcon>
    ),
  },
  light: {
    label: 'Light',
    icon: (
      <ThemeIcon>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1" />
      </ThemeIcon>
    ),
  },
  dark: {
    label: 'Dark',
    icon: (
      <ThemeIcon>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </ThemeIcon>
    ),
  },
}

// saveThemePreference announces a change as a storage event, as another tab's change arrives.
function subscribeToTheme(onChange: () => void) {
  const listener = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onChange()
  }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}

// The theme belongs to the browser, not the account, like the sidebar: it is kept in local
// storage and applied by the theme script in app/layout.tsx.
export function AppearanceSettings() {
  const theme = useSyncExternalStore(subscribeToTheme, readThemePreference, () => 'system')

  return (
    <Card aria-labelledby="appearance-heading">
      <h2 className="text-lg font-semibold" id="appearance-heading">
        Appearance
      </h2>
      <div className="mt-3 flex items-center justify-between gap-4">
        <span className="text-sm" id="theme-label">
          Theme
        </span>
        <div
          aria-labelledby="theme-label"
          className="flex gap-0.5 rounded-lg bg-[var(--bg)] p-0.5"
          role="radiogroup"
        >
          {themePreferences.map((preference) => {
            const option = themeOptions[preference]
            const selected = theme === preference
            return (
              <Tooltip key={preference}>
                <TooltipTrigger asChild>
                  <button
                    aria-checked={selected}
                    aria-label={option.label}
                    className={`inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${
                      selected
                        ? 'bg-[var(--card)] text-[var(--ink)] shadow-sm'
                        : 'text-[var(--mute)] hover:text-[var(--ink)]'
                    }`}
                    role="radio"
                    type="button"
                    onClick={() => saveThemePreference(preference)}
                  >
                    {option.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{option.label}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
