'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { PanelCloseButton, panelSectionLabelClass, SidePanel } from '@/components/ui/SidePanel'
import { openWordPanelOnClick } from '@/lib/client/searchParams'
import { findGrammarTopic, type GrammarTopic, listGrammarEntries } from '@/lib/grammar/contents'
import {
  collectTexts,
  type GrammarBlock,
  grammarCases,
  type GrammarCase,
  type GrammarDetail,
  type GrammarMark,
  type GrammarTable,
  parseMarkedText,
} from '@/lib/grammar/details'
import { getWordPanelPath } from '@/lib/wordPanel'

export interface GrammarPanelLabels {
  cases: Record<GrammarCase, string>
  close: string
  learnFirst: string
  next: string
  noContent: string
  nextTopic: string
  previousTopic: string
  related: string
}

interface GrammarDetailPanelProps {
  contents: readonly GrammarTopic[]
  details: Readonly<Record<string, GrammarDetail>>
  labels: GrammarPanelLabels
  language: string
  number: string
  onClose: () => void
  onOpenTopic: (number: string) => void
}

// Literal class names, so Tailwind finds them.
const markClasses: Record<GrammarMark, string> = {
  nom: 'rounded-sm bg-[var(--case-nom)]/12 font-semibold text-[var(--case-nom)]',
  akk: 'rounded-sm bg-[var(--case-akk)]/12 font-semibold text-[var(--case-akk)]',
  dat: 'rounded-sm bg-[var(--case-dat)]/12 font-semibold text-[var(--case-dat)]',
  gen: 'rounded-sm bg-[var(--case-gen)]/12 font-semibold text-[var(--case-gen)]',
  hl: 'font-semibold text-[var(--suffix)]',
}

// Chinese glosses and endings such as "-en" beside the German forms in a table.
function isSideNote(cell: string): boolean {
  return cell.startsWith('-') || /\p{Script=Han}/u.test(cell.replace(/（.*?）/g, ''))
}

function MarkedText({ language, text }: { language: string; text: string }) {
  return (
    <>
      {parseMarkedText(text).map((segment, index) => {
        const className = segment.mark ? markClasses[segment.mark] : ''
        const key = `${index}-${segment.text}`
        if (segment.word) {
          const slug = segment.word
          return (
            <Link
              className={`${className} decoration-[var(--mute)]/60 decoration-dotted underline-offset-4 hover:text-[var(--root)] hover:underline`}
              href={getWordPanelPath(language, slug, null)}
              key={key}
              onClick={(event) => openWordPanelOnClick(event, slug)}
              prefetch={false}
            >
              {segment.text}
            </Link>
          )
        }
        return className ? (
          <span className={className} key={key}>
            {segment.text}
          </span>
        ) : (
          <span key={key}>{segment.text}</span>
        )
      })}
    </>
  )
}

// Forms and short words stay on one line; a whole example sentence wraps instead of widening the
// table past the panel.
const longCellLength = 40

