/**
 * useQcSession — QC phase state via socket.io + REST fallback.
 *
 * Loads the ordered QC token list once via REST, then keeps vote counts and
 * the session status up-to-date via socket events:
 *   qc:vote        → merge updated vote_counts into the relevant token
 *   qc:correction  → update corrected_text on the relevant token
 *   qc:translation → append to qc_translations on the relevant token
 *   qc:audio-ready → set yahura_transcription + audio vote counts
 *   session:status → update session metadata (status, leaderboard, etc.)
 *
 * If the socket is unavailable, a 2s REST poll provides the same updates.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import { createSocket, type SocketAuth } from '@/runtime/socket'
import type { QcToken, Session } from '@/types'

interface UseQcSessionOptions {
  auth?: SocketAuth | null
}

interface UseQcSessionResult {
  qcWords: QcToken[]
  currentIndex: number
  currentToken: QcToken | null
  session: Session | null
  loading: boolean
  error: string | null
  setCurrentIndex: (index: number) => void
  refreshStatus: () => Promise<void>
}

interface QcVoteEvent {
  token_id: string
  dimension: 'orthography' | 'semantics' | 'audio'
  vote_counts: {
    orthography: { yes: number; no: number }
    semantics: { yes: number; no: number }
    audio: { yes: number; no: number }
  }
}

interface QcTokenIdEvent {
  token_id: string
}

export function useQcSession(
  session_id: string | null,
  options: UseQcSessionOptions = {},
): UseQcSessionResult {
  const [qcWords, setQcWords] = useState<QcToken[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const socketConnectedRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef(session_id)
  sessionIdRef.current = session_id

  const refreshStatus = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const status = await api.session.status(sid)
      setSession(status)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh QC status')
    }
  }, [])

  const refreshQcWords = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const words = await api.session.qcWords(sid)
      setQcWords(words)
    } catch {
      // best-effort; retain current list
    }
  }, [])

  // Load QC words once
  useEffect(() => {
    let active = true
    if (!session_id) return
    setLoading(true)
    void (async () => {
      try {
        const words = await api.session.qcWords(session_id)
        if (!active) return
        setQcWords(words)
        setError(null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load QC words')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [session_id])

  // Socket + polling fallback for live vote updates
  useEffect(() => {
    if (!session_id) return

    const startPoll = () => {
      if (pollRef.current || socketConnectedRef.current) return
      void refreshStatus()
      pollRef.current = setInterval(() => void refreshStatus(), 2000)
    }

    const stopPoll = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }

    if (!options.auth) {
      startPoll()
      return () => stopPoll()
    }

    const socket = createSocket(options.auth)

    socket.on('connect', () => {
      socketConnectedRef.current = true
      stopPoll()
      setError(null)
    })

    socket.on('disconnect', () => {
      socketConnectedRef.current = false
      startPoll()
    })

    socket.on('connect_error', (err: Error) => {
      setError(err.message)
      startPoll()
    })

    // Server sends { status } only — re-fetch for full session object
    socket.on('session:status', () => {
      void refreshStatus()
    })

    socket.on('qc:vote', (ev: QcVoteEvent) => {
      setQcWords((words) => words.map((w) => {
        if (w.token_id !== ev.token_id) return w
        return {
          ...w,
          vote_orthography: ev.vote_counts.orthography,
          vote_semantics: ev.vote_counts.semantics,
          vote_audio: ev.vote_counts.audio,
        }
      }))
    })

    // { token_id, correction_needed?: true } OR { token_id, corrected?: true }
    socket.on('qc:correction', (ev: QcTokenIdEvent & { correction_needed?: boolean; corrected?: boolean }) => {
      if (ev.corrected) {
        void refreshQcWords()
      }
    })

    // { token_id } only — re-fetch to get updated qc_translations list
    socket.on('qc:translation', () => {
      void refreshQcWords()
    })

    // { token_id } only — re-fetch to get yahura_transcription + audio vote counts
    socket.on('qc:audio-ready', () => {
      void refreshQcWords()
    })

    // Fallback poll until socket connects
    startPoll()

    return () => {
      socket.disconnect()
      stopPoll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id, JSON.stringify(options.auth), refreshStatus, refreshQcWords])

  const currentToken = useMemo(
    () => qcWords[currentIndex] ?? null,
    [currentIndex, qcWords],
  )

  return {
    qcWords,
    currentIndex,
    currentToken,
    session,
    loading,
    error,
    setCurrentIndex,
    refreshStatus,
  }
}
