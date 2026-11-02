import { MorphemeCard, type MorphemeCardLabels } from '@/components/word/MorphemeCard'
import type { WordDetailSegment, WordSegment } from '@/types/domain'

interface MorphemeTextProps {
  segments: Array<WordDetailSegment | WordSegment>
  fallback: string
  typeLabels: Record<string, string>
  card?: {
    language: string
    labels: MorphemeCardLabels
  }
}

const typeClasses: Record<string, string> = {
  prefix: 'decoration-[var(--prefix)]',
  root: 'decoration-[var(--root)]',
  suffix: 'decoration-[var(--suffix)]',
}

export function MorphemeText({ segments, fallback, typeLabels, card }: MorphemeTextProps) {
  if (segments.length === 0) {
    return <span>{fallback}</span>
  }

  return (
    <span>
      {segments.map((segment, index) => {
        const morpheme = 'morpheme' in segment ? segment.morpheme : null
        const morphemeId = morpheme?.id ?? ('morphemeId' in segment ? segment.morphemeId : null)
        const morphemeType = morpheme?.type ?? ('type' in segment ? segment.type : null)

        if (morphemeId === null || !morphemeType) {
          return <span key={`${index}-${segment.surface}`}>{segment.surface}</span>
        }

        const decoratedSegment = (
          <span
            className={`underline decoration-dotted decoration-2 underline-offset-4 transition-[text-decoration-style] hover:decoration-solid ${typeClasses[morphemeType] ?? 'decoration-[var(--info)]'}`}
            title={
              morpheme
                ? `${typeLabels[morphemeType] ?? morphemeType}: ${morpheme.meaning}`
                : (typeLabels[morphemeType] ?? morphemeType)
            }
          >
            {segment.surface}
          </span>
        )

        return card ? (
          <MorphemeCard
            language={card.language}
            morphemeId={morphemeId}
            labels={card.labels}
            key={`${index}-${segment.surface}`}
          >
            {decoratedSegment}
          </MorphemeCard>
        ) : (
          <span key={`${index}-${segment.surface}`}>{decoratedSegment}</span>
        )
      })}
    </span>
  )
}
