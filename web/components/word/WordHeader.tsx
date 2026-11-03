import { AudioButton } from '@/components/audio/AudioButton'
import { FavoriteButton } from '@/components/favorite/FavoriteButton'
import { MorphemeText } from '@/components/word/MorphemeText'
import type { WordDetail } from '@/types/domain'

interface WordHeaderProps {
  word: WordDetail
  language: string
  partOfSpeech: string
  levelLabel: string | null
  pluralLabel: string | null
  playLabel: string
  slowLabel: string
  morphemeTypeLabels: Record<string, string>
}

export function WordHeader({
  word,
  language,
  partOfSpeech,
  levelLabel,
  pluralLabel,
  playLabel,
  slowLabel,
  morphemeTypeLabels,
}: WordHeaderProps) {
  return (
    <header className="border-b border-[var(--line)] pb-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
            <MorphemeText
              segments={word.segments}
              fallback={word.lemma}
              typeLabels={morphemeTypeLabels}
            />
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-[var(--mute)]">
            <span>{partOfSpeech}</span>
            {levelLabel ? (
              <span className="rounded-full border border-[var(--line)] px-2 py-0.5">
                {levelLabel}
              </span>
            ) : null}
          </div>
          {pluralLabel ? <p className="mt-2 text-sm text-[var(--mute)]">{pluralLabel}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <FavoriteButton initialFavorited={word.favorited} language={language} wordId={word.id} />
          <AudioButton url={word.audioUrl} label={playLabel} slowLabel={slowLabel} />
        </div>
      </div>
    </header>
  )
}
