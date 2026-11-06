// The shape of a grammar topic's content, block by block in the book's order, until the grammar
// content moves into the database.
//
// Texts mark their parts inline: {dat:dem Kind} colours a case, {hl:ä} marks any other change
// (an umlaut or a plural ending), and [Kind|das-kind] links a word to its vocabulary entry. A link
// may sit inside a mark: {dat:dem [Kind|das-kind]}.

export const grammarCases = ['nom', 'akk', 'dat', 'gen'] as const
export type GrammarCase = (typeof grammarCases)[number]
export type GrammarMark = GrammarCase | 'hl'

export interface MarkedSegment {
  text: string
  mark?: GrammarMark
  // The slug of the word's vocabulary entry.
  word?: string
}

export interface GrammarTable {
  type: 'table'
  caption?: string
  columns?: readonly string[]
  rows: readonly { label?: string; cells: readonly string[] }[]
}

export type GrammarBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'note'; text: string }
  | GrammarTable
  | {
      type: 'list'
      style: 'numbered' | 'lettered' | 'bullet'
      title?: string
      items: readonly { blocks: readonly GrammarBlock[] }[]
    }
  | {
      type: 'examples'
      rows: readonly { label?: string; sentence: string; translation?: string }[]
    }

export interface GrammarDetail {
  // The topic's number in the table of contents; a chapter's number holds its introduction.
  number: string
  blocks: readonly GrammarBlock[]
  // Numbers of other topics.
  links?: {
    prerequisites: readonly string[]
    related: readonly string[]
    next: readonly string[]
  }
}

const markPattern = /\{(nom|akk|dat|gen|hl):([^}]*)\}/g
const wordPattern = /\[([^|\]]+)\|([^\]]+)\]/g

function parseWords(text: string, mark?: GrammarMark): MarkedSegment[] {
  const segments: MarkedSegment[] = []
  let last = 0
  for (const match of text.matchAll(wordPattern)) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), mark })
    segments.push({ text: match[1] ?? '', mark, word: match[2] })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last), mark })
  return segments
}

export function parseMarkedText(text: string): MarkedSegment[] {
  const segments: MarkedSegment[] = []
  let last = 0
  for (const match of text.matchAll(markPattern)) {
    segments.push(...parseWords(text.slice(last, match.index)))
    segments.push(...parseWords(match[2] ?? '', match[1] as GrammarMark))
    last = match.index + match[0].length
  }
  segments.push(...parseWords(text.slice(last)))
  return segments
}

// Every marked text in the blocks, for finding which cases they use.
export function collectTexts(blocks: readonly GrammarBlock[]): string[] {
  return blocks.flatMap((block) => {
    switch (block.type) {
      case 'table':
        return block.rows.flatMap((row) => row.cells)
      case 'list':
        return block.items.flatMap((item) => collectTexts(item.blocks))
      case 'examples':
        return block.rows.map((row) => row.sentence)
      default:
        return [block.text]
    }
  })
}
