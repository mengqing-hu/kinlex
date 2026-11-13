import 'server-only'

import { readFile, stat } from 'node:fs/promises'

import { z } from 'zod'

import { videoTimingsFile } from '@/lib/videos/studyFiles'
import type { CaptionSource } from '@/lib/videos/types'

// The pipeline's stages, in the order it runs them.
type Stage =
  'metadata' | 'download' | 'captions' | 'transcription' | 'translation' | 'meanings' | 'timing'

// How long a stage takes: a fixed part, and a part for every minute of video.
interface StageCost {
  seconds: number
  perMinute: number
}

// Rough costs for when no video has been processed yet; measured ones replace them.
const DEFAULT_COSTS: Record<Stage, StageCost> = {
  metadata: { seconds: 5, perMinute: 0 },
  download: { seconds: 5, perMinute: 4 },
  captions: { seconds: 3, perMinute: 0 },
  transcription: { seconds: 10, perMinute: 8 },
  translation: { seconds: 10, perMinute: 12 },
  meanings: { seconds: 10, perMinute: 25 },
  timing: { seconds: 5, perMinute: 0 },
}
// A video of unknown length is taken to be this long.
const DEFAULT_MINUTES = 10
// The most recent records the estimate learns from.
const HISTORY_SIZE = 20
// Below this much progress, a stage's own rate says too little; the history estimates it instead.
const MIN_PROGRESS = 0.05

const timingSchema = z.object({
  captions: z.string(),
  duration_ms: z.number().nullable(),
  stage_seconds: z.record(z.string(), z.number()),
})
type Timing = z.infer<typeof timingSchema>

let history: { modified: number; records: Timing[] } | null = null

// The latest records, read again only when the file changes.
async function readHistory(): Promise<Timing[]> {
  const file = videoTimingsFile()
  const modified = await stat(file).then(
    (info) => info.mtimeMs,
    () => 0,
  )
  if (history?.modified === modified) return history.records
  const text = modified ? await readFile(file, 'utf8').catch(() => '') : ''
  const records = text
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [timingSchema.parse(JSON.parse(line))]
      } catch {
        return []
      }
    })
    .slice(-HISTORY_SIZE)
  history = { modified, records }
  return records
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = values.toSorted((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

// The expected seconds of a stage for a video this long: the default cost, scaled by how much
// longer or shorter it took on the videos processed before.
function expectedSeconds(stage: Stage, minutes: number, records: Timing[]): number {
  const cost = DEFAULT_COSTS[stage]
  const defaultFor = (videoMinutes: number) => cost.seconds + cost.perMinute * videoMinutes
  const ratios = records.flatMap((record) => {
    const seconds = record.stage_seconds[stage]
    const recordMinutes = (record.duration_ms ?? DEFAULT_MINUTES * 60_000) / 60_000
    return seconds === undefined ? [] : [seconds / defaultFor(recordMinutes)]
  })
  return defaultFor(minutes) * (median(ratios) ?? 1)
}

interface RunningJob {
  language: string
  meaningLanguage: string
  captions: CaptionSource
  stage: string | null
  progress: number | null
  durationMs: number | null
  // Unix seconds.
  stageStartedAt: number | null
}

// About how many seconds processing still needs.
export async function estimateRemainingSeconds(job: RunningJob): Promise<number> {
  const records = await readHistory()
  const stages: Stage[] = [
    'metadata',
    'download',
    job.captions === 'whisper' ? 'transcription' : 'captions',
    // A video explained in its own language is not translated.
    ...(job.language === job.meaningLanguage ? [] : (['translation'] as const)),
    'meanings',
    'timing',
  ]
  const minutes = job.durationMs ? job.durationMs / 60_000 : DEFAULT_MINUTES
  const current = stages.findIndex((stage) => stage === job.stage)

  let remaining = 0
  stages.forEach((stage, index) => {
    if (index < current) return
    const expected = expectedSeconds(stage, minutes, records)
    if (index > current) {
      remaining += expected
      return
    }
    const elapsed = job.stageStartedAt ? Date.now() / 1000 - job.stageStartedAt : 0
    const progress = job.progress ?? 0
    remaining +=
      progress >= MIN_PROGRESS
        ? (elapsed * (1 - progress)) / progress
        : // Running over the expected time: still something left, a little.
          Math.max(expected - elapsed, expected * 0.15)
  })
  return Math.round(remaining)
}
