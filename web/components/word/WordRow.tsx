import { AudioButton } from '@/components/audio/AudioButton'
import { FavoriteButton } from '@/components/favorite/FavoriteButton'
import { FamiliarityMeter } from '@/components/word/FamiliarityMeter'
import type { MorphemeCardLabels } from '@/components/word/MorphemeCard'
import { MorphemeText } from '@/components/word/MorphemeText'
import { parseExampleMarkup } from '@/lib/utils/exampleMarkup'
import { formatPartOfSpeech } from '@/lib/utils/partOfSpeech'
import type { WordListItem } from '@/types/domain'

interface WordRowLabels {
  playWord: string
  playExample: string
  slowAudio: string
  hideWord: string
  showWord: string
  familiarity: string
}

interface WordRowProps {
  language: string
  word: WordListItem
  hideMeanings: boolean
  hideActions: boolean
  hidden: boolean
  labels: WordRowLabels
  morphemeTypeLabels: Record<string, string>
  morphemeCardLabels: MorphemeCardLabels
  partOfSpeechLabels: Record<string, string>
  onToggleHidden: () => void
}

const hiddenMeaningClassName = 'select-none blur-sm transition-[filter]'
const hiddenWordClassName =
  'pointer-events-none select-none opacity-40 blur-sm transition-[filter,opacity]'
const visibleWordClassName = 'transition-[filter,opacity]'

export function WordRow({
  language,
  word,
  hideMeanings,
  hideActions,
  hidden,
  labels,
  morphemeTypeLabels,
  morphemeCardLabels,
  partOfSpeechLabels,
  onToggleHidden,
}: WordRowProps) {
  const displayWord = word.lemma
  const partOfSpeech = formatPartOfSpeech(partOfSpeechLabels, word.pos, word.posDetail)
  const contentClassName = hidden ? hiddenWordClassName : visibleWordClassName
  const visibilityLabel = hidden ? labels.showWord : labels.hideWord

  return (
    <li
      className={`grid min-h-9 grid-cols-[9rem_10rem_minmax(12rem,1fr)_minmax(20rem,1.8fr)_auto] items-center gap-x-1 rounded-md border-b border-[var(--line)] px-2 py-1 transition-colors last:border-b-0 hover:bg-[var(--row-hover)]`}
    >
      <div aria-hidden={hidden} className={`flex min-w-0 items-center gap-0.5 ${contentClassName}`}>
        <span className="truncate text-sm font-semibold text-[var(--ink)]" title={displayWord}>
          <MorphemeText
            segments={word.segments}
            fallback={word.lemma}
            typeLabels={morphemeTypeLabels}
            card={{ language, labels: morphemeCardLabels }}
          />
        </span>
        <AudioButton url={word.audioUrl} label={labels.playWord} slowLabel={labels.slowAudio} />
      </div>
      <p
        aria-hidden={hidden}
        className={`truncate text-xs text-[var(--mute)] ${contentClassName}`}
        title={partOfSpeech}
      >
        {partOfSpeech}
      </p>
      <p
        aria-hidden={hideMeanings || hidden}
        className={`line-clamp-2 text-sm leading-5 text-[var(--ink)] ${contentClassName} ${hideMeanings ? hiddenMeaningClassName : ''}`}
        title={word.glosses.join(', ')}
      >
        {word.glosses.join(', ')}
      </p>
      {word.example ? (
        <div
          aria-hidden={hidden}
          className={`flex min-w-0 items-center gap-1 ${contentClassName}`}
          title={`${word.example.sentence} — ${word.example.translation}`}
        >
          <span className="min-w-0 truncate text-sm text-[var(--ink)]">
            {parseExampleMarkup(word.example.sentence).map((part, index) =>
              part.highlighted ? (
                <strong className="font-semibold" key={`${index}-${part.text}`}>
                  {part.text}
                </strong>
              ) : (
                <span key={`${index}-${part.text}`}>{part.text}</span>
              ),
            )}
          </span>
          <AudioButton
            url={word.example.audioUrl}
            label={labels.playExample}
            slowLabel={labels.slowAudio}
          />
          <span
            aria-hidden={hideMeanings}
            className={`min-w-0 flex-1 truncate text-xs text-[var(--mute)] ${hideMeanings ? hiddenMeaningClassName : ''}`}
          >
            — {word.example.translation}
          </span>
        </div>
      ) : (
        <span aria-hidden={hidden} className={contentClassName} />
      )}
      {/* Collapsed actions stay in the layout (just invisible) so the other columns keep their
          width and long meanings do not rewrap, which would change the row heights. */}
      <div
        aria-hidden={hideActions || undefined}
        className={`flex shrink-0 items-center gap-0.5 ${hideActions ? 'invisible' : ''}`}
      >
        <div aria-hidden={hidden} className={`mr-1 ${contentClassName}`}>
          <FamiliarityMeter wordId={word.id} label={labels.familiarity} />
        </div>
        <div aria-hidden={hidden} className={contentClassName}>
          <FavoriteButton
            initialFavorited={word.favorited}
            language={language}
            wordId={word.id}
            small
          />
        </div>
        <button
          aria-label={visibilityLabel}
          aria-pressed={hidden}
          className="inline-flex size-7 items-center justify-center rounded-full text-[var(--mute)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
          title={visibilityLabel}
          type="button"
          onClick={onToggleHidden}
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
            viewBox="0 0 24 24"
          >
            {hidden ? (
              <>
                <path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z" />
                <circle cx="12" cy="12" r="2.5" />
              </>
            ) : (
              <>
                <path d="m3 3 18 18" />
                <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.5 9 5.5a16 16 0 0 1-2.1 2.7" />
                <path d="M6.6 6.6C4.4 8.1 3 10 3 10s3.5 5.5 9 5.5c1 0 1.9-.2 2.7-.5" />
              </>
            )}
          </svg>
        </button>
      </div>
    </li>
  )
}
