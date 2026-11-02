import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Data and credits' }

export default function CreditsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <Link className="font-semibold" href="/">
        Kinlex
      </Link>
      <h1 className="mt-10 text-4xl font-semibold">Data and credits</h1>
      <div className="mt-8 space-y-7 leading-7 text-[var(--mute)]">
        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Vocabulary levels</h2>
          <p>
            Level assignments may use published Goethe-Institut vocabulary lists and are reviewed
            before publication.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Dictionary data</h2>
          <p>
            Lexical information may be adapted from Kaikki.org data derived from Wiktionary, subject
            to the licenses and attribution requirements of those sources.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Generated content</h2>
          <p>
            Definitions, examples, word structure and audio can be generated with language and
            speech models, then reviewed by a human before publication.
          </p>
        </section>
      </div>
    </main>
  )
}
