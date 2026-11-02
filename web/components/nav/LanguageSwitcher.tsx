import { NavDropdown } from '@/components/nav/NavDropdown'
import { supportedLanguages, type SupportedLanguageCode } from '@/lib/languages'

interface LanguageSwitcherProps {
  currentLanguage: SupportedLanguageCode
  label: string
}

export function LanguageSwitcher({ currentLanguage, label }: LanguageSwitcherProps) {
  const items = supportedLanguages.map((language) => ({
    href: `/${language.code}/levels/a1`,
    label: language.name,
    current: language.code === currentLanguage,
  }))

  return <NavDropdown items={items} label={label} />
}
