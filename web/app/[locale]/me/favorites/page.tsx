import { getLocale } from 'next-intl/server'

import { permanentRedirect } from '@/i18n/navigation'
import { supportedLanguageCodes } from '@/lib/languages'

// Favorites moved into the main navigation, next to the other word lists of a language.
export default async function FavoritesPage() {
  permanentRedirect({ href: `/${supportedLanguageCodes[0]}/favorites`, locale: await getLocale() })
}
