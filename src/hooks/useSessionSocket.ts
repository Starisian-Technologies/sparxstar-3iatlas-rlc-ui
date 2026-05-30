/**
 * useSessionSocket — real-time session state via socket.io.
 *
 * Drop-in replacement for useSessionPoll: exposes the same `{ session, error }`
 * interface so call-sites only need their import changed.
 *
 * Strategy:
 *  1. Connect socket immediately.
 *  2. Start a REST poll as a fallback from the start — cheap, one call every 5s.
 *  3. When the socket connects successfully, cancel the poll.
 *  4. If the socket disconnects, restart the poll until socket reconnects.
 *
 * The poll interval intentionally drops from 2s → 5s because the socket now
 * delivers updates in real-time; polling is only a safety net.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { createSocket, type SocketAuth } from '@/runtime/socket'
import type { Session } from '@/types'

const FALLBACK_POLL_MS = 5000

interface UseSessionSocketOptions {
  auth?: SocketAuth | null
}

export function useSessionSocket(
  session_id: string | null,
  enabled = true,
  options: UseSessionSocketOptions = {},
) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  // Stable refs so effect callbacks don't stale-close over old values
  const sessionIdRef = useRef(session_id)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  sessionIdRef.current = session_id

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPoll = useCallback(() => {
    if (pollRef.current) return
    const sid = sessionIdRef.current
    if (!sid) return
    void api.session.status(sid).then(setSession).catch(() => {})
    pollRef.current = setInterval(() => {
      const id = sessionIdRef.current
      if (!id) return
      void api.session.status(id).then(setSession).catch(() => {})
    }, FALLBACK_POLL_MS)
  }, [])

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
    })

    socket.on('disconnect', () => {
      setConnected(false)
      startPoll()
    })

    socket.on('connect_error', (err: Error) => {
      setError(err.message)
      startPoll()
    })

    socket.on('session:status', (data: Session) => {
      setSession(data)
      setError(null)
    })

    // Start poll immediately as fallback; socket.on('connect') will cancel it
    startPoll()

    return () => {
      socket.disconnect()
      stopPoll()
    }
    // auth is derived from tokens that change at most once (join → token issued);
    // stringify gives a stable dep without deep-equal logic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id, enabled, JSON.stringify(options.auth), startPoll, stopPoll])

  return { session, error, connected }
}
