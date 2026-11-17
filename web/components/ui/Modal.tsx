'use client'

import { type ReactNode, useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
}

// A dialog over the page, closed with its button, Escape or a click beside it. Its content stays
// mounted while it is closed, so whatever runs inside, such as following a job, carries on.
export function Modal({ open, title, closeLabel, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      aria-label={title}
      className="m-auto w-[min(100%-2rem,36rem)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] p-0 text-[var(--ink)] shadow-xl backdrop:bg-black/40"
      ref={ref}
      // Escape closes the dialog itself; this keeps the page's state in step.
      onClose={onClose}
      // Only a click on the backdrop lands on the dialog element itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{title}</h2>
        <button
          aria-label={closeLabel}
          className="inline-flex size-8 items-center justify-center rounded-md text-[var(--mute)] hover:bg-[var(--bg)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
          title={closeLabel}
          type="button"
          onClick={onClose}
        >
          <svg
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="max-h-[calc(85dvh-4.5rem)] overflow-y-auto p-5">{children}</div>
    </dialog>
  )
}
