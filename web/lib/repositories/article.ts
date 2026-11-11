// German keeps a noun's article in the word itself ("der Mann"), and the article is its first,
// unmarked part. Spanish stores it apart, because the gender does not settle it (el agua is
// feminine), so it is put back here: every list, card and panel then shows "la familia" the way it
// shows "der Mann".

export function withArticle(lemma: string, article: string | null): string {
  return article ? `${article} ${lemma}` : lemma
}

// The article as the first, unmarked part of a word's segments.
export function withArticlePart<T>(
  segments: T[],
  article: string | null,
  part: (surface: string) => T,
): T[] {
  return article && segments.length > 0 ? [part(`${article} `), ...segments] : segments
}
