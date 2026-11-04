// The activity graph shows 53 week columns, Sunday to Saturday, ending with the current week, so
// the window starts on the Sunday 52 weeks before this week's Sunday. Dates are UTC days.
export const ACTIVITY_WEEKS = 53

export function getActivityWindowStart(today: Date): Date {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - start.getUTCDay() - (ACTIVITY_WEEKS - 1) * 7)
  return start
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