function TableBlock({ language, table }: { language: string; table: GrammarTable }) {
  const hasLabels = table.rows.some((row) => row.label)
  return (
    <figure className="max-w-full">
      {table.caption ? (
        <figcaption className="mb-1 text-xs font-semibold text-[var(--mute)]">
          {table.caption}
        </figcaption>
      ) : null}
      {/* Hugs its content, so a two-column word list does not stretch across the panel. */}
      <div className="inline-block max-w-full overflow-x-auto rounded-lg border border-[var(--line)] align-top">
        <table className="text-sm">
          {table.columns ? (
            <thead className="bg-[var(--bg)] text-xs text-[var(--mute)]">
              <tr>
                {hasLabels ? <th className="px-2.5 py-1.5" /> : null}
                {table.columns.map((column, index) => (
                  <th className="px-2.5 py-1.5 text-left font-medium" key={`${index}-${column}`}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody className="divide-y divide-[var(--line)]">
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {hasLabels ? (
                  <th className="px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--mute)]">
                    {row.label}
                  </th>
                ) : null}
                {row.cells.map((cell, index) => (
                  <td
                    className={`px-2.5 py-1.5 ${cell.length > longCellLength ? 'min-w-[14rem]' : 'whitespace-nowrap'} ${isSideNote(cell) ? 'text-xs text-[var(--mute)]' : 'text-[var(--ink)]'}`}
                    key={index}
                  >
                    <MarkedText language={language} text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

function listMarker(style: 'numbered' | 'lettered' | 'bullet', index: number) {
  if (style === 'numbered') return `${index + 1}.`
  if (style === 'lettered') return `${String.fromCharCode(97 + index)}.`
  return '•'
}

function Blocks({ blocks, language }: { blocks: readonly GrammarBlock[]; language: string }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'paragraph':
            return (
              <p className="text-sm leading-7 text-[var(--ink)]" key={index}>
                <MarkedText language={language} text={block.text} />
              </p>
            )
          case 'heading':
            return (
              <h3
                className="border-b border-[var(--line)] pt-3 pb-1 text-base font-semibold text-[var(--ink)]"
                key={index}
              >
                <MarkedText language={language} text={block.text} />
              </h3>
            )
          case 'note':
            return (
              <p
                className="rounded-md bg-[var(--bg)] px-3 py-2 text-sm leading-6 text-[var(--mute)]"
                key={index}
              >
                <MarkedText language={language} text={block.text} />
              </p>
            )
          case 'table':
            return <TableBlock key={index} language={language} table={block} />
          case 'list':
            return (
              <div key={index}>
                {block.title ? <h4 className={panelSectionLabelClass}>{block.title}</h4> : null}
                <ol className="space-y-4">
                  {block.items.map((item, itemIndex) => (
                    <li className="flex gap-2.5" key={itemIndex}>
                      <span className="w-5 shrink-0 pt-1 text-right text-sm font-semibold text-[var(--root)] tabular-nums">
                        {listMarker(block.style, itemIndex)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Blocks blocks={item.blocks} language={language} />
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )
          case 'examples':
            return (
              <ul className="space-y-2" key={index}>
                {block.rows.map((row) => (
                  <li className="flex gap-3" key={row.sentence}>
                    {row.label ? (
                      <span className="w-5 shrink-0 pt-0.5 text-xs font-semibold text-[var(--mute)]">
                        {row.label}
                      </span>
                    ) : null}
                    <div>
                      <p className="text-base leading-7 text-[var(--ink)]">
                        <MarkedText language={language} text={row.sentence} />
                      </p>
                      {row.translation ? (
                        <p className="text-sm text-[var(--mute)]">{row.translation}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )
        }
      })}
    </div>
  )
}

function TopicLinks({
  contents,
  numbers,
  onOpenTopic,
}: {
  contents: readonly GrammarTopic[]
  numbers: readonly string[]
  onOpenTopic: (number: string) => void
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {numbers.map((number) => {
        const topic = findGrammarTopic(contents, number)?.topic
        return (
          <li key={number}>
            <button
              className="rounded-md border border-[var(--line)] px-2 py-1 text-left text-sm text-[var(--ink)] transition-colors hover:border-[var(--root)] hover:bg-[var(--bg)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
              type="button"
              onClick={() => onOpenTopic(number)}
            >
              <span className="mr-1.5 text-xs text-[var(--mute)] tabular-nums">{number}</span>
              {topic?.zh ?? number}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function GrammarDetailPanel({
  contents,
  details,
  labels,
  language,
  number,
  onClose,
  onOpenTopic,
}: GrammarDetailPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const entry = findGrammarTopic(contents, number)
  const detail = details[number]
  // Unnumbered entries such as an appendix cannot be opened on their own.
  const entries = listGrammarEntries(contents).filter(({ topic }) => topic.number)
  const index = entries.findIndex(({ topic }) => topic.number === number)
  const previous = index > 0 ? entries[index - 1] : undefined
  // From a chapter's or section's introduction, next is its first topic.
  const next =
    index >= 0
      ? entries[index + 1]
      : entries.find(({ path }) => path.some((parent) => parent.number === number))

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [number])

  if (!entry) return null
  const { topic, path } = entry
  const texts = detail ? collectTexts(detail.blocks) : []
  const usedCases = grammarCases.filter((grammarCase) =>
    texts.some((text) => text.includes(`{${grammarCase}:`)),
  )
  const links = detail?.links

  return (
    <SidePanel busy={false} label={`${topic.number ?? ''} ${topic.zh}`} wide onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-5 pt-3 pb-6" ref={bodyRef}>
        <article className="space-y-6">
          <header className="sticky top-0 z-10 -mx-5 -mt-3 border-b border-[var(--line)] bg-[var(--card)] px-5 pt-3 pb-3">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-xs text-[var(--mute)]">
                {path.map((parent) => `${parent.number} ${parent.zh}`).join(' › ')}
              </p>
              <PanelCloseButton label={labels.close} onClose={onClose} />
            </div>
            <h2 className="mt-1 flex items-baseline gap-2 text-xl font-semibold tracking-tight text-[var(--ink)]">
              <span className="text-[var(--mute)] tabular-nums">{topic.number}</span>
              <span className="min-w-0 flex-1">{topic.zh}</span>
              {topic.level ? (
                <span className="rounded border border-[var(--line)] px-1.5 text-xs font-normal text-[var(--mute)]">
                  {topic.level}
                </span>
              ) : null}
            </h2>
            <p className="text-sm text-[var(--mute)]">{topic.de}</p>
            {usedCases.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {usedCases.map((grammarCase) => (
                  <li className={`px-1.5 py-0.5 ${markClasses[grammarCase]}`} key={grammarCase}>
                    {labels.cases[grammarCase]}
                  </li>
                ))}
              </ul>
            ) : null}
          </header>

          {links && links.prerequisites.length > 0 ? (
            <section>
              <h3 className={panelSectionLabelClass}>{labels.learnFirst}</h3>
              <TopicLinks
                contents={contents}
                numbers={links.prerequisites}
                onOpenTopic={onOpenTopic}
              />
            </section>
          ) : null}

          {detail ? (
            <Blocks blocks={detail.blocks} language={language} />
          ) : (
            <p className="text-sm text-[var(--mute)]">{labels.noContent}</p>
          )}

          {links && links.related.length > 0 ? (
            <section>
              <h3 className={panelSectionLabelClass}>{labels.related}</h3>
              <TopicLinks contents={contents} numbers={links.related} onOpenTopic={onOpenTopic} />
            </section>
          ) : null}

          {links && links.next.length > 0 ? (
            <section>
              <h3 className={panelSectionLabelClass}>{labels.next}</h3>
              <TopicLinks contents={contents} numbers={links.next} onOpenTopic={onOpenTopic} />
            </section>
          ) : null}

          {previous || next ? (
            <nav className="flex items-stretch justify-between gap-3 border-t border-[var(--line)] pt-4">
              {previous ? (
                <button
                  className="min-w-0 rounded-md px-2 py-1 text-left text-sm hover:bg-[var(--bg)]"
                  type="button"
                  onClick={() => onOpenTopic(previous.topic.number ?? '')}
                >
                  <span className="block text-xs text-[var(--mute)]">‹ {labels.previousTopic}</span>
                  <span className="block truncate text-[var(--ink)]">
                    {previous.topic.number} {previous.topic.zh}
                  </span>
                </button>
              ) : (
                <span />
              )}
              {next ? (
                <button
                  className="min-w-0 rounded-md px-2 py-1 text-right text-sm hover:bg-[var(--bg)]"
                  type="button"
                  onClick={() => onOpenTopic(next.topic.number ?? '')}
                >
                  <span className="block text-xs text-[var(--mute)]">{labels.nextTopic} ›</span>
                  <span className="block truncate text-[var(--ink)]">
                    {next.topic.number} {next.topic.zh}
                  </span>
                </button>
              ) : null}
            </nav>
          ) : null}
        </article>
      </div>
    </SidePanel>
  )
}
