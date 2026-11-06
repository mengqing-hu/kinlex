// The shape of a grammar book's table of contents. The contents themselves are copied from the
// book, so they live in the git-ignored data folder and are read by `loadGrammarBook`.

export const grammarLevels = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type GrammarLevel = (typeof grammarLevels)[number]

export interface GrammarTopic {
  // Null for unnumbered entries such as an appendix.
  number: string | null
  // The level a learner first meets the topic at. Only the topics without sections under them
  // have one; a chapter or section spans the levels of its parts.
  level?: GrammarLevel
  zh: string
  de: string
  children?: readonly GrammarTopic[]
}

// A topic with the chapter and sections it sits in.
export interface GrammarEntry {
  topic: GrammarTopic
  path: readonly GrammarTopic[]
}

// The topics without sections under them, in the book's order.
export function listGrammarEntries(
  topics: readonly GrammarTopic[],
  path: readonly GrammarTopic[] = [],
): GrammarEntry[] {
  return topics.flatMap((topic) =>
    topic.children ? listGrammarEntries(topic.children, [...path, topic]) : [{ topic, path }],
  )
}

// Any topic by its number, a chapter or section too.
export function findGrammarTopic(
  topics: readonly GrammarTopic[],
  number: string,
  path: readonly GrammarTopic[] = [],
): GrammarEntry | null {
  for (const topic of topics) {
    if (topic.number === number) return { topic, path }
    const found = topic.children ? findGrammarTopic(topic.children, number, [...path, topic]) : null
    if (found) return found
  }
  return null
}
