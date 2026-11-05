export const THEME_STORAGE_KEY = 'kinlex:theme'

export const themePreferences = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof themePreferences)[number]

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return themePreferences.find((preference) => preference === stored) ?? 'system'
  } catch {
    return 'system'
  }
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Without storage the choice still applies to this page.
  }
  window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }))
}

// Runs before the page paints, so a dark page never flashes light. It always resolves the theme
// to light or dark on <html>, following the system while the preference is 'system', also when
// the system switches later or the choice changes in another tab.
export const themeScript = `(function(){var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var t=null;try{t=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}document.documentElement.dataset.theme=t==='light'||t==='dark'?t:m.matches?'dark':'light'}a();m.addEventListener('change',a);window.addEventListener('storage',function(e){if(e.key==='${THEME_STORAGE_KEY}')a()})})()`
