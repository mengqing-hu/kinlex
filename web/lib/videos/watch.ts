// When a video counts as watched and where it opens. A plain module, so the player can use it.

import type { VideoProgress } from '@/lib/videos/types'

// Stopping this close to the end counts as watching the video to its end: the last seconds are
// often an outro or silence.
export const FINISH_SLACK_MS = 5000

export function isNearEnd(positionMs: number, durationMs: number): boolean {
  return durationMs > 0 && durationMs - positionMs < FINISH_SLACK_MS
}

// Where the video opens: where the learner left it, or the start once they have watched it all.
export function resumePositionMs(progress: VideoProgress | null): number {
  return progress === null || progress.finished ? 0 : progress.positionMs
}
