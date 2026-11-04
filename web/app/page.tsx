import { getTranslations } from 'next-intl/server'

import { HomeExperience } from '@/components/home/HomeExperience'
import { Footer } from '@/components/layout/Footer'

// The footer is only shown here: on the learning pages it would sit below the word list, which is
// sized to fill the window.
export default async function HomePage() {
  const footer = await getTranslations('footer')

  return (
    <>
      <HomeExperience />
      <Footer
        copyright={footer('copyright', { year: new Date().getUTCFullYear() })}
        description={footer('description')}
      />
    </>
  )
}
