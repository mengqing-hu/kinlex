'use client'

import { useState } from 'react'

import { ActivityGraphFrame } from '@/components/me/ActivityGraphFrame'
import { ACTIVITY_WEEKS, getActivityWindowStart, toDateKey } from '@/lib/utils/activityCalendar'
import type { DailyActivity } from '@/types/domain'

type ActivityRange = 'week' | 'month' | 'year'

const ranges: ReadonlyArray<{ value: ActivityRange; label: string; period: string }> = [
  { value: 'week', label: 'Week', period: 'this week' },
  { value: 'month', label: 'Month', period: 'this month' },
  { value: 'year', label: 'Year', period: 'in the last year' },
]
const levelColors = [
  'bg-[var(--line)]',
  'bg-[var(--root)]/25',
  'bg-[var(--root)]/45',
  'bg-[var(--root)]/70',
  'bg-[var(--root)]',
]
const cellOutline = 'outline-1 -outline-offset-1 outline-black/5 dark:outline-white/5'
// Sunday-first rows, labelling every other weekday the way GitHub does.
const weekdayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const monthTitleFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthNameFormat = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
const shortDayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})
const dayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

interface CalendarDay {
  key: string
  date: Date
  activity: DailyActivity | undefined
  isFuture: boolean
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setUTCDate(date.getUTCDate() + amount)
  return next
}

function getLevel(activity: DailyActivity | undefined): number {
  if (!activity) {
    return 0
  }
  return Math.min(4, Math.ceil(activity.activeSeconds / 300) + (activity.wordsViewed ? 1 : 0))
}

