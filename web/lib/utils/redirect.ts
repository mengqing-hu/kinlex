const redirectBaseUrl = 'https://kinlex.local'

export function getSafeRedirectPath(value: string | null | undefined, fallback = '/me') {
  if (!value) {
    return fallback
  }

  try {
    const redirectUrl = new URL(value, redirectBaseUrl)

    if (redirectUrl.origin !== redirectBaseUrl) {
      return fallback
    }

    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`
  } catch {
    return fallback
  }
}
