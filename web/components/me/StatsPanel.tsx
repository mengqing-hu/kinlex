import type { UserStatistics } from '@/types/domain'

export function StatsPanel({ stats }: { stats: UserStatistics }) {
  const items = [
    ['Current streak', `${stats.currentStreak} days`],
    ['Longest streak', `${stats.longestStreak} days`],
    ['Study time', `${Math.round(stats.activeSeconds / 60)} min`],
    ['Words viewed', String(stats.wordsViewed)],
    ['Words mastered', String(stats.wordsMastered)],
  ]
  return (
    <section aria-labelledby="stats-heading">
      <h2 className="text-2xl font-semibold" id="stats-heading">
        Learning statistics
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(([label, value]) => (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4" key={label}>
            <dt className="text-sm text-[var(--mute)]">{label}</dt>
            <dd className="mt-2 text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
