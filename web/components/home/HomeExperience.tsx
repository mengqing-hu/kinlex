'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { getBrowserSupabase } from '@/lib/supabase/browser'

const VISITED_KEY = 'kinlex:visited'

export function HomeExperience() {
  const [returning, setReturning] = useState(false)

  useEffect(() => {
    const hasVisited = window.localStorage.getItem(VISITED_KEY) === '1'
    window.localStorage.setItem(VISITED_KEY, '1')
    void Promise.resolve(hasVisited).then(setReturning)

    void getBrowserSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) setReturning(true)
      })
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-8">
      <nav className="flex items-center justify-between">
        <span className="text-xl font-semibold">Kinlex</span>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Link href="/search">Search</Link>
          <Link
            className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2"
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </nav>
      <section className="flex flex-1 flex-col justify-center py-20">
        <p className="text-sm font-semibold tracking-widest text-[var(--root)] uppercase">
          German vocabulary, connected
        </p>
        <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight sm:text-7xl">
          {returning
            ? 'Continue building your German vocabulary.'
            : 'Learn words through their connections.'}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--mute)]">
          Meanings, short examples, pronunciation and word families in one focused learning
          experience.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-[var(--ink)] px-5 py-3 font-semibold text-[var(--card)]"
            href="/de/levels/a1"
          >
            {returning ? 'Continue learning' : 'Start with A1'}
          </Link>
          <Link
            className="rounded-xl border border-[var(--line)] bg-[var(--card)] px-5 py-3 font-semibold"
            href="/de/topics"
          >
            Explore topics
          </Link>
        </div>
      </section>
    </main>
  )
}
