import type { DailyActivity } from '@/types/domain'

export function Heatmap({ days }: { days: readonly DailyActivity[] }) {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const today = new Date()
  const dates = Array.from({ length: 91 }, (_, offset) => {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - (90 - offset))
    return date.toISOString().slice(0, 10)
  })

  return (
    <section aria-labelledby="activity-heading">
      <h2 className="text-2xl font-semibold" id="activity-heading">
        Recent activity
      </h2>
      <div
        className="mt-4 grid grid-cols-13 gap-1"
        role="img"
        aria-label="Learning activity over the last 13 weeks"
      >
        {dates.map((date) => {
          const activity = byDate.get(date)
          const intensity = Math.min(
            4,
            Math.ceil((activity?.activeSeconds ?? 0) / 300) + (activity?.wordsViewed ? 1 : 0),
          )
          const colors = [
            'bg-[var(--line)]',
            'bg-[var(--root)]/25',
            'bg-[var(--root)]/45',
            'bg-[var(--root)]/70',
            'bg-[var(--root)]',
          ]
          return (
            <span
              className={`aspect-square rounded-sm ${colors[intensity]}`}
              key={date}
              title={`${date}: ${activity?.wordsViewed ?? 0} words viewed`}
            />
          )
        })}
      </div>
    </section>
  )
}
