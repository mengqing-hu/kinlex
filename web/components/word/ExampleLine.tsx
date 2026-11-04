import { AudioButton } from '@/components/audio/AudioButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { parseExampleMarkup } from '@/lib/utils/exampleMarkup'
import type { ExampleToken, WordExample } from '@/types/domain'

interface ExampleLineProps {
  example: WordExample
  playLabel: string
  slowLabel: string
  // The word the page is about, shown in bold wherever it appears in the sentence.
  targetWordId?: number
  // Centred in larger type, for an example that stands on its own, such as on a flashcard.
  featured?: boolean
  // Shown on a disabled audio button when the sentence has no recording; without it, no button.
  unavailableAudioLabel?: string
  hideTranslation?: boolean
}

// Renders [bracketed] parts in bold, in the sentence and in its translation alike.
function MarkedText({ text, bold = true }: { text: string; bold?: boolean }) {
  return parseExampleMarkup(text).map((part, index) =>
    part.highlighted && bold ? (
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
        <Tooltip key={token.start}>
          <TooltipTrigger asChild>
            <span
              className={`cursor-help underline decoration-transparent decoration-2 underline-offset-4 transition-colors hover:decoration-[var(--ink)] ${isTarget ? 'font-semibold' : ''}`}
            >
              {text}
            </span>
          </TooltipTrigger>
          <TooltipContent className="pointer-events-none">{token.gloss}</TooltipContent>
        </Tooltip>
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

// The sentence alone: word by word with hover meanings when it has been annotated, otherwise
// with its [bracketed] parts in bold.
export function ExampleSentence({
  example,
  targetWordId,
  highlightTarget = true,
}: {
  example: WordExample
  targetWordId?: number
  // Off where the sentence sits next to its word anyway, such as in a word list row.
  highlightTarget?: boolean
}) {
  return example.tokens.length > 0 ? (
    <TokenizedSentence
      sentence={example.sentence}
      targetWordId={highlightTarget ? targetWordId : undefined}
      tokens={example.tokens}
    />
  ) : (
    <MarkedText bold={highlightTarget} text={example.sentence} />
  )
}

export function ExampleLine({
  example,
  playLabel,
  slowLabel,
  targetWordId,
  featured = false,
  unavailableAudioLabel,
  hideTranslation = false,
}: ExampleLineProps) {
  const sentence = <ExampleSentence example={example} targetWordId={targetWordId} />

  if (featured) {
    return (
      <div className="text-center">
        <p className="text-lg leading-8 text-[var(--ink)] sm:text-xl">
          {sentence}
          <span className="ml-1 inline-flex align-middle">
            <AudioButton
              url={example.audioUrl}
              label={playLabel}
              slowLabel={slowLabel}
              unavailableLabel={unavailableAudioLabel}
            />
          </span>
        </p>
        {hideTranslation ? null : (
          <p className="mt-1 text-base leading-6 text-[var(--mute)] italic">
            <MarkedText text={example.translation} />
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="group relative flex items-center gap-1 rounded-lg py-1.5 pr-1 pl-5 transition-colors hover:bg-[var(--bg)]">
      {/* The marker gives way to the hover background, which then outlines the example. */}
      <span
        aria-hidden="true"
        className="absolute top-2.5 left-2 h-3 w-1 rounded-full bg-[var(--mute)]/25 transition-opacity group-hover:opacity-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 text-[var(--ink)]">{sentence}</p>
        {hideTranslation ? null : (
          <p className="text-xs leading-4 text-[var(--mute)] italic">
            <MarkedText text={example.translation} />
          </p>
        )}
      </div>
      <AudioButton
        url={example.audioUrl}
        label={playLabel}
        slowLabel={slowLabel}
        unavailableLabel={unavailableAudioLabel}
      />
    </div>
  )
}
