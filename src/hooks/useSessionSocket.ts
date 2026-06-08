/**
 * useSessionSocket — real-time session state via socket.io.
 *
 * Strategy:
 *  1. Connect socket immediately.
 *  2. Start a REST poll as a fallback from the start (5s).
 *  3. When the socket connects successfully, cancel the poll.
 *  4. If the socket disconnects, restart the poll until socket reconnects.
 *  5. `session:status` event from server is `{ status }` only — UI re-fetches
 *     the full SessionStatusResponse and merges with join-time metadata into
 *     a UI Session view.
 *  6. Emit `heartbeat` every 10s while connected (contract §4.2).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { createSocket, type SocketAuth } from '@/runtime/socket'
import { mergeSessionStatus } from './sessionView'
import type { Session } from '@/types'

const FALLBACK_POLL_MS = 5000
const HEARTBEAT_MS = 10_000

interface UseSessionSocketOptions {
  auth?: SocketAuth | null
  /** Metadata captured at join/create time (mode/language/etc) that's not on the wire status. */
  initialMeta?: Partial<Session>
}

export function useSessionSocket(
  session_id: string | null,
  enabled = true,
  options: UseSessionSocketOptions = {},
) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const sessionIdRef = useRef(session_id)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ref so we don't restart the effect every time meta changes.
  const metaRef = useRef(options.initialMeta)
  metaRef.current = options.initialMeta

  sessionIdRef.current = session_id

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const fetchOnce = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const status = await api.session.status(sid)
      setSession((prev) => mergeSessionStatus(sid, status, metaRef.current, prev))
      setError(null)
    } catch (err) {
      // Surface poll failures so screens that read `error` (LobbyScreen's
      // ContinuityBanner, etc.) can show the connection banner instead of
      // silently presenting stale state as healthy.
      setError(err instanceof Error ? err.message : 'Could not refresh session')
    }
  }, [])

  const startPoll = useCallback(() => {
    if (pollRef.current) return
    void fetchOnce()
    pollRef.current = setInterval(() => { void fetchOnce() }, FALLBACK_POLL_MS)
  }, [fetchOnce])

  useEffect(() => {
    if (!enabled || !session_id) return
    if (!options.auth) {
      startPoll()
      return () => stopPoll()
    }

    const socket = createSocket(options.auth)

    socket.on('connect', () => {
      setConnected(true)
      setError(null)
      stopPoll()
      // Start heartbeat
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      heartbeatRef.current = setInterval(() => { socket.emit('heartbeat') }, HEARTBEAT_MS)
    })

    socket.on('disconnect', () => {
      setConnected(false)
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null }
      startPoll()
    })

    socket.on('connect_error', (err: Error) => {
      setError(err.message)
      startPoll()
    })

    // Server sends { status } only — re-fetch and merge
    socket.on('session:status', () => { void fetchOnce() })

    // Start poll immediately as fallback; socket.on('connect') will cancel it
    startPoll()

    return () => {
      socket.disconnect()
      stopPoll()
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id, enabled, JSON.stringify(options.auth), startPoll, stopPoll, fetchOnce])

  return { session, error, connected }
}
