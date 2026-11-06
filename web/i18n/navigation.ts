import { createNavigation } from 'next-intl/navigation'

import { routing } from './routing'

// Links and redirects written without a language, such as "/me", stay in the current one.
const navigation = createNavigation(routing)

export const { Link, usePathname, useRouter, getPathname } = navigation

// Typed explicitly so TypeScript knows the code after a redirect does not run.
export const redirect: typeof navigation.redirect = navigation.redirect
export const permanentRedirect: typeof navigation.permanentRedirect = navigation.permanentRedirect