function pluralizeWords(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'word' : 'words'}`
}

function describeDay({ date, activity }: CalendarDay): string {
  const day = dayFormat.format(date)
  if (!activity || (activity.wordsViewed === 0 && activity.activeSeconds === 0)) {
    return `No activity on ${day}`
  }

  const minutes = Math.round(activity.activeSeconds / 60)
  return `${pluralizeWords(activity.wordsViewed)} viewed${minutes > 0 ? `, ${minutes} min` : ''} on ${day}`
}

function DayCell({ day, className }: { day: CalendarDay; className: string }) {
  return (
    <span
      className={`${className} ${cellOutline} ${levelColors[getLevel(day.activity)]}`}
      data-tooltip={describeDay(day)}
    />
  )
}

interface RangeViewProps {
  getDay: (date: Date) => CalendarDay
  today: Date
}

function YearView({ getDay, today }: RangeViewProps) {
  const start = getActivityWindowStart(today)
  // weeks[w][d] is the day in week column w and weekday row d; days after today stay empty.
  const weeks = Array.from({ length: ACTIVITY_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => getDay(addDays(start, w * 7 + d))),
  )

  // A month label sits above the first week that starts in that month. The first column only gets
  // one when there is room for it before the next label.
  const monthLabels: Array<{ week: number; label: string }> = []
  weeks.forEach((week, w) => {
    const firstDay = week[0]
    const previousMonth = w > 0 ? weeks[w - 1]?.[0]?.date.getUTCMonth() : undefined
    if (firstDay && firstDay.date.getUTCMonth() !== previousMonth) {
      monthLabels.push({ week: w, label: monthFormat.format(firstDay.date) })
    }
  })
  if (monthLabels.length > 1 && (monthLabels[1]?.week ?? 0) < 3) {
    monthLabels.shift()
  }

  return (
    <div
      aria-label="Learning activity over the last year"
      className="grid w-max gap-[3px] text-[10px] leading-none text-[var(--mute)]"
      role="img"
      style={{
        gridTemplateColumns: `auto repeat(${ACTIVITY_WEEKS}, 11px)`,
        gridTemplateRows: 'auto repeat(7, 11px)',
      }}
    >
      {monthLabels.map(({ week, label }) => (
        <span
          className="pb-1 whitespace-nowrap"
          key={`month-${week}`}
          style={{ gridColumn: week + 2, gridRow: 1 }}
        >
          {label}
        </span>
      ))}
      {weekdayLabels.map((label, d) =>
        label ? (
          <span
            className="pr-1.5 leading-[11px]"
            key={`weekday-${d}`}
            style={{ gridColumn: 1, gridRow: d + 2 }}
          >
            {label}
          </span>
        ) : null,
      )}
      {weeks.flatMap((week, w) =>
        week.map((day, d) =>
          day.isFuture ? null : (
            <span key={day.key} style={{ gridColumn: w + 2, gridRow: d + 2 }}>
              <DayCell className="block size-full rounded-[2px]" day={day} />
            </span>
          ),
        ),
      )}
    </div>
  )
}

interface ColumnChartProps {
  days: CalendarDay[]
  label: string
  // Which days get a value on their cap; the tooltip carries the rest.
  labelValue: (day: CalendarDay, isMax: boolean) => boolean
  tickLabel: (day: CalendarDay, index: number) => string | null
  todayKey: string
}

function ColumnChart({ days, label, labelValue, tickLabel, todayKey }: ColumnChartProps) {
  const max = Math.max(0, ...days.map((day) => day.activity?.wordsViewed ?? 0))

  return (
    <div aria-label={label} role="img">
      <div className="flex h-40 items-end border-b border-[var(--line)] pt-5">
        {days.map((day) => {
          const words = day.activity?.wordsViewed ?? 0
          const height = max > 0 ? (words / max) * 100 : 0
          return (
            <div
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end px-px"
              data-tooltip={day.isFuture ? undefined : describeDay(day)}
              key={day.key}
            >
              {words > 0 && labelValue(day, words === max) ? (
                <span className="mb-1 text-xs font-medium text-[var(--ink)] tabular-nums">
                  {words}
                </span>
              ) : null}
              <span
                className="w-full max-w-6 rounded-t-[4px] bg-[var(--root)] transition-opacity group-hover:opacity-80"
                style={{ height: `${height}%`, minHeight: words > 0 ? 3 : 0 }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex text-[11px] leading-tight text-[var(--mute)]">
        {days.map((day, index) => {
          const tick = tickLabel(day, index)
          return (
            <span
              className={`min-w-0 flex-1 text-center whitespace-nowrap ${
                day.key === todayKey ? 'font-semibold text-[var(--ink)]' : ''
              } ${day.isFuture ? 'opacity-50' : ''}`}
              key={day.key}
            >
              {tick}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function MonthView({ getDay, today }: RangeViewProps) {
  const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const daysInMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
  ).getUTCDate()
  const days = Array.from({ length: daysInMonth }, (_, index) =>
    getDay(addDays(firstOfMonth, index)),
  )
  const todayKey = toDateKey(today)

  return (
    <ColumnChart
      days={days}
      label={`Words viewed per day in ${monthTitleFormat.format(today)}`}
      labelValue={(_, isMax) => isMax}
      tickLabel={(day, index) =>
        index === 0 || day.key === todayKey || (index + 1) % 7 === 1 ? String(index + 1) : null
      }
      todayKey={todayKey}
    />
  )
}

function WeekView({ getDay, today }: RangeViewProps) {
  const sunday = addDays(today, -today.getUTCDay())
  const days = Array.from({ length: 7 }, (_, d) => getDay(addDays(sunday, d)))

  return (
    <ColumnChart
      days={days}
      label="Words viewed per day this week"
      labelValue={() => true}
      tickLabel={(day, d) => `${weekdayNames[d]} ${day.date.getUTCDate()}`}
      todayKey={toDateKey(today)}
    />
  )
}

function RangeSummary({ days }: { days: readonly DailyActivity[] }) {
  const activeDays = days.filter((day) => day.wordsViewed > 0 || day.activeSeconds > 0)
  const best = activeDays.reduce<DailyActivity | null>(
    (top, day) => (!top || day.wordsViewed > top.wordsViewed ? day : top),
    null,
  )
  const average =
    activeDays.length > 0
      ? Math.round(
          activeDays.reduce((total, day) => total + day.wordsViewed, 0) / activeDays.length,
        )
      : 0
  const items = [
    ['Active days', String(activeDays.length)],
    [
      'Best day',
      best
        ? `${pluralizeWords(best.wordsViewed)} · ${shortDayFormat.format(new Date(`${best.date}T00:00:00Z`))}`
        : '–',
    ],
    ['Average per active day', activeDays.length > 0 ? pluralizeWords(average) : '–'],
  ]

  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-[var(--mute)]">{label}</dt>
          <dd className="font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

interface HeatmapProps {
  days: readonly DailyActivity[]
  // The server's UTC date, so the server and browser render the same calendar.
  today: string
}

export function Heatmap({ days, today: todayKey }: HeatmapProps) {
  const [range, setRange] = useState<ActivityRange>('year')
  const byDate = new Map(days.map((day) => [day.date, day]))
  const today = new Date(`${todayKey}T00:00:00Z`)

  function getDay(date: Date): CalendarDay {
    const key = toDateKey(date)
    return { key, date, activity: byDate.get(key), isFuture: key > todayKey }
  }

  const rangeStart =
    range === 'week'
      ? toDateKey(addDays(today, -today.getUTCDay()))
      : range === 'month'
        ? `${todayKey.slice(0, 8)}01`
        : toDateKey(getActivityWindowStart(today))
  const daysInRange = days.filter((day) => day.date >= rangeStart && day.date <= todayKey)
  const wordsInRange = daysInRange.reduce((total, day) => total + day.wordsViewed, 0)
  const minutesInRange = Math.round(
    daysInRange.reduce((total, day) => total + day.activeSeconds, 0) / 60,
  )
  const period =
    range === 'month'
      ? `in ${monthNameFormat.format(today)}`
      : (ranges.find(({ value }) => value === range)?.period ?? '')

  return (
    <section aria-labelledby="activity-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" id="activity-heading">
            {pluralizeWords(wordsInRange)} viewed {period}
          </h2>
          <p className="text-sm text-[var(--mute)]">
            {minutesInRange.toLocaleString('en-US')} min of study
          </p>
        </div>
        <div
          aria-label="Activity range"
          className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--card)] p-0.5"
          role="group"
        >
          {ranges.map(({ value, label }) => (
            <button
              aria-pressed={range === value}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${
                range === value
                  ? 'bg-[var(--ink)] text-[var(--card)]'
                  : 'text-[var(--mute)] hover:text-[var(--ink)]'
              }`}
              key={value}
              type="button"
              onClick={() => setRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--card)] px-5 pt-4 pb-3">
        <ActivityGraphFrame key={range}>
          {range === 'year' ? (
            <YearView getDay={getDay} today={today} />
          ) : range === 'month' ? (
            <MonthView getDay={getDay} today={today} />
          ) : (
            <WeekView getDay={getDay} today={today} />
          )}
        </ActivityGraphFrame>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-[var(--line)] pt-3">
          <RangeSummary days={daysInRange} />
          {range === 'year' ? (
            <span
              aria-hidden="true"
              className="flex items-center gap-[3px] text-xs text-[var(--mute)]"
            >
              <span className="mr-1">Less</span>
              {levelColors.map((color) => (
                <span className={`size-2.5 rounded-[2px] ${color}`} key={color} />
              ))}
              <span className="ml-1">More</span>
            </span>
          ) : null}
        </div>
      </div>
    </section>
  )
}
