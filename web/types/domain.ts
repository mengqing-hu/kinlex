export interface WordSegment {
  surface: string
  morphemeId: number | null
  type: string | null
}

export interface MorphemeSummary {
  id: number
  slug: string
  text: string
  type: string
  meaning: string
  separable: boolean | null
}

export interface MorphemeWord {
  id: number
  slug: string
  lemma: string
  pos: string
  posDetail: string | null
  gender: string | null
  level: string | null
  segments: WordSegment[]
  glosses: string[]
}

export interface MorphemeWordCollection {
  morpheme: MorphemeSummary
  words: MorphemeWord[]
}

export interface WordDetailSegment {
  surface: string
  morpheme: MorphemeSummary | null
}

// One word of an example sentence; start and end are character offsets into it, end exclusive.
export interface ExampleToken {
  start: number
  end: number
  lemma: string
  // What the word means in this sentence; null until the pipeline has annotated it.
  gloss: string | null
  wordId: number | null
  wordSlug: string | null
}

export interface WordExample {
  sentence: string
  translation: string
  audioUrl: string | null
  // Empty for sentences the pipeline has not split into words yet.
  tokens: ExampleToken[]
}

export interface WordDetailExample extends WordExample {
  id: number
  level: string | null
}

export interface WordFamiliarity {
  wordId: number
  level: number
}

export interface RelatedWord {
  id: number
  slug: string
  lemma: string
  pos: string
  posDetail: string | null
  gender: string | null
  level: string | null
  sharedMorphemeIds: number[]
  glosses: string[]
  example: WordExample | null
}

export interface WordListItem {
  id: number
  slug: string
  lemma: string
  pos: string
  posDetail: string | null
  gender: string | null
  level: string | null
  segments: WordSegment[]
  glosses: string[]
  example: WordExample | null
  audioUrl: string | null
  favorited: boolean
}

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

export interface WordFilterOption {
  value: string
  label: string
}

export interface WordFilterOptions {
  partsOfSpeech: string[]
  topics: WordFilterOption[]
}

export interface TopicSummary {
  id: number
  slug: string
  name: string
  icon: string | null
  wordCount: number
}

export interface MorphemeDirectoryItem {
  id: number
  slug: string
  text: string
  type: string
  meaning: string
  separable: boolean | null
  wordCount: number
}

export interface SearchResult {
  id: number
  slug: string
  lemma: string
  pos: string
  posDetail: string | null
  gender: string | null
  level: string | null
  gloss: string | null
}

export interface FavoriteWord {
  id: number
  slug: string
  lemma: string
  pos: string
  posDetail: string | null
  gender: string | null
  level: string | null
}

export interface UserProfile {
  displayName: string | null
  nativeLanguage: string
  uiLanguage: string
  timezone: string
  profilePublic: boolean
}

export interface DailyActivity {
  date: string
  activeSeconds: number
  wordsViewed: number
}

export interface UserStatistics {
  totalDays: number
  currentStreak: number
  longestStreak: number
  activeSeconds: number
  wordsViewed: number
  wordsMastered: number
  dailyActivity: DailyActivity[]
}

export interface WordDetail {
  id: number
  slug: string
  lemma: string
  pos: string
  posDetail: string | null
  gender: string | null
  plural: string | null
  level: string | null
  glosses: string[]
  segments: WordDetailSegment[]
  examples: WordDetailExample[]
  relatedWords: RelatedWord[]
  audioUrl: string | null
  favorited: boolean
}
