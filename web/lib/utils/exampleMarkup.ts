export interface ExampleTextPart {
  text: string
  highlighted: boolean
}

export function parseExampleMarkup(sentence: string): ExampleTextPart[] {
  const parts: ExampleTextPart[] = []
  const pattern = /\[([^\]]+)\]/g
  let previousIndex = 0

  for (const match of sentence.matchAll(pattern)) {
    const matchIndex = match.index
    const highlightedText = match[1]

    if (matchIndex > previousIndex) {
      parts.push({ text: sentence.slice(previousIndex, matchIndex), highlighted: false })
    }

    if (highlightedText) {
      parts.push({ text: highlightedText, highlighted: true })
    }

    previousIndex = matchIndex + match[0].length
  }

  if (previousIndex < sentence.length) {
    parts.push({ text: sentence.slice(previousIndex), highlighted: false })
  }

  return parts.length > 0 ? parts : [{ text: sentence, highlighted: false }]
}
