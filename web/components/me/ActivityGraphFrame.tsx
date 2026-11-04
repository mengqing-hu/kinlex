'use client'

import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'

interface TooltipState {
  text: string
  left: number
  top: number
}

// One shared tooltip for the whole graph: each day cell only carries its text in data-tooltip.
export function ActivityGraphFrame({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    // On narrow screens the graph scrolls sideways; start at the most recent weeks, like GitHub.
    const scroller = scrollRef.current
    if (scroller) {
      scroller.scrollLeft = scroller.scrollWidth
    }
  }, [])

  function handlePointerOver(event: PointerEvent<HTMLDivElement>) {
    // Columns carry the tooltip on a hit area larger than the bar, so look up from the target.
    const cell =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>('[data-tooltip]')
        : null
    const frame = frameRef.current
    if (!cell?.dataset.tooltip || !frame?.contains(cell)) {
      setTooltip(null)
      return
    }

    const cellRect = cell.getBoundingClientRect()
    const frameRect = frame.getBoundingClientRect()
    setTooltip({
      text: cell.dataset.tooltip,
      left: cellRect.left - frameRect.left + cellRect.width / 2,
      top: cellRect.top - frameRect.top,
    })
  }

  return (
    <div className="relative" ref={frameRef}>
      <div
        className="overflow-x-auto"
        ref={scrollRef}
        onPointerLeave={() => setTooltip(null)}
        onPointerOver={handlePointerOver}
        onScroll={() => setTooltip(null)}
      >
        {children}
      </div>
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-[var(--ink)] px-2 py-1 text-xs whitespace-nowrap text-[var(--card)] shadow-lg"
          role="tooltip"
          style={{ left: tooltip.left, top: tooltip.top - 6 }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </div>
  )
}
