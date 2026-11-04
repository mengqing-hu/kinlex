import { Card } from '@/components/ui/Card'
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
    <Card aria-labelledby="stats-heading">
      <h2 className="text-lg font-semibold" id="stats-heading">
        Learning statistics
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(([label, value]) => (
          <div className="rounded-lg bg-[var(--bg)] px-3 py-2.5" key={label}>
            <dt className="text-xs text-[var(--mute)]">{label}</dt>
            <dd className="mt-1 text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
