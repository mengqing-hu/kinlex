'use client'

import { useLocale } from 'next-intl'
import { type FormEvent, useEffect, useState } from 'react'

import { Link, useRouter } from '@/i18n/navigation'
import {
  type CaptionSource,
  captionSources,
  getYouTubeId,
  type StudyVideoSummary,
  type UnfinishedVideoJob,
  type VideoCaptions,
  type VideoJob,
} from '@/lib/videos/types'

export interface AddVideoLabels {
  title: string
  intro: string
  link: string
  linkPlaceholder: string
  invalidLink: string
  videoLanguage: string
  meaningLanguage: string
  captionSource: string
  captionSources: Record<CaptionSource, string>
  captionHints: Record<CaptionSource, string>
  captionUnavailable: string
  captionNeedsLink: string
  captionChecking: string
  captionCheckFailed: string
  start: string
  processing: string
  stages: Record<StageRow, string>
  failed: string
  stopped: string
  startFailed: string
  retry: string
  done: string
  openVideo: string
  dismiss: string
  pause: string
  resume: string
  cancel: string
  paused: string
  // Template with {title}.
  cancelConfirm: string
  // Templates with {time} and {minutes}.
  finishesAround: string
  almostDone: string
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
  // Processing still running or failed, found when the page was opened.
  unfinished: UnfinishedVideoJob[]
  labels: AddVideoLabels
}

interface Job {
  id: string
  language: string
  meaningLanguage: string
  captions: CaptionSource
}

// A job shown on the page. attempt grows with every retry, so its card starts following afresh.
interface TrackedJob extends Job {
  status: VideoJob
  attempt: number
  // Started from this page now: open the video when it is ready. A job found when the page opened
  // may finish while the learner does something else, so it only offers a link.
  openWhenDone: boolean
}

function jobKey(job: Job): string {
  return `${job.language}:${job.id}:${job.meaningLanguage}`
}

// The YouTube captions found for one video in one language; null when they could not be checked.
interface CaptionCheck {
  key: string
  captions: VideoCaptions | null
}

// Waits for the link to stop changing before asking YouTube about it.
const CAPTION_CHECK_DELAY_MS = 400

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
      captions: job.captions,
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

function jobParams(job: Job): URLSearchParams {
  return new URLSearchParams({ lang: job.language, explain: job.meaningLanguage })
}

