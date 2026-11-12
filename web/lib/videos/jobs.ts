import 'server-only'

import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { videoDirectory } from '@/lib/videos/studyFiles'
import type { VideoJob } from '@/lib/videos/types'

// Processing runs kinlex-video from the pipeline in src/ on this computer, detached so it carries
// on when the website restarts. The command keeps <id>.<meaning language>.job.json up to date and
// its output goes to the .job.log beside it.
const PIPELINE_ROOT = path.join(process.cwd(), '..', 'src')
const COMMAND =
  process.env.VIDEO_PIPELINE_COMMAND ?? path.join(PIPELINE_ROOT, '.venv', 'bin', 'kinlex-video')

const jobFileSchema = z.object({
  status: z.enum(['running', 'done', 'failed']),
  stage: z.string().nullish(),
  progress: z.number().nullish(),
  error: z.string().nullish(),
  pid: z.number().nullish(),
})

interface VideoJobRequest {
  id: string
  language: string
  meaningLanguage: string
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

export async function readVideoJob(request: VideoJobRequest): Promise<VideoJob | null> {
  let text: string
  try {
    text = await readFile(jobPath(request, 'json'), 'utf8')
  } catch {
    return null
  }
  const job = jobFileSchema.parse(JSON.parse(text))
  // A command that stopped without saying so was killed, or the computer restarted.
  if (job.status === 'running' && job.pid && !isRunning(job.pid)) {
    return { status: 'failed', stage: job.stage ?? null, progress: null, error: 'stopped' }
  }
  return {
    status: job.status,
    stage: job.stage ?? null,
    progress: job.progress ?? null,
    error: job.error ?? null,
  }
}

// Starts processing the video unless it is being processed already.
export async function startVideoJob(request: VideoJobRequest): Promise<void> {
  if ((await readVideoJob(request))?.status === 'running') return

  mkdirSync(videoDirectory(request.language), { recursive: true })
  const statusPath = jobPath(request, 'json')
  // Written before starting, so a status the command writes first is never overwritten. The
  // command adds its process id.
  await writeFile(statusPath, JSON.stringify({ status: 'running', stage: null }), 'utf8')
  const log = openSync(jobPath(request, 'log'), 'w')
  const child = spawn(
    COMMAND,
    [
      `https://www.youtube.com/watch?v=${request.id}`,
      '--language',
      request.language,
      '--meaning-language',
      request.meaningLanguage,
      '--status-file',
      statusPath,
    ],
    { cwd: PIPELINE_ROOT, detached: true, stdio: ['ignore', log, log] },
  )
  child.on('error', (error) => {
    void writeFile(
      statusPath,
      JSON.stringify({ status: 'failed', stage: null, error: error.message }),
      'utf8',
    )
  })
  child.unref()
  // The command has its own copy of the log file.
  closeSync(log)
}
