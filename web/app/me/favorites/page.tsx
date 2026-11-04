import { permanentRedirect } from 'next/navigation'

import { supportedLanguageCodes } from '@/lib/languages'

// Favorites moved into the main navigation, next to the other word lists of a language.
export default function FavoritesPage() {
  permanentRedirect(`/${supportedLanguageCodes[0]}/favorites`)
}