// One video's processing: its steps, followed until it finishes, fails or is paused. It can be
// paused and continued, or cancelled.
function JobCard({
  job,
  labels,
  onRestart,
  onCancelled,
}: {
  job: TrackedJob
  labels: AddVideoLabels
  // Starts it again: to retry a failure or continue after a pause.
  onRestart: () => void
  onCancelled: () => void
}) {
  const router = useRouter()
  const [status, setStatus] = useState(job.status)
  const [stopping, setStopping] = useState(false)

  async function pause() {
    setStopping(true)
    const response = await fetch(`/api/v1/videos/${job.id}/job?${jobParams(job)}`, {
      method: 'PATCH',
    }).catch(() => null)
    setStopping(false)
    if (response?.ok) {
      setStatus((current) => ({
        ...current,
        status: 'paused',
        remainingSeconds: null,
        finishesAt: null,
      }))
    }
  }

  async function cancel() {
    // A failed job is only taken off the list; one running or paused loses its download too.
    if (
      status.status !== 'failed' &&
      !window.confirm(labels.cancelConfirm.replace('{title}', status.title ?? job.id))
    ) {
      return
    }
    setStopping(true)
    const response = await fetch(`/api/v1/videos/${job.id}/job?${jobParams(job)}`, {
      method: 'DELETE',
    }).catch(() => null)
    setStopping(false)
    // A job that never started has no files to remove.
    if (response?.ok || status.error === 'start') onCancelled()
  }

  useEffect(() => {
    if (job.status.status !== 'running') return
    const timer = window.setInterval(() => {
      void fetch(`/api/v1/videos/${job.id}/job?${jobParams(job)}`, { cache: 'no-store' })
        .then((response) => (response.ok ? (response.json() as Promise<VideoJob>) : null))
        .then((next) => {
          if (!next) return
          setStatus(next)
          if (next.status === 'done') {
            window.clearInterval(timer)
            if (job.openWhenDone) router.push(`/${job.language}/videos/${job.id}`)
            // The sidebar lists the new video.
            router.refresh()
          } else if (next.status === 'failed' || next.status === 'paused') {
            window.clearInterval(timer)
          }
        })
        .catch(() => undefined)
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [job, router])

  const locale = useLocale()
  const summary =
    status.status === 'failed'
      ? labels.failed
      : status.status === 'done'
        ? labels.done
        : status.status === 'paused'
          ? labels.paused
          : status.remainingSeconds === null || status.finishesAt === null
            ? labels.processing
            : `${labels.processing} · ${
                status.remainingSeconds < 60
                  ? labels.almostDone
                  : labels.finishesAround
                      .replace(
                        '{time}',
                        new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
                          status.finishesAt,
                        ),
                      )
                      .replace('{minutes}', String(Math.ceil(status.remainingSeconds / 60)))
              }`

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)]">
      {/* Closed, only the title and how it is going; the steps open below. */}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-4 focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-[var(--ink)]">
              {status.title ?? `youtube.com/watch?v=${job.id}`}
            </span>
            <span
              aria-live="polite"
              className={`mt-0.5 block text-sm ${
                status.status === 'failed' ? 'text-[var(--familiarity-1)]' : 'text-[var(--mute)]'
              }`}
            >
              {summary}
            </span>
          </span>
          <svg
            aria-hidden="true"
            className="size-4 shrink-0 text-[var(--mute)] transition-transform group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="border-t border-[var(--line)] px-5 pb-5">
          <ProcessingSteps labels={labels} status={status} />
          {status.status === 'failed' && status.error ? (
            <p className="mt-4 text-sm break-words text-[var(--mute)]">
              {status.error === 'stopped'
                ? labels.stopped
                : status.error === 'start'
                  ? labels.startFailed
                  : status.error}
            </p>
          ) : null}
        </div>
      </details>
      {/* What can be done next stays in view without opening the details. */}
      {status.status !== 'done' ? (
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--mute)] hover:text-[var(--ink)] disabled:opacity-60"
            disabled={stopping}
            type="button"
            onClick={() => void cancel()}
          >
            {status.status === 'failed' ? labels.dismiss : labels.cancel}
          </button>
          <button
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--info)] disabled:opacity-60"
            disabled={stopping}
            type="button"
            onClick={status.status === 'running' ? () => void pause() : onRestart}
          >
            {status.status === 'running'
              ? labels.pause
              : status.status === 'paused'
                ? labels.resume
                : labels.retry}
          </button>
        </div>
      ) : null}
      {status.status === 'done' && !job.openWhenDone ? (
        <div className="px-5 pb-4">
          <Link
            className="inline-block rounded-lg bg-[var(--ink)] px-3 py-1.5 text-sm font-semibold text-[var(--card)] hover:opacity-90"
            href={`/${job.language}/videos/${job.id}`}
          >
            {labels.openVideo}
          </Link>
        </div>
      ) : null}
    </section>
  )
}

