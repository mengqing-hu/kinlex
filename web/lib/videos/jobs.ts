import 'server-only'

import { execFile, spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { estimateRemainingSeconds } from '@/lib/videos/estimate'
import { videoDirectory } from '@/lib/videos/studyFiles'
import { supportedLanguageCodes } from '@/lib/languages'
import {
  type CaptionSource,
  captionSources,
  type UnfinishedVideoJob,
  type VideoCaptions,
  type VideoJob,
} from '@/lib/videos/types'

// Processing runs kinlex-video from the pipeline in src/ on this computer, detached so it carries
// on when the website restarts. The command keeps <id>.<meaning language>.job.json up to date and
// its output goes to the .job.log beside it.
const PIPELINE_ROOT = path.join(process.cwd(), '..', 'src')
const COMMAND =
  process.env.VIDEO_PIPELINE_COMMAND ?? path.join(PIPELINE_ROOT, '.venv', 'bin', 'kinlex-video')

const jobFileSchema = z.object({
  status: z.enum(['running', 'paused', 'done', 'failed']),
  stage: z.string().nullish(),
  progress: z.number().nullish(),
  error: z.string().nullish(),
  pid: z.number().nullish(),
  // The captions asked for, to retry with the same ones, and the title once the video is read.
  captions: z.enum(captionSources).nullish(),
  title: z.string().nullish(),
  // For estimating when processing finishes: the video's length, and when the stage began (Unix
  // seconds).
  duration_ms: z.number().nullish(),
  stage_started_at: z.number().nullish(),
})

// <id>.<meaning language>.job.json
const JOB_FILE = /^([\w-]{11})\.([a-z]{2})\.job\.json$/

interface VideoJobRequest {
  id: string
  language: string
  meaningLanguage: string
}

interface StartVideoJobRequest extends VideoJobRequest {
  captions: CaptionSource
}

// Reading a video's details from YouTube takes a few seconds; one that takes longer has stalled.
const LIST_CAPTIONS_TIMEOUT_MS = 60_000

const listedCaptionsSchema = z.object({
  official: z.string().nullable(),
  automatic: z.string().nullable(),
})

// Which captions YouTube has for the video in the language, asked of the pipeline, which reads
// YouTube with the same settings it processes videos with.
export function listVideoCaptions(id: string, language: string): Promise<VideoCaptions> {
  return new Promise((resolve, reject) => {
    execFile(
      COMMAND,
      [`https://www.youtube.com/watch?v=${id}`, '--language', language, '--list-captions'],
      { cwd: PIPELINE_ROOT, timeout: LIST_CAPTIONS_TIMEOUT_MS },
      (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        try {
          const lastLine = stdout.trim().split('\n').at(-1) ?? ''
          const listed = listedCaptionsSchema.parse(JSON.parse(lastLine))
          resolve({ official: listed.official !== null, automatic: listed.automatic !== null })
        } catch (parseError) {
          reject(parseError instanceof Error ? parseError : new Error(String(parseError)))
        }
      },
    )
  })
}

function jobPath({ id, language, meaningLanguage }: VideoJobRequest, extension: string): string {
  return path.join(videoDirectory(language), `${id}.${meaningLanguage}.job.${extension}`)
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function readJobFile(
  request: VideoJobRequest,
): Promise<z.infer<typeof jobFileSchema> | null> {
  try {
    return jobFileSchema.parse(JSON.parse(await readFile(jobPath(request, 'json'), 'utf8')))
  } catch {
    // Missing, or caught halfway through being written.
    return null
  }
}

export async function readVideoJob(request: VideoJobRequest): Promise<VideoJob | null> {
  const job = await readJobFile(request)
  if (!job) return null
  const title = job.title ?? null
  // A command that stopped without saying so was killed, or the computer restarted.
  if (job.status === 'running' && job.pid && !isRunning(job.pid)) {
    return {
      status: 'failed',
      stage: job.stage ?? null,
      progress: null,
      error: 'stopped',
      title,
      remainingSeconds: null,
      finishesAt: null,
    }
  }
  const stage = job.stage ?? null
  const progress = job.progress ?? null
  const remainingSeconds =
    job.status === 'running'
      ? await estimateRemainingSeconds({
          language: request.language,
          meaningLanguage: request.meaningLanguage,
          captions: job.captions ?? 'whisper',
          stage,
          progress,
          durationMs: job.duration_ms ?? null,
          stageStartedAt: job.stage_started_at ?? null,
        })
      : null
  return {
    status: job.status,
    stage,
    progress,
    error: job.error ?? null,
    title,
    remainingSeconds,
    finishesAt: remainingSeconds === null ? null : Date.now() + remainingSeconds * 1000,
  }
}

// Processing that has not finished, in every language: running, or stopped by a failure the
// learner has not dismissed. Listed so the add page shows it again after the learner leaves.
export async function listUnfinishedVideoJobs(): Promise<UnfinishedVideoJob[]> {
  const perLanguage = await Promise.all(
    supportedLanguageCodes.map(async (language) => {
      const names = await readdir(videoDirectory(language)).catch(() => [])
      const jobs = await Promise.all(
        names.map(async (name): Promise<UnfinishedVideoJob | null> => {
          const match = JOB_FILE.exec(name)
          if (!match?.[1] || !match[2]) return null
          const request = { id: match[1], language, meaningLanguage: match[2] }
          const [file, job] = await Promise.all([readJobFile(request), readVideoJob(request)])
          if (!file || !job || job.status === 'done') return null
          return { ...request, ...job, captions: file.captions ?? 'whisper' }
        }),
      )
      return jobs.filter((job) => job !== null)
    }),
  )
  return perLanguage.flat()
}

// How long a stopped command gets to exit before it is killed outright.
const STOP_GRACE_MS = 3000
const STOP_POLL_MS = 100

// Stops a command and what it started (ffmpeg, which yt-dlp runs): it was started detached, so
// it leads a process group of its own.
async function stopProcess(pid: number): Promise<void> {
  const signal = (name: NodeJS.Signals) => {
    try {
      process.kill(-pid, name)
    } catch {
      // Already gone.
    }
  }
  signal('SIGTERM')
  for (let waited = 0; waited < STOP_GRACE_MS && isRunning(pid); waited += STOP_POLL_MS) {
    await new Promise((resolve) => setTimeout(resolve, STOP_POLL_MS))
  }
  if (isRunning(pid)) signal('SIGKILL')
}

// Stops processing and keeps it as paused. Starting it again carries on where it stopped: the
// download resumes, and the sentences translated and words explained are cached.
export async function pauseVideoJob(request: VideoJobRequest): Promise<boolean> {
  const file = await readJobFile(request)
  if (!file || file.status !== 'running') return false
  if (file.pid) await stopProcess(file.pid)
  await writeFile(
    jobPath(request, 'json'),
    JSON.stringify({ ...file, status: 'paused', progress: null, pid: null }),
    'utf8',
  )
  return true
}

// The study file of a processed video, <id>.<meaning language>.json.
const STUDY_FILE = /^[\w-]{11}\.[a-z]{2}\.json$/

// Stops processing if it runs and forgets it: its status file and log, and the video it was
// downloading, unless the video was processed already or is being processed for another meaning
// language. Translations and meanings stay cached, for processing the video again later.
export async function cancelVideoJob(request: VideoJobRequest): Promise<boolean> {
  const file = await readJobFile(request)
  if (!file) return false
  if (file.status === 'running' && file.pid) await stopProcess(file.pid)
  await Promise.all([
    rm(jobPath(request, 'json'), { force: true }),
    rm(jobPath(request, 'log'), { force: true }),
  ])

  const directory = videoDirectory(request.language)
  const names = (await readdir(directory).catch(() => [])).filter((name) =>
    name.startsWith(`${request.id}.`),
  )
  const otherJobs = await Promise.all(
    names.flatMap((name) => {
      const match = JOB_FILE.exec(name)
      return match?.[2] ? [readVideoJob({ ...request, meaningLanguage: match[2] })] : []
    }),
  )
  const keepVideo =
    names.some((name) => STUDY_FILE.test(name)) ||
    otherJobs.some((job) => job?.status === 'running')
  if (!keepVideo) {
    // The video and the pieces of a download that stopped halfway: <id>.mp4, <id>.f137.mp4.part.
    await Promise.all(
      names
        .filter((name) => !name.includes('.job.') && !STUDY_FILE.test(name))
        .map((name) => rm(path.join(directory, name), { force: true })),
    )
  }
  return true
}

// Starts processing the video unless it is being processed already.
export async function startVideoJob(request: StartVideoJobRequest): Promise<void> {
  if ((await readVideoJob(request))?.status === 'running') return

  mkdirSync(videoDirectory(request.language), { recursive: true })
  const statusPath = jobPath(request, 'json')
  // Written before starting, so a status the command writes first is never overwritten. The
  // command adds its process id.
  await writeFile(
    statusPath,
    JSON.stringify({ status: 'running', stage: null, captions: request.captions }),
    'utf8',
  )
  const log = openSync(jobPath(request, 'log'), 'w')
  const child = spawn(
    COMMAND,
    [
      `https://www.youtube.com/watch?v=${request.id}`,
      '--language',
      request.language,
      '--meaning-language',
      request.meaningLanguage,
      '--captions',
      request.captions,
      '--status-file',
      statusPath,
    ],
    { cwd: PIPELINE_ROOT, detached: true, stdio: ['ignore', log, log] },
  )
  child.on('error', (error) => {
    void writeFile(
      statusPath,
      JSON.stringify({
        status: 'failed',
        stage: null,
        error: error.message,
        captions: request.captions,
      }),
      'utf8',
    )
  })
  child.unref()
  // The command has its own copy of the log file.
  closeSync(log)
}
