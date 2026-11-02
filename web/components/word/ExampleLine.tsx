import { AudioButton } from '@/components/audio/AudioButton'
import { parseExampleMarkup } from '@/lib/utils/exampleMarkup'
import type { WordDetailExample } from '@/types/domain'

interface ExampleLineProps {
  example: WordDetailExample
  playLabel: string
  slowLabel: string
}

export function ExampleLine({ example, playLabel, slowLabel }: ExampleLineProps) {
  return (
    <li className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-base leading-6 text-[var(--ink)]">
          {parseExampleMarkup(example.sentence).map((part, index) =>
            part.highlighted ? (
              <strong className="font-semibold" key={`${index}-${part.text}`}>
                {part.text}
              </strong>
            ) : (
              <span key={`${index}-${part.text}`}>{part.text}</span>
            ),
          )}
        </p>
        <AudioButton url={example.audioUrl} label={playLabel} slowLabel={slowLabel} />
      </div>
      <p className="mt-1 text-sm leading-5 text-[var(--mute)]">{example.translation}</p>
    </li>
  )
}
