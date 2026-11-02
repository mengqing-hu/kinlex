'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import type { UserProfile } from '@/types/domain'

export function SettingsForm({ profile }: { profile: UserProfile }) {
  const router = useRouter()
  const [state, setState] = useState(profile)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('saving')
    const response = await fetch('/api/v1/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
    setStatus(response.ok ? 'saved' : 'error')
  }

  async function deleteAccount() {
    if (!window.confirm('Permanently delete your account and all learning data?')) return
    const response = await fetch('/api/v1/me', { method: 'DELETE' })
    if (response.ok) router.push('/')
    else setStatus('error')
  }

  return (
    <section aria-labelledby="settings-heading">
      <h2 className="text-2xl font-semibold" id="settings-heading">
        Settings
      </h2>
      <form className="mt-4 max-w-xl space-y-4" onSubmit={save}>
        <label className="block text-sm font-semibold">
          Display name
          <input
            className="mt-1 min-h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 font-normal"
            value={state.displayName ?? ''}
            onChange={(event) => setState({ ...state, displayName: event.target.value || null })}
          />
        </label>
        <label className="block text-sm font-semibold">
          Timezone
          <input
            className="mt-1 min-h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 font-normal"
            value={state.timezone}
            onChange={(event) => setState({ ...state, timezone: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={state.profilePublic}
            type="checkbox"
            onChange={(event) => setState({ ...state, profilePublic: event.target.checked })}
          />{' '}
          Public profile
        </label>
        <button
          className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--card)] disabled:opacity-60"
          disabled={status === 'saving'}
          type="submit"
        >
          {status === 'saving' ? 'Saving...' : 'Save settings'}
        </button>
        <p aria-live="polite" className="text-sm text-[var(--mute)]">
          {status === 'saved'
            ? 'Settings saved.'
            : status === 'error'
              ? 'The request failed. Please try again.'
              : ''}
        </p>
      </form>
      <div className="mt-10 border-t border-[var(--line)] pt-6">
        <h3 className="font-semibold">Delete account</h3>
        <p className="mt-2 text-sm text-[var(--mute)]">
          This permanently removes your account, favorites and learning history.
        </p>
        <button
          className="mt-4 rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-700"
          type="button"
          onClick={() => void deleteAccount()}
        >
          Delete account
        </button>
      </div>
    </section>
  )
}
