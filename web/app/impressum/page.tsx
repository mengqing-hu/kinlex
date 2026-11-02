import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Impressum' }

export default function ImpressumPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <Link className="font-semibold" href="/">
        Kinlex
      </Link>
      <h1 className="mt-10 text-4xl font-semibold">Impressum</h1>
      <div className="mt-8 space-y-6 leading-7 text-[var(--mute)]">
        <section>
          <h2 className="font-semibold text-[var(--ink)]">Operator</h2>
          <p>Mengqing Hu</p>
        </section>
        <section>
          <h2 className="font-semibold text-[var(--ink)]">Project status</h2>
          <p>
            Kinlex is currently under development. The legally required postal address and direct
            contact details must be added before the website is made publicly available.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-[var(--ink)]">Content responsibility</h2>
          <p>The operator is responsible for the editorial content of this website.</p>
        </section>
      </div>
    </main>
  )
}
