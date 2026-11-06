import { getTranslations } from 'next-intl/server'

export default async function NotFoundPage() {
  const t = await getTranslations('notFound')

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-widest text-neutral-500 uppercase">404</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-4 text-neutral-600 dark:text-neutral-300">{t('description')}</p>
    </main>
  )
}
