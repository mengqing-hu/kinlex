import { AudioButton } from '@/components/audio/AudioButton'
import { parseExampleMarkup } from '@/lib/utils/exampleMarkup'
import type { ExampleToken, WordExample } from '@/types/domain'

interface ExampleLineProps {
  example: WordExample
  playLabel: string
  slowLabel: string
  // The side panel uses smaller text; the word page uses the default size.
  compact?: boolean
  // The word the page is about, shown in bold wherever it appears in the sentence.
  targetWordId?: number
}

// Renders [bracketed] parts in bold, in the sentence and in its translation alike.
function MarkedText({ text }: { text: string }) {
  return parseExampleMarkup(text).map((part, index) =>
    part.highlighted ? (
      <strong className="font-semibold" key={`${index}-${part.text}`}>
        {part.text}
      </strong>
    ) : (
      <span key={`${index}-${part.text}`}>{part.text}</span>
    ),
  )
}

// Each annotated word shows its meaning in this sentence above it on hover.
function TokenizedSentence({
  sentence,
  tokens,
  targetWordId,
}: {
  sentence: string
  tokens: ExampleToken[]
  targetWordId?: number
}) {
  const parts = []
  let offset = 0
  for (const token of tokens) {
    if (token.start > offset) {
      parts.push(<span key={`gap-${offset}`}>{sentence.slice(offset, token.start)}</span>)
    }
    const text = sentence.slice(token.start, token.end)
    const isTarget = targetWordId !== undefined && token.wordId === targetWordId
    parts.push(
      token.gloss ? (
        <span className="group/token relative" key={token.start}>
          <span
            className={`cursor-help underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover/token:decoration-[var(--ink)] ${isTarget ? 'font-semibold' : ''}`}
          >
            {text}
          </span>
          <span
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 rounded-md bg-[var(--ink)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[var(--card)] not-italic opacity-0 shadow-md transition-opacity group-hover/token:opacity-100"
            role="tooltip"
          >
            {token.gloss}
          </span>
        </span>
      ) : (
        <span className={isTarget ? 'font-semibold' : undefined} key={token.start}>
          {text}
        </span>
      ),
    )
    offset = token.end
  }
  if (offset < sentence.length) {
    parts.push(<span key={`gap-${offset}`}>{sentence.slice(offset)}</span>)
  }
  return parts
}

export function ExampleLine({
  example,
  playLabel,
  slowLabel,
  compact = false,
  targetWordId,
}: ExampleLineProps) {
  return (
    <div
      // The hover background is one step off whatever the example sits on: the white side panel
      // or the tinted word page.
      className={`group relative flex items-center gap-1 rounded-lg transition-colors ${
        compact ? 'py-1.5 pr-1 pl-5 hover:bg-[var(--bg)]' : 'py-3 pr-2 pl-8 hover:bg-[var(--card)]'
      }`}
    >
      {/* The marker gives way to the hover background, which then outlines the example. */}
      <span
        aria-hidden="true"
        className={`absolute w-1 rounded-full bg-[var(--mute)]/25 transition-opacity group-hover:opacity-0 ${compact ? 'top-2.5 left-2 h-3' : 'top-4.5 left-3 h-4'}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-[var(--ink)] ${compact ? 'text-sm leading-5' : 'text-lg leading-7'}`}>
          {example.tokens.length > 0 ? (
            <TokenizedSentence
              sentence={example.sentence}
              targetWordId={targetWordId}
              tokens={example.tokens}
            />
          ) : (
            <MarkedText text={example.sentence} />
          )}
        </p>
        <p
          className={`text-[var(--mute)] italic ${compact ? 'text-xs leading-4' : 'mt-1 text-base leading-6'}`}
        >
          <MarkedText text={example.translation} />
        </p>
      </div>
      <AudioButton url={example.audioUrl} label={playLabel} slowLabel={slowLabel} />
    </div>
  )
}
