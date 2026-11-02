import type { ActivityEventInput } from '@/lib/validation/me'

const EVENT_QUEUE_KEY = 'kinlex:activity-events'

function readQueue(): ActivityEventInput[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(EVENT_QUEUE_KEY) ?? '[]') as unknown
    return Array.isArray(value) ? (value as ActivityEventInput[]) : []
  } catch {
    return []
  }
}

function writeQueue(events: ActivityEventInput[]): void {
  window.localStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(events.slice(-500)))
}

export async function flushEventQueue(): Promise<void> {
  const events = readQueue()
  if (events.length === 0) return

  const batch = events.slice(0, 100)
  const response = await fetch('/api/v1/me/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: batch }),
  })
  if (response.ok) writeQueue(events.slice(batch.length))
}

export function queueActivityEvent(
  event: Omit<ActivityEventInput, 'clientEventId' | 'occurredAt'>,
): void {
  writeQueue([
    ...readQueue(),
    { ...event, clientEventId: crypto.randomUUID(), occurredAt: new Date().toISOString() },
  ])
  void flushEventQueue()
}
