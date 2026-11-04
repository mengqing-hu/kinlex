import { ExampleLine } from '@/components/word/ExampleLine'
import { RelatedWords } from '@/components/word/RelatedWords'
import type { WordDetail } from '@/types/domain'

export interface WordDetailLabels {
  meaning: string
  structure: string
  examples: string
  wordFamily: string
  noExamples: string
  noRelatedWords: string
  playExample: string
  slowAudio: string
  morphemeTypes: Record<string, string>
  partsOfSpeech: Record<string, string>
}

interface WordDetailsProps {
  language: string
  word: WordDetail
  labels: WordDetailLabels
}

const sectionClassName = 'border-b border-[var(--line)] py-5 last:border-b-0'
const headingClassName = 'mb-3 text-lg font-semibold tracking-tight text-[var(--ink)]'

export function WordDetails({ language, word, labels }: WordDetailsProps) {
  return (
    // Grids size by the space they get, so they fit both the full page and the side panel.
    <div className="@container">
      <section className={sectionClassName}>
        <h2 className={headingClassName}>{labels.meaning}</h2>
        <ol className="space-y-1 pl-5 text-base leading-6 text-[var(--ink)] marker:text-[var(--mute)]">
          {word.glosses.map((gloss) => (
            <li className="list-decimal" key={gloss}>
              {gloss}
            </li>
          ))}
        </ol>
      </section>

      {word.segments.some(({ morpheme }) => morpheme !== null) ? (
        <section className={sectionClassName}>
          <h2 className={headingClassName}>{labels.structure}</h2>
          <ul className="grid gap-2 @sm:grid-cols-2 @3xl:grid-cols-3">
            {word.segments.flatMap((segment, index) =>
              segment.morpheme
                ? [
                    <li
                      className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3"
                      key={`${index}-${segment.surface}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-[var(--ink)]">{segment.surface}</span>
                        <span className="text-xs font-medium tracking-wide text-[var(--mute)] uppercase">
                          {labels.morphemeTypes[segment.morpheme.type] ?? segment.morpheme.type}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-5 text-[var(--mute)]">
                        {segment.morpheme.meaning}
                      </p>
                    </li>,
                  ]
                : [],
            )}
          </ul>
        </section>
      ) : null}

      <section className={sectionClassName}>
        <h2 className={headingClassName}>{labels.examples}</h2>
        {word.examples.length > 0 ? (
          <ul className="space-y-1">
            {word.examples.map((example) => (
              <li key={example.id}>
                <ExampleLine
                  example={example}
                  playLabel={labels.playExample}
                  slowLabel={labels.slowAudio}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--mute)]">{labels.noExamples}</p>
        )}
      </section>

      <section className={sectionClassName}>
        <h2 className={headingClassName}>{labels.wordFamily}</h2>
        <RelatedWords
          language={language}
          words={word.relatedWords}
          emptyMessage={labels.noRelatedWords}
          partOfSpeechLabels={labels.partsOfSpeech}
        />
      </section>
    </div>
  )
}
