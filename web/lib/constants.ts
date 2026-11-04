// Plain values shared by server and client code, kept free of the validation library.

export const wordLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type WordLevel = (typeof wordLevels)[number]

// The topic filter's value for words without any topic; no topic is called this.
export const OTHER_TOPIC = 'other'

// 'frequency' is the default order: the most common words first.
export const wordSorts = [
  'frequency',
  'views',
  'familiarity',
  'last_viewed',
  'mistakes',
  'alphabetical',
] as const
export type WordSort = (typeof wordSorts)[number]

export const sortOrders = ['asc', 'desc'] as const
export type SortOrder = (typeof sortOrders)[number]

// The direction each sort starts in: the way a learner most often wants it.
export const defaultSortOrders: Record<WordSort, SortOrder> = {
  frequency: 'asc',
  views: 'desc',
  familiarity: 'asc',
  last_viewed: 'desc',
  mistakes: 'desc',
  alphabetical: 'asc',
}

// Sorts by what one learner did, which mean nothing without an account.
export const personalWordSorts: readonly WordSort[] = [
  'views',
  'familiarity',
  'last_viewed',
  'mistakes',
]
