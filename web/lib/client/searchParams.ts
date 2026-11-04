// The word list keeps its filters and the open word in the URL without navigating. Changes go
// through history.pushState, which fires no event of its own, so this one tells listeners.
export const SEARCH_PARAMS_CHANGE_EVENT = 'kinlex:filters'

export function updateSearchParameter(name: string, value: string): void {
  const url = new URL(window.location.href)

  if (value) {
    url.searchParams.set(name, value)
  } else {
    url.searchParams.delete(name)
  }

  window.history.pushState(null, '', url)
  window.dispatchEvent(new Event(SEARCH_PARAMS_CHANGE_EVENT))
}

// Shows a word in the side panel of the list on this page, without leaving it.
export function openWordPanel(slug: string): void {
  updateSearchParameter('word', slug)
}

// For links to a word inside a list: a plain click opens it in this page's panel, while a
// modified or middle click keeps the link's own behaviour (a new tab at the word's list).
export function openWordPanelOnClick(
  event: {
    button: number
    metaKey: boolean
    ctrlKey: boolean
    shiftKey: boolean
    altKey: boolean
    preventDefault: () => void
  },
  slug: string,
): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }
  event.preventDefault()
  openWordPanel(slug)
}
