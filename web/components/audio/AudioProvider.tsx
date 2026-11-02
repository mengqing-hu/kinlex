'use client'

import { createContext, useContext, useRef, useState, type ReactNode } from 'react'

interface AudioContextValue {
  activeUrl: string | null
  isPlaying: boolean
  playAudio: (url: string) => void
}

const AudioContext = createContext<AudioContextValue | null>(null)

interface AudioProviderProps {
  children: ReactNode
}

export function AudioProvider({ children }: AudioProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeUrlRef = useRef<string | null>(null)
  const [activeUrl, setActiveUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  function playAudio(url: string) {
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio
    const isRepeatedPlayback = activeUrlRef.current === url

    audio.pause()

    if (!isRepeatedPlayback) {
      audio.src = url
      activeUrlRef.current = url
      setActiveUrl(url)
    } else {
      audio.currentTime = 0
    }

    audio.playbackRate = isRepeatedPlayback ? 0.75 : 1
    audio.preservesPitch = true
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => setIsPlaying(false)

    void audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false))
  }

  return (
    <AudioContext.Provider value={{ activeUrl, isPlaying, playAudio }}>
      {children}
    </AudioContext.Provider>
  )
}

export function useAudioPlayer(): AudioContextValue {
  const context = useContext(AudioContext)

  if (!context) {
    throw new Error('useAudioPlayer must be used within AudioProvider')
  }

  return context
}
