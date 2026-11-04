import { AudioButton } from '@/components/audio/AudioButton'
import { FavoriteButton } from '@/components/favorite/FavoriteButton'
import { ExampleSentence } from '@/components/word/ExampleLine'
import { FamiliarityMeter } from '@/components/word/FamiliarityMeter'
import type { MorphemeCardLabels } from '@/components/word/MorphemeCard'
import { MorphemeText } from '@/components/word/MorphemeText'
import { hiddenTextClassName, type WordRowLabels } from '@/components/word/WordRow'
import type { WordListItem } from '@/types/domain'

interface WordCardProps {
  language: string
  word: WordListItem
  hideWord: boolean
  hideMeanings: boolean
  hideActions: boolean
  selected: boolean
  labels: WordRowLabels
  morphemeTypeLabels: Record<string, string>
  morphemeCardLabels: MorphemeCardLabels
  onOpen: () => void
}

// The word list's card view: the same word as a row, laid out as a tile.
export function WordCard({
  language,
  word,
  hideWord,
  hideMeanings,
  hideActions,
  selected,
  labels,
  morphemeTypeLabels,
  morphemeCardLabels,
  onOpen,
}: WordCardProps) {
  return (
    <li
      aria-current={selected || undefined}
      aria-label={labels.openWord}
      className={`flex cursor-pointer flex-col rounded-2xl border bg-[var(--card)] p-5 transition-colors hover:border-[var(--root)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${selected ? 'border-[var(--root)]' : 'border-[var(--line)]'}`}
      tabIndex={0}
      // Like a row: a click anywhere opens the details, except on the card's own controls.
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          !event.target.closest('button, a, input, [role="button"], [role="menuitem"]')
        ) {
          onOpen()
        }
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <span
            aria-hidden={hideWord}
            className={`truncate text-xl font-semibold tracking-tight text-[var(--ink)] ${hideWord ? hiddenTextClassName : ''}`}
            title={word.lemma}
          >
            <MorphemeText
              segments={word.segments}
              fallback={word.lemma}
              typeLabels={morphemeTypeLabels}
              card={{ language, labels: morphemeCardLabels }}
            />
          </span>
          <AudioButton url={word.audioUrl} label={labels.playWord} slowLabel={labels.slowAudio} />
        </div>
        <div
          aria-hidden={hideActions || undefined}
          className={`flex shrink-0 items-center gap-0.5 ${hideActions ? 'invisible' : ''}`}
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
      </div>

      <p
        aria-hidden={hideMeanings}
        className={`mt-2 line-clamp-2 text-[var(--mute)] ${hideMeanings ? hiddenTextClassName : ''}`}
      >
        {word.glosses.join(', ')}
      </p>

      {word.example ? (
        <div className="mt-3 text-sm">
          <p className="line-clamp-2 text-[var(--ink)]">
            <span aria-hidden={hideWord} className={hideWord ? hiddenTextClassName : ''}>
              <ExampleSentence example={word.example} highlightTarget={false} />
            </span>
            <span className="ml-1 inline-flex align-middle">
              <AudioButton
                url={word.example.audioUrl}
                label={labels.playExample}
                slowLabel={labels.slowAudio}
              />
            </span>
          </p>
          <p
            aria-hidden={hideMeanings}
            className={`mt-0.5 line-clamp-2 text-xs text-[var(--mute)] italic ${hideMeanings ? hiddenTextClassName : ''}`}
          >
            {word.example.translation}
          </p>
        </div>
      ) : null}
    </li>
  )
}
