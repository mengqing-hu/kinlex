import { AudioButton } from '@/components/audio/AudioButton'
import { ExampleLine } from '@/components/word/ExampleLine'
import { formatPartOfSpeech } from '@/lib/utils/partOfSpeech'
import type { WordListItem } from '@/types/domain'

export interface FlashcardFaceLabels {
  // Template: {word}.
  playWord: string
  playExample: string
  slowAudio: string
  noMeaning: string
  noRecording: string
  partsOfSpeech: Record<string, string>
}

interface FaceProps {
  card: WordListItem
  labels: FlashcardFaceLabels
}

export function WordFace({ card, labels }: FaceProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="text-4xl font-semibold tracking-tight break-words text-[var(--ink)] sm:text-5xl">
        {card.lemma}
        <span className="ml-2 inline-flex align-middle">
          <AudioButton
            large
            url={card.audioUrl}
            label={labels.playWord.replace('{word}', card.lemma)}
            slowLabel={labels.slowAudio}
            unavailableLabel={labels.noRecording}
          />
        </span>
      </p>
      {card.level ? (
        <p className="mt-3 text-xs font-semibold tracking-widest text-[var(--root)] uppercase">
          {card.level}
        </p>
      ) : null}
    </div>
  )
}

export function MeaningFace({ card, labels }: FaceProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="text-xs text-[var(--mute)]">
        {formatPartOfSpeech(labels.partsOfSpeech, card.pos, card.posDetail)}
      </p>
      <p className="mt-3 text-2xl leading-snug font-semibold text-[var(--ink)] sm:text-3xl">
        {card.glosses.length > 0 ? card.glosses.join(', ') : labels.noMeaning}
      </p>
    </div>
  )
}

interface FaceExampleProps extends FaceProps {
  showMeaning: boolean
}

// Only for the answer side: the sentence shows the German word in bold.
export function FaceExample({ card, labels, showMeaning }: FaceExampleProps) {
  if (!card.example) return null

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-6">
      <ExampleLine
        featured
        hideTranslation={!showMeaning}
        unavailableAudioLabel={labels.noRecording}
        example={card.example}
        playLabel={labels.playExample}
        slowLabel={labels.slowAudio}
        targetWordId={card.id}
      />
    </div>
  )
}
