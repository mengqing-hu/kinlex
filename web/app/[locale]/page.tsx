import { getTranslations } from 'next-intl/server'

import { HomeExperience } from '@/components/home/HomeExperience'
import { Footer } from '@/components/layout/Footer'
import { AppShell } from '@/components/nav/AppShell'
import { applyRouteLocale } from '@/i18n/server'
import { supportedLanguageCodes } from '@/lib/languages'

// The footer is only shown here: on the learning pages it would sit below the word list, which is
// sized to fill the window.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  await applyRouteLocale(params)
  const footer = await getTranslations('footer')

  return (
    <AppShell language={supportedLanguageCodes[0]}>
      <HomeExperience />
      <Footer
        copyright={footer('copyright', { year: new Date().getUTCFullYear() })}
        description={footer('description')}
      />
    </AppShell>
  )
}
