'use client'

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

import { PanelCloseButton, SidePanel } from '@/components/ui/SidePanel'
import type { StudyVideo } from '@/lib/videos/types'

export interface VideoChatLabels {
  chat: string
  chatHint: string
  chatPlaceholder: string
  send: string
  chatFailed: string
  chatBusy: string
  close: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface VideoChat {
  messages: ChatMessage[]
  busy: boolean
  failure: 'busy' | 'failed' | null
  // Resolves to false when no answer came, and the question is taken back out of the chat.
  send: (question: string, line: number) => Promise<boolean>
}

// The conversation about the video. It lives with the page, so it outlasts the right column
// switching to a word or the search, and a reply keeps coming in meanwhile.
export function useVideoChat(video: StudyVideo): VideoChat {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<VideoChat['failure']>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = useCallback(
    (question: string, line: number) => {
      const asked = [...messages, { role: 'user' as const, content: question }]
      setMessages([...asked, { role: 'assistant', content: '' }])
      setBusy(true)
      setFailure(null)
      const controller = new AbortController()
      abortRef.current = controller

      return (async () => {
        try {
          const response = await fetch(`/api/v1/videos/${video.id}/chat?lang=${video.language}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meaningLanguage: video.meaningLanguage, line, messages: asked }),
            signal: controller.signal,
          })
          if (response.status === 429) {
            setFailure('busy')
            setMessages(messages)
            return false
          }
          if (!response.ok || !response.body) throw new Error(String(response.status))
          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
          let reply = ''
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            reply += value
            setMessages([...asked, { role: 'assistant', content: reply }])
          }
          if (!reply) throw new Error('empty reply')
          return true
        } catch {
          if (controller.signal.aborted) return false
          setMessages(messages)
          setFailure('failed')
          return false
        } finally {
          setBusy(false)
        }
      })()
    },
    [messages, video.id, video.language, video.meaningLanguage],
  )

  return { messages, busy, failure, send }
}

const replyClass = [
  'text-sm leading-6 text-[var(--ink)] [&>:first-child]:mt-0 [&>:last-child]:mb-0',
  '[&_p]:my-2 [&_strong]:font-semibold [&_em]:italic [&_h1,&_h2,&_h3,&_h4]:mt-3 [&_h1,&_h2,&_h3,&_h4]:mb-1 [&_h1,&_h2,&_h3,&_h4]:font-semibold',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--line)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--mute)]',
  '[&_code]:rounded [&_code]:bg-[var(--bg)] [&_code]:px-1 [&_code]:text-[0.85em] [&_a]:text-[var(--info)] [&_a]:underline',
].join(' ')

export function VideoChatPanel({
  chat,
  labels,
  line,
  onClose,
}: {
  chat: VideoChat
  labels: VideoChatLabels
  // The sentence playing, so the model reads the captions around it.
  line: number
  onClose: () => void
}) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const last = chat.messages.at(-1)?.content

  // Follows the reply as it is written.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [chat.messages.length, last])

  function submit(event?: FormEvent) {
    event?.preventDefault()
    const question = draft.trim()
    if (!question || chat.busy) return
    setDraft('')
    // An unanswered question goes back into the box, to ask again.
    void chat.send(question, line).then((answered) => {
      if (!answered) setDraft((current) => current || question)
    })
  }

  return (
    <SidePanel busy={chat.busy} label={labels.chat} onClose={onClose}>
      <header className="flex shrink-0 items-center gap-0.5 border-b border-[var(--line)] px-4 py-2.5">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink)]">
          {labels.chat}
        </h2>
        <PanelCloseButton label={labels.close} onClose={onClose} />
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" ref={listRef}>
        {chat.messages.length === 0 ? (
          <p className="text-sm text-[var(--mute)]">{labels.chatHint}</p>
        ) : null}
        {chat.messages.map((message, index) =>
          message.role === 'user' ? (
            <p
              className="ml-8 rounded-xl bg-[var(--bg)] px-3 py-2 text-sm leading-6 whitespace-pre-wrap text-[var(--ink)]"
              key={index}
            >
              {message.content}
            </p>
          ) : message.content ? (
            // The model writes Markdown; it is shown as text, never as HTML.
            <div className={replyClass} key={index}>
              <Markdown>{message.content}</Markdown>
            </div>
          ) : (
            <p className="text-sm text-[var(--mute)]" key={index}>
              …
            </p>
          ),
        )}
        {chat.failure ? (
          <p className="text-xs text-[var(--familiarity-1)]" role="alert">
            {chat.failure === 'busy' ? labels.chatBusy : labels.chatFailed}
          </p>
        ) : null}
      </div>
      <form className="shrink-0 border-t border-[var(--line)] p-3" onSubmit={submit}>
        <label className="sr-only" htmlFor="video-chat-input">
          {labels.chatPlaceholder}
        </label>
        <div className="flex items-end gap-2">
          <textarea
            className="max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--mute)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
            id="video-chat-input"
            placeholder={labels.chatPlaceholder}
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter, or Enter while composing with an IME, starts a new line.
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                submit()
              }
            }}
          />
          <button
            className="h-10 rounded-lg bg-[var(--ink)] px-3 text-xs font-semibold text-[var(--card)] transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none disabled:opacity-40"
            disabled={chat.busy || draft.trim() === ''}
            type="submit"
          >
            {labels.send}
          </button>
        </div>
      </form>
    </SidePanel>
  )
}
