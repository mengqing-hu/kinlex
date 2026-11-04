import { AudioButton } from '@/components/audio/AudioButton'
import { FavoriteButton } from '@/components/favorite/FavoriteButton'
import { FamiliarityMeter } from '@/components/word/FamiliarityMeter'
import type { MorphemeCardLabels } from '@/components/word/MorphemeCard'
import { MorphemeText } from '@/components/word/MorphemeText'
import { ExampleSentence } from '@/components/word/ExampleLine'
import type { WordListItem } from '@/types/domain'

export interface WordRowLabels {
  playWord: string
  playExample: string
  slowAudio: string
  familiarity: string
  openWord: string
}

interface WordRowProps {
  language: string
  word: WordListItem
  hideMeanings: boolean
  hideActions: boolean
  selected: boolean
  // Drops the example column, for when the detail panel narrows the list; the panel shows it.
  compact: boolean
  labels: WordRowLabels
  morphemeTypeLabels: Record<string, string>
  morphemeCardLabels: MorphemeCardLabels
  onOpen: () => void
}

export const hiddenMeaningClassName = 'select-none blur-sm transition-[filter]'

export function WordRow({
  language,
  word,
  hideMeanings,
  hideActions,
  selected,
  compact,
  labels,
  morphemeTypeLabels,
  morphemeCardLabels,
  onOpen,
}: WordRowProps) {
  const displayWord = word.lemma

  return (
    <li
      aria-current={selected || undefined}
      className={`grid min-h-9 cursor-pointer ${compact ? 'grid-cols-[16rem_minmax(8rem,1fr)_auto]' : 'grid-cols-[16rem_minmax(12rem,1fr)_minmax(20rem,1.8fr)_auto]'} items-center gap-x-1 rounded-md border-b border-[var(--line)] px-2 py-1 transition-colors last:border-b-0 hover:bg-[var(--row-hover)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${selected ? 'bg-[var(--row-hover)]' : ''}`}
      // A click anywhere on the row opens the details, except on its own controls (audio,
      // favorite, morpheme cards, ...). Keyboard users focus the row and press Enter or Space.
      aria-label={labels.openWord}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onOpen()
        }
      }}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          !event.target.closest('button, a, input, [role="button"], [role="menuitem"]')
        ) {
          onOpen()
        }
      }}
    >
      <div className="flex min-w-0 items-center gap-0.5">
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
        aria-hidden={hideMeanings}
        className={`line-clamp-2 text-sm leading-5 text-[var(--ink)] ${hideMeanings ? hiddenMeaningClassName : ''}`}
        title={word.glosses.join(', ')}
      >
        {word.glosses.join(', ')}
      </p>
      {compact ? null : word.example ? (
        <div className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 truncate text-sm text-[var(--ink)]">
            <ExampleSentence example={word.example} highlightTarget={false} />
          </span>
          <AudioButton
            url={word.example.audioUrl}
            label={labels.playExample}
            slowLabel={labels.slowAudio}
          />
          <span
            aria-hidden={hideMeanings}
            className={`min-w-0 flex-1 truncate text-xs text-[var(--mute)] ${hideMeanings ? hiddenMeaningClassName : ''}`}
            title={hideMeanings ? undefined : word.example.translation}
          >
            — {word.example.translation}
          </span>
        </div>
      ) : (
        <span />
      )}
      {/* Collapsed actions stay in the layout (just invisible) so the other columns keep their
          width and long meanings do not rewrap, which would change the row heights. */}
      <div
        aria-hidden={hideActions || undefined}
        className={`flex shrink-0 items-center ${hideActions ? 'invisible' : ''}`}
      >
        <div className="mr-0.5">
          <FamiliarityMeter wordId={word.id} label={labels.familiarity} />
        </div>
        <FavoriteButton
          initialFavorited={word.favorited}
          language={language}
          wordId={word.id}
          size="xs"
        />
      </div>
    </li>
  )
}
