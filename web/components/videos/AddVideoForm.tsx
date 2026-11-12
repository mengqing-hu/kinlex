'use client'

import { type FormEvent, useEffect, useState } from 'react'

import { useRouter } from '@/i18n/navigation'
import { getYouTubeId, type StudyVideoSummary, type VideoJob } from '@/lib/videos/types'

export interface AddVideoLabels {
  title: string
  intro: string
  link: string
  linkPlaceholder: string
  invalidLink: string
  videoLanguage: string
  meaningLanguage: string
  start: string
  processing: string
  stages: Record<StageRow, string>
  failed: string
  stopped: string
  startFailed: string
  retry: string
}

interface Option {
  code: string
  name: string
}

interface AddVideoFormProps {
  language: string
  languages: Option[]
  meaningLanguages: Option[]
  // The videos already processed, by the language they are in.
  processed: Record<string, StudyVideoSummary[]>
  labels: AddVideoLabels
}

interface Job {
  id: string
  language: string
  meaningLanguage: string
}

// The steps shown while processing. The pipeline reads official captions or transcribes the
// speech, one or the other, so they share a step.
type StageRow = 'metadata' | 'download' | 'text' | 'translation' | 'meanings' | 'timing'
const STAGE_ROWS: StageRow[] = ['metadata', 'download', 'text', 'translation', 'meanings', 'timing']
const ROW_OF_STAGE: Record<string, StageRow> = {
  metadata: 'metadata',
  download: 'download',
  captions: 'text',
  transcription: 'text',
  translation: 'translation',
  meanings: 'meanings',
  timing: 'timing',
}
const POLL_MS = 1000

const fieldClass =
  'w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none disabled:opacity-60'

async function startJob(job: Job): Promise<boolean> {
  const response = await fetch('/api/v1/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: `https://www.youtube.com/watch?v=${job.id}`,
      language: job.language,
      meaningLanguage: job.meaningLanguage,
    }),
  })
  return response.ok
}

function ProcessingSteps({ status, labels }: { status: VideoJob; labels: AddVideoLabels }) {
  const current = STAGE_ROWS.indexOf(ROW_OF_STAGE[status.stage ?? 'metadata'] ?? 'metadata')
  return (
    <ol className="mt-4 space-y-3">
      {STAGE_ROWS.map((row, index) => {
        const done = status.status === 'done' || index < current
        const active = status.status === 'running' && index === current
        const failed = status.status === 'failed' && index === current
        const percent =
          active && status.progress !== null ? Math.round(status.progress * 100) : null
        return (
          <li key={row}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span
                className={
                  done || active || failed ? 'text-[var(--ink)]' : 'text-[var(--mute)] opacity-60'
                }
              >
                {done ? '✓ ' : failed ? '✕ ' : ''}
                {labels.stages[row]}
              </span>
              {percent !== null ? (
                <span className="text-xs text-[var(--mute)] tabular-nums">{percent}%</span>
              ) : null}
            </div>
            {active ? (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg)]">
                <div
                  className={`h-full rounded-full bg-[var(--root)] transition-[width] ${
                    percent === null ? 'w-1/3 animate-pulse' : ''
                  }`}
                  style={percent === null ? undefined : { width: `${percent}%` }}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

// Opens a video that is already processed, or processes it on this computer and follows the
// pipeline's progress until the video can be opened.
export function AddVideoForm({
  language,
  languages,
  meaningLanguages,
  processed,
  labels,
}: AddVideoFormProps) {
  const router = useRouter()
  const [link, setLink] = useState('')
  const [videoLanguage, setVideoLanguage] = useState(language)
  const [meaningLanguage, setMeaningLanguage] = useState('en')
  const [error, setError] = useState(false)
  // The job being followed, and the last one asked for, which a retry asks for again.
  const [job, setJob] = useState<Job | null>(null)
  const [attempt, setAttempt] = useState<Job | null>(null)
  const [status, setStatus] = useState<VideoJob | null>(null)

  useEffect(() => {
    if (!job) return
    const params = new URLSearchParams({ lang: job.language, explain: job.meaningLanguage })
    const timer = window.setInterval(() => {
      void fetch(`/api/v1/videos/${job.id}/job?${params}`, { cache: 'no-store' })
        .then((response) => (response.ok ? (response.json() as Promise<VideoJob>) : null))
        .then((next) => {
          if (!next) return
          setStatus(next)
          if (next.status === 'done') {
            window.clearInterval(timer)
            router.push(`/${job.language}/videos/${job.id}`)
            router.refresh()
          } else if (next.status === 'failed') {
            window.clearInterval(timer)
          }
        })
        .catch(() => undefined)
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [job, router])

  async function run(next: Job) {
    setAttempt(next)
    setJob(null)
    setStatus({ status: 'running', stage: null, progress: null, error: null })
    if (await startJob(next)) {
      setJob(next)
    } else {
      setStatus({ status: 'failed', stage: null, progress: null, error: 'start' })
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const id = getYouTubeId(link)
    setError(id === null)
    if (id === null) return

    const done = processed[videoLanguage]?.find((video) => video.id === id)
    if (done?.meaningLanguages.includes(meaningLanguage)) {
      router.push(`/${videoLanguage}/videos/${id}`)
      return
    }
    void run({ id, language: videoLanguage, meaningLanguage })
  }

  const busy = status?.status === 'running'

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{labels.title}</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--mute)]">{labels.intro}</p>

      <form
        className="mt-8 space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5"
        noValidate
        onSubmit={handleSubmit}
      >
        <fieldset className="space-y-5" disabled={busy}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
              {labels.link}
            </span>
            <input
              aria-invalid={error}
              className={fieldClass}
              placeholder={labels.linkPlaceholder}
              type="url"
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
            {error ? (
              <span className="mt-1.5 block text-xs text-[var(--familiarity-1)]" role="alert">
                {labels.invalidLink}
              </span>
            ) : null}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
                {labels.videoLanguage}
              </span>
              <select
                className={fieldClass}
                value={videoLanguage}
                onChange={(event) => setVideoLanguage(event.target.value)}
              >
                {languages.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
                {labels.meaningLanguage}
              </span>
              <select
                className={fieldClass}
                value={meaningLanguage}
                onChange={(event) => setMeaningLanguage(event.target.value)}
              >
                {meaningLanguages.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            className="w-full rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-[var(--card)] hover:opacity-90 disabled:opacity-60"
            type="submit"
          >
            {labels.start}
          </button>
        </fieldset>
      </form>

      {status ? (
        <section
          aria-live="polite"
          className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5"
        >
          <h2 className="font-semibold text-[var(--ink)]">
            {status.status === 'failed' ? labels.failed : labels.processing}
          </h2>
          <ProcessingSteps labels={labels} status={status} />
          {status.status === 'failed' ? (
            <div className="mt-4 flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm break-words text-[var(--mute)]">
                {status.error === 'stopped'
                  ? labels.stopped
                  : status.error === 'start'
                    ? labels.startFailed
                    : status.error}
              </p>
              {attempt ? (
                <button
                  className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--info)]"
                  type="button"
                  onClick={() => void run(attempt)}
                >
                  {labels.retry}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}