// Opens a video that is already processed, or processes it on this computer and follows the
// pipeline's progress until the video can be opened. Processing carries on when the learner leaves
// the page, so the jobs still running or failed are listed again when they come back.
export function AddVideoForm({
  language,
  languages,
  meaningLanguages,
  processed,
  unfinished,
  labels,
}: AddVideoFormProps) {
  const router = useRouter()
  const [link, setLink] = useState('')
  const [videoLanguage, setVideoLanguage] = useState(language)
  const [meaningLanguage, setMeaningLanguage] = useState('en')
  const [error, setError] = useState(false)
  const [jobs, setJobs] = useState<TrackedJob[]>(() =>
    unfinished.map(({ id, language, meaningLanguage, captions, ...status }) => ({
      id,
      language,
      meaningLanguage,
      captions,
      status,
      attempt: 0,
      openWhenDone: false,
    })),
  )
  // The source the learner picked; until then, the best one the video has.
  const [chosenSource, setChosenSource] = useState<CaptionSource | null>(null)
  const [captionCheck, setCaptionCheck] = useState<CaptionCheck | null>(null)
  const videoId = getYouTubeId(link)
  const captionKey = videoId ? `${videoId}:${videoLanguage}` : null
  const checked = captionCheck?.key === captionKey ? captionCheck : null
  const checkingCaptions = captionKey !== null && checked === null

  useEffect(() => {
    if (!videoId) return
    const key = `${videoId}:${videoLanguage}`
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        lang: videoLanguage,
      })
      void fetch(`/api/v1/videos/captions?${params}`, { signal: controller.signal })
        .then((response) => (response.ok ? (response.json() as Promise<VideoCaptions>) : null))
        .then((captions) => setCaptionCheck({ key, captions }))
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === 'AbortError') return
          setCaptionCheck({ key, captions: null })
        })
    }, CAPTION_CHECK_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [videoId, videoLanguage])

  // Whisper needs nothing from YouTube; the YouTube captions only once the video is known to have
  // them.
  function isAvailable(source: CaptionSource): boolean {
    return source === 'whisper' || checked?.captions?.[source] === true
  }
  const captionSource: CaptionSource =
    chosenSource && isAvailable(chosenSource)
      ? chosenSource
      : isAvailable('official')
        ? 'official'
        : 'whisper'

  function captionNote(source: CaptionSource): string {
    if (isAvailable(source)) return labels.captionHints[source]
    if (!captionKey) return labels.captionNeedsLink
    if (checkingCaptions) return labels.captionChecking
    return labels.captionUnavailable
  }

  // Starts a job, or starts it again, keeping its place in the list.
  async function run(next: Job) {
    const key = jobKey(next)
    const existing = jobs.find((job) => jobKey(job) === key)
    // A retry keeps the title it had until the pipeline reads it again.
    const title = existing?.status.title ?? null
    const tracked = (status: VideoJob): TrackedJob => ({
      ...next,
      status,
      attempt: (existing?.attempt ?? 0) + 1,
      openWhenDone: true,
    })
    const started = await startJob(next)
    const status: VideoJob = started
      ? {
          status: 'running',
          stage: null,
          progress: null,
          error: null,
          title,
          remainingSeconds: null,
          finishesAt: null,
        }
      : {
          status: 'failed',
          stage: null,
          progress: null,
          error: 'start',
          title,
          remainingSeconds: null,
          finishesAt: null,
        }
    setJobs((current) => [tracked(status), ...current.filter((job) => jobKey(job) !== key)])
  }

  function forget(job: TrackedJob) {
    setJobs((current) => current.filter((item) => jobKey(item) !== jobKey(job)))
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
    const next = { id, language: videoLanguage, meaningLanguage, captions: captionSource }
    // Already being processed: its card is followed below.
    if (jobs.some((job) => jobKey(job) === jobKey(next) && job.status.status === 'running')) {
      return
    }
    void run(next)
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{labels.title}</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--mute)]">{labels.intro}</p>

      <form
        className="mt-8 space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5"
        noValidate
        onSubmit={handleSubmit}
      >
        <fieldset className="space-y-5">
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

          <fieldset>
            <legend className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
              {labels.captionSource}
            </legend>
            <div className="space-y-2">
              {captionSources.map((source) => {
                const available = isAvailable(source)
                return (
                  <label
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                      captionSource === source
                        ? 'border-[var(--info)] bg-[var(--bg)]'
                        : 'border-[var(--line)]'
                    } ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                    key={source}
                  >
                    <input
                      checked={captionSource === source}
                      className="mt-1 accent-[var(--info)]"
                      disabled={!available}
                      name="captions"
                      type="radio"
                      value={source}
                      onChange={() => setChosenSource(source)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--ink)]">
                        {labels.captionSources[source]}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[var(--mute)]">
                        {captionNote(source)}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
            {checked && checked.captions === null ? (
              <p className="mt-2 text-xs text-[var(--familiarity-1)]" role="alert">
                {labels.captionCheckFailed}
              </p>
            ) : null}
          </fieldset>

          <button
            className="w-full rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-[var(--card)] hover:opacity-90 disabled:opacity-60"
            disabled={checkingCaptions}
            type="submit"
          >
            {labels.start}
          </button>
        </fieldset>
      </form>

      {jobs.length > 0 ? (
        <div className="mt-6 space-y-4">
          {jobs.map((job) => (
            <JobCard
              job={job}
              key={`${jobKey(job)}:${job.attempt}`}
              labels={labels}
              onCancelled={() => forget(job)}
              onRestart={() => void run(job)}
            />
          ))}
        </div>
      ) : null}
    </main>
  )
}
