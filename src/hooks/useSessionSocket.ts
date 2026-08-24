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
 *  7. Handle the remaining live session events. Five of these were previously
 *     emitted by the engine and listened to by nobody: `token:submitted`,
 *     `saturation:signal`, `session:joined`, `session:left`, and
 *     `screentime:limit-reached`. See runtime/serverEvents.ts for the full
 *     inventory and each event's disposition.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { createSocket, type SocketAuth } from '@/runtime/socket'
import { bindServerEvents } from '@/runtime/serverEvents'
import { mergeSessionStatus } from './sessionView'
import type { Session } from '@/types'
import type { ServerToClientEvents } from '@/contract'

type TokenSubmittedEvent = Parameters<ServerToClientEvents['token:submitted']>[0]
type SaturationEvent = Parameters<ServerToClientEvents['saturation:signal']>[0]
type ScreentimeEvent = Parameters<ServerToClientEvents['screentime:limit-reached']>[0]
type JoinedEvent = Parameters<ServerToClientEvents['session:joined']>[0]
type LeftEvent = Parameters<ServerToClientEvents['session:left']>[0]

/** A live presence row for the teacher monitor. */
export interface PresenceEvent {
  participant_id: string
  screen_name: string
  at: number
}

/**
 * Why a student's collection stopped. Surfaced so a screen can say something
 * true instead of failing a save with a generic error.
 *
 * NOTE ON SCOPE: this reports what the SERVER told us. Daily screen-time
 * accounting itself is not enforced end to end yet — the engine's quota client
 * is a labelled development stub — so absence of this signal does not mean a
 * limit was respected. See the engine's DEPLOY.md.
 */
export interface CollectionHalt {
  reason: 'screentime'
  participant_id: string | null
  reset_at: number | null
}

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
  /** Latest XP for this participant, from `token:submitted`. */
  const [xp, setXp] = useState<number | null>(null)
  /** Set when the server says a submitted word is saturated. Cleared by the screen. */
  const [saturatedTokenId, setSaturatedTokenId] = useState<string | null>(null)
  /** Set when the server halts collection for this student. */
  const [halt, setHalt] = useState<CollectionHalt | null>(null)
  /** Teacher monitor: the most recent join/leave, for a live feed. */
  const [lastJoined, setLastJoined] = useState<PresenceEvent | null>(null)
  const [lastLeft, setLastLeft] = useState<PresenceEvent | null>(null)

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

    const { unbind } = bindServerEvents(socket, {
      // Server sends { status } only — re-fetch and merge.
      'session:status': () => void fetchOnce(),

      /**
       * A submission landed. Carries the submitter's XP, which is why the client
       * never computes XP itself (contract §7.2).
       */
      'token:submitted': (ev: TokenSubmittedEvent) => {
        // The wire field is `account_lifetime_xp` — the server's number, which
        // the client displays and never recomputes (contract §7.2).
        if (typeof ev.account_lifetime_xp === 'number') setXp(ev.account_lifetime_xp)
        // The feed and counts live on the session status object.
        void fetchOnce()
      },

      /**
       * This word has been submitted enough times. The student is asked for a
       * different one — a redirect, never a rejection (spec §1.4: never block,
       * always flag). Previously unheard, so a saturated word looked accepted.
       */
      'saturation:signal': (ev: SaturationEvent) => {
        setSaturatedTokenId(ev.token_id)
      },

      /**
       * The student's daily screen-time is spent. The session stays open for the
       * class; this student stops collecting. Previously unheard on the client,
       * so the engine's 451 arrived as an unexplained save failure.
       */
      'screentime:limit-reached': (ev: ScreentimeEvent) => {
        setHalt({ reason: 'screentime', participant_id: ev.participant_id, reset_at: ev.reset_at })
      },

      'session:joined': (ev: JoinedEvent) => {
        setLastJoined({ participant_id: ev.participant_id, screen_name: ev.screen_name, at: Date.now() })
        void fetchOnce()
      },

      'session:left': (ev: LeftEvent) => {
        setLastLeft({ participant_id: ev.participant_id, screen_name: ev.screen_name, at: Date.now() })
        void fetchOnce()
      }
    })

    // Start poll immediately as fallback; socket.on('connect') will cancel it
    startPoll()

    return () => {
      unbind()
      socket.disconnect()
      stopPoll()
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id, enabled, JSON.stringify(options.auth), startPoll, stopPoll, fetchOnce])

  return {
    session,
    error,
    connected,
    xp,
    saturatedTokenId,
    /** Clear the saturation prompt once the screen has shown it. */
    clearSaturation: () => setSaturatedTokenId(null),
    halt,
    lastJoined,
    lastLeft
  }
}
