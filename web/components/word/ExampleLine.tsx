import { AudioButton } from '@/components/audio/AudioButton'
import { parseExampleMarkup } from '@/lib/utils/exampleMarkup'
import type { WordExample } from '@/types/domain'

interface ExampleLineProps {
  example: WordExample
  playLabel: string
  slowLabel: string
  // The side panel uses smaller text; the word page uses the default size.
  compact?: boolean
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

export function ExampleLine({ example, playLabel, slowLabel, compact = false }: ExampleLineProps) {
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
          <MarkedText text={example.sentence} />
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
