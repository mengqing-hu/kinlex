'use client'

type ErrorPageProps = Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-widest text-neutral-500 uppercase">Error</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Something went wrong</h1>
      <button
        className="mt-8 w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        type="button"
        onClick={reset}
      >
        Try again
      </button>
    </main>
  )
}
