import type { Metadata } from 'next'

import { Link } from '@/i18n/navigation'
import { applyRouteLocale } from '@/i18n/server'

export const metadata: Metadata = { title: 'Privacy policy' }

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  await applyRouteLocale(params)

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <Link className="font-semibold" href="/">
        Kinlex
      </Link>
      <h1 className="mt-10 text-4xl font-semibold">Privacy policy</h1>
      <div className="mt-8 space-y-7 leading-7 text-[var(--mute)]">
        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Data we process</h2>
          <p>
            When you sign in, Kinlex processes your email address through Supabase Auth. If you use
            learning features, we store your profile settings, favorites and learning activity.
            Before sign-in, favorites and queued activity remain in your browser’s local storage.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Purpose</h2>
          <p>
            This data is used only to provide authentication, synchronize learning progress and show
            personal statistics.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Service providers</h2>
          <p>
            Supabase provides authentication and database hosting. Vercel hosts the website.
            Cloudflare R2 may deliver audio files. Their processing is governed by their respective
            privacy terms.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Your choices</h2>
          <p>
            You can update your profile or delete your account and associated user data from the
            account page. Local browser data can be removed through your browser settings.
          </p>
        </section>
      </div>
    </main>
  )
}
