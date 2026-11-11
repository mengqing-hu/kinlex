import { MorphemeCard, type MorphemeCardLabels } from '@/components/word/MorphemeCard'
import { unmarkedPartClass } from '@/lib/utils/wordParts'
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

  const parts = segments.map((segment) => {
    const morpheme = 'morpheme' in segment ? segment.morpheme : null
    return {
      surface: segment.surface,
      morpheme,
      morphemeId: morpheme?.id ?? ('morphemeId' in segment ? segment.morphemeId : null),
      morphemeType: morpheme?.type ?? ('type' in segment ? segment.type : null),
    }
  })
  const marked = parts.some(({ morphemeId, morphemeType }) => morphemeId !== null && morphemeType)

  return (
    <span>
      {parts.map(({ surface, morpheme, morphemeId, morphemeType }, index) => {
        if (morphemeId === null || !morphemeType) {
          return (
            <span className={marked ? unmarkedPartClass : undefined} key={`${index}-${surface}`}>
              {surface}
            </span>
          )
        }

        const decoratedSegment = (
          <span
            className={`underline decoration-dotted decoration-2 underline-offset-4 transition-[text-decoration-style] hover:decoration-solid ${typeClasses[morphemeType] ?? 'decoration-[var(--info)]'}`}
            // The hover card already names the part; a tooltip would sit on top of it.
            title={
              card
                ? undefined
                : morpheme
                  ? `${typeLabels[morphemeType] ?? morphemeType}: ${morpheme.meaning}`
                  : (typeLabels[morphemeType] ?? morphemeType)
            }
          >
            {surface}
          </span>
        )

        return card ? (
          <MorphemeCard
            language={card.language}
            morphemeId={morphemeId}
            labels={card.labels}
            key={`${index}-${surface}`}
          >
            {decoratedSegment}
          </MorphemeCard>
        ) : (
          <span key={`${index}-${surface}`}>{decoratedSegment}</span>
        )
      })}
    </span>
  )
}
