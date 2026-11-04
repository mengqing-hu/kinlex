// A plain module, so server components can use it too.

// The element the word detail panel portals into.
export const WORD_PANEL_SLOT_ID = 'word-panel-slot'

// Where a word lives on the site: its level's list with the word open in the side panel.
export function getWordPanelPath(language: string, slug: string, level: string | null): string {
  const levelPath = level ? level.toLowerCase() : 'all'
  return `/${encodeURIComponent(language)}/levels/${levelPath}?word=${encodeURIComponent(slug)}`
}
