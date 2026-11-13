// A plain module, so client components can use the types too.

// A word of a caption sentence; start and end are character offsets in its text, end exclusive.
export interface StudyToken {
  start: number
  end: number
  surface: string
  lemma: string
  // The vocabulary entry when the word is one, for the word detail panel.
  slug: string | null
  // The word's meaning in this sentence, in the video's meaning language.
  gloss: string | null
  // When the word is said, if the study file times its words.
  startMs: number | null
  endMs: number | null
}

export interface StudyLine {
  position: number
  startMs: number
  endMs: number
  text: string
  translation: string | null
  tokens: StudyToken[]
}

export interface StudyVideo {
  id: string
  title: string
  language: string
  meaningLanguage: string
  lines: StudyLine[]
}

export interface StudyVideoSummary {
  id: string
  title: string
  meaningLanguages: string[]
}

// Processing a video, as its status file tells it. stage is one of the pipeline's stages.
export interface VideoJob {
  status: 'running' | 'done' | 'failed'
  stage: string | null
  progress: number | null
  error: string | null
}

export interface StudyVideoLink {
  id: string
  href: string
  // The language the video is in, which its page and its rename and delete calls go under.
  language: string
  title: string
}

const YOUTUBE_ID = /(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/
const BARE_ID = /^[\w-]{11}$/

// The video id in a YouTube link, or null when the text is not one.
export function getYouTubeId(text: string): string | null {
  const value = text.trim()
  if (BARE_ID.test(value)) return value
  return YOUTUBE_ID.exec(value)?.[1] ?? null
}

// The word of a sentence being said at a time, or null between words.
export function findSpokenToken(line: StudyLine, timeMs: number): number | null {
  const index = line.tokens.findIndex(
    (token) =>
      token.startMs !== null &&
      token.endMs !== null &&
      token.startMs <= timeMs &&
      timeMs < token.endMs,
  )
  return index === -1 ? null : index
}

const MIN_CUE_MS = 1000

function vttTime(ms: number): string {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor(ms / 60_000) % 60
  const seconds = Math.floor(ms / 1000) % 60
  const pad = (value: number, size = 2) => String(value).padStart(size, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(ms % 1000, 3)}`
}

function vttText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

// The captions as a WebVTT file for the player to draw: each sentence over its translation, which
// carries the class "translation". Null when neither is shown.
export function toWebVtt(
  lines: StudyLine[],
  { original, translation }: { original: boolean; translation: boolean },
): string | null {
  if (!original && !translation) return null
  const cues = lines.flatMap((line, index) => {
    const rows = [
      original ? vttText(line.text) : null,
      translation && line.translation ? `<c.translation>${vttText(line.translation)}</c>` : null,
    ].filter(Boolean)
    if (rows.length === 0) return []
    // A sentence gives way when the next one starts, so two never show at once. One squeezed
    // between its neighbours with no length of its own stays up until then, for at most a second.
    const next = lines[index + 1]?.startMs
    const end =
      line.endMs > line.startMs
        ? Math.min(line.endMs, next !== undefined && next > line.startMs ? next : line.endMs)
        : Math.max(line.startMs + 1, Math.min(next ?? Infinity, line.startMs + MIN_CUE_MS))
    return [`${vttTime(line.startMs)} --> ${vttTime(end)}\n${rows.join('\n')}`]
  })
  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}

// The caption sentence playing at a time: the last one that has started.
export function findLineIndex(lines: StudyLine[], timeMs: number): number {
  let low = 0
  let high = lines.length - 1
  let found = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if ((lines[middle]?.startMs ?? 0) <= timeMs) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return found
}
