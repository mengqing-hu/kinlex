import type { UserProfile } from '@/types/domain'

const PROFILE_SAVED_EVENT = 'kinlex:profile-saved'

// The sidebar's account menu is a client component that router.refresh() does not reload, so the
// profile page tells it about a new name or picture directly.
export function announceProfile(profile: UserProfile) {
  window.dispatchEvent(new CustomEvent<UserProfile>(PROFILE_SAVED_EVENT, { detail: profile }))
}

export function onProfileSaved(listener: (profile: UserProfile) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<UserProfile>).detail)
  window.addEventListener(PROFILE_SAVED_EVENT, handler)
  return () => window.removeEventListener(PROFILE_SAVED_EVENT, handler)
}
