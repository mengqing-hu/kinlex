import { useSyncExternalStore } from 'react'

// The word list keeps its filters and the open word in the URL without navigating. Changes go
// through history.pushState, which fires no event of its own, so this one tells listeners.
export const SEARCH_PARAMS_CHANGE_EVENT = 'kinlex:filters'

function subscribeToSearchParams(callback: () => void): () => void {
  window.addEventListener('popstate', callback)
  window.addEventListener(SEARCH_PARAMS_CHANGE_EVENT, callback)

  return () => {
    window.removeEventListener('popstate', callback)
    window.removeEventListener(SEARCH_PARAMS_CHANGE_EVENT, callback)
  }
}

function getSearchParamsSnapshot(): string {
  return window.location.search
}

function getServerSearchParamsSnapshot(): string {
  return ''
}

// The page's query string, following both the changes below and Back and Forward; empty while
// rendering on the server.
export function useSearchParamsString(): string {
  return useSyncExternalStore(
    subscribeToSearchParams,
    getSearchParamsSnapshot,
    getServerSearchParamsSnapshot,
  )
}

// Sets several parameters as one history entry; an empty value removes that parameter.
export function updateSearchParameters(changes: Record<string, string>): void {
  const url = new URL(window.location.href)

  for (const [name, value] of Object.entries(changes)) {
    if (value) {
      url.searchParams.set(name, value)
    } else {
      url.searchParams.delete(name)
    }
  }

  window.history.pushState(null, '', url)
  window.dispatchEvent(new Event(SEARCH_PARAMS_CHANGE_EVENT))
}

export function updateSearchParameter(name: string, value: string): void {
  updateSearchParameters({ [name]: value })
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
