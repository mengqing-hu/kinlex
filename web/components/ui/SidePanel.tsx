'use client'

import { type ReactNode, useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { WORD_PANEL_SLOT_ID } from '@/lib/wordPanel'

function subscribeToNothing() {
  return () => undefined
}

function getPanelSlot() {
  return document.getElementById(WORD_PANEL_SLOT_ID)
}

export const panelIconButtonClass =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--mute)] hover:bg-[var(--bg)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none'

export const panelSectionLabelClass =
  "mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.08em] text-[var(--ink)] uppercase before:h-4 before:w-1 before:rounded-full before:bg-[var(--root)] before:content-['']"

export function PanelCloseButton({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <button
      aria-label={label}
      className={panelIconButtonClass}
      title={label}
      type="button"
      onClick={onClose}
    >
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
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  )
}

interface SidePanelProps {
  label: string
  busy: boolean
  children: ReactNode
  onClose: () => void
}

// The detail column on the right of a list: a third column beside the page on wide screens, and
// a sheet over the page on phones. Escape closes it.
export function SidePanel({ label, busy, children, onClose }: SidePanelProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const slot = useSyncExternalStore(subscribeToNothing, getPanelSlot, () => null)

  const panel = (
    <>
      {/* On phones the panel covers the page, so give it a backdrop. On wide screens it is a
          column beside the list, which stays usable so another row can be picked. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        onClick={onClose}
      />
      <aside
        aria-busy={busy}
        aria-label={label}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--line)] bg-[var(--card)] shadow-2xl md:sticky md:top-0 md:z-auto md:h-dvh md:w-[20rem] md:shrink-0 md:shadow-none lg:w-[22rem] xl:w-[24rem]"
      >
        {children}
      </aside>
    </>
  )

  // Outside the app shell (no slot) the panel still works as an overlay where it is rendered.
  return slot ? createPortal(panel, slot) : panel
}
