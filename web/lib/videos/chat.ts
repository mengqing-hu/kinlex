import 'server-only'

import { z } from 'zod'

import type { StudyVideo } from '@/lib/videos/types'

// The model service the pipeline uses: an OpenAI-compatible API on ScaDS.AI.
const API_URL = process.env.SCADS_API_URL ?? ''
const API_KEY = process.env.SCADS_API_KEY ?? ''
const MODEL = process.env.VIDEO_CHAT_MODEL ?? 'mistralai/Mistral-Large-4'

// The service allows a few requests at a time per key, which the pipeline shares; when they are
// taken, the chat waits this long before each new try.
const BUSY_RETRY_MS = [2000, 4000]

// Every try found the service busy.
export class ModelBusyError extends Error {}

// How much of the captions around the playing sentence the model reads.
const LINES_BEFORE = 30
const LINES_AFTER = 10

export const chatRequestSchema = z.object({
  meaningLanguage: z.string().regex(/^[a-z]{2}$/),
  // The sentence playing when the learner asked.
  line: z.number().int().min(0),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

export function isChatConfigured(): boolean {
  return API_URL !== '' && API_KEY !== ''
}

function languageName(code: string): string {
  return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// The captions around the playing sentence, each with its translation, the playing one marked.
function captionWindow(video: StudyVideo, current: number): string {
  const first = Math.max(0, current - LINES_BEFORE)
  return video.lines
    .slice(first, current + LINES_AFTER + 1)
    .map((line, offset) => {
      const mark = first + offset === current ? '>> ' : ''
      const translation = line.translation ? `\n   (${line.translation})` : ''
      return `${mark}[${formatTime(line.startMs)}] ${line.text}${translation}`
    })
    .join('\n')
}

function systemPrompt(video: StudyVideo, current: number): string {
  return [
    `You help someone learn ${languageName(video.language)} while they watch a video, "${video.title}".`,
    `They read the captions with ${languageName(video.meaningLanguage)} translations.`,
    'Answer questions about the words, grammar, expressions and meaning of what is said, and about the scene.',
    'Reply in the language the learner writes in. Keep answers short and concrete; quote the captions where it helps, as plain text without the >> mark or the time.',
    'Format with Markdown: **bold** for the words being explained, lists for forms or meanings. No tables or headings.',
    'The captions around where they are, with the sentence playing when they asked marked >>:',
    captionWindow(video, current),
  ].join('\n\n')
}

// The model's reply as plain text, streamed as it is written.
export async function streamChatReply(
  video: StudyVideo,
  request: ChatRequest,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const current = Math.min(request.line, video.lines.length - 1)
  const body = JSON.stringify({
    model: MODEL,
    stream: true,
    temperature: 0.3,
    messages: [{ role: 'system', content: systemPrompt(video, current) }, ...request.messages],
  })
  let response: Response
  for (let attempt = 0; ; attempt += 1) {
    response = await fetch(`${API_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body,
      signal,
    })
    if (response.status !== 429) break
    const wait = BUSY_RETRY_MS[attempt]
    if (wait === undefined) throw new ModelBusyError(await response.text())
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
  if (!response.ok || !response.body) {
    throw new Error(`${MODEL} answered ${response.status}: ${await response.text()}`)
  }

  // Server-sent events, one `data: {json}` line per piece of the reply.
  const lines = response.body.pipeThrough(new TextDecoderStream())
  let pending = ''
  return lines
    .pipeThrough(
      new TransformStream<string, string>({
        transform(chunk, controller) {
          pending += chunk
          const events = pending.split('\n')
          pending = events.pop() ?? ''
          for (const event of events) {
            const data = event.startsWith('data:') ? event.slice(5).trim() : ''
            if (!data || data === '[DONE]') continue
            const piece = (
              JSON.parse(data) as { choices?: { delta?: { content?: string | null } }[] }
            ).choices?.[0]?.delta?.content
            if (piece) controller.enqueue(piece)
          }
        },
      }),
    )
    .pipeThrough(new TextEncoderStream())
}
