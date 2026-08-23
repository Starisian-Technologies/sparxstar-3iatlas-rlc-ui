/**
 * useQcSession — the QC phase, server-authoritative.
 *
 * WHAT THIS REPLACED, AND WHY. This hook used to fetch the ordered QC list once
 * and hand the screen a `currentIndex` it advanced locally. Nothing listened for
 * `qc:token`. The consequences were exactly what you would expect and nobody had
 * noticed: the teacher's Advance button moved no students, and thirty browsers
 * walked the list at thirty different speeds. QC is a class voting on one word
 * together; that is not a thing thirty independent cursors can do.
 *
 * THE MODEL NOW. The server holds one current token per session plus a monotonic
 * `seq`. This hook has no cursor of its own:
 *
 *   hydrate    GET /session/:id/qc-state on mount, and again on every reconnect.
 *              A client that reloads mid-QC lands where the class is.
 *   follow     `qc:token` carries the next position. Applied ONLY when its `seq`
 *              exceeds the last applied, so a duplicated, delayed, or reordered
 *              delivery can never move anyone backward.
 *   never lead  There is no local advance. The screen cannot move itself, and
 *              the engine exposes no student-facing advance to move it with.
 *
 * REST still has a job — hydration, reconnection, and enriching the live tallies
 * — but it is no longer a competing source of progression. The ordered list is
 * kept for context (the teacher's overview, "n of m"), never as a cursor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import { createSocket, type SocketAuth } from '@/runtime/socket'
import { bindServerEvents, shouldApplyQcSeq } from '@/runtime/serverEvents'
import { mergeSessionStatus } from './sessionView'
import type { QcToken, Session } from '@/types'
import type { ServerToClientEvents } from '@/contract'

const FALLBACK_POLL_MS = 2000

interface UseQcSessionOptions {
  auth?: SocketAuth | null
  initialMeta?: Partial<Session>
}

interface UseQcSessionResult {
  /** The ordered QC list — context only. Never a cursor. */
  qcWords: QcToken[]
  /** The token the whole class is on, per the server. Null before the first advance. */
  currentToken: QcToken | null
  /** The server's advance sequence for `currentToken`. 0 before the first advance. */
  seq: number
  /** True once the teacher has advanced through everything selectable. */
  exhausted: boolean
  /** True while the class is waiting for the teacher's first advance. */
  awaitingTeacher: boolean
  /** 1-based position of the current token in the ordered list, for display. */
  position: number
  session: Session | null
  loading: boolean
  error: string | null
  /** Re-read the authoritative position. Used on reconnect; advances nothing. */
  hydrate: () => Promise<void>
  refreshStatus: () => Promise<void>
}

type QcVoteEvent = Parameters<ServerToClientEvents['qc:vote']>[0]
type QcTokenEvent = Parameters<ServerToClientEvents['qc:token']>[0]

export function useQcSession(
  session_id: string | null,
  options: UseQcSessionOptions = {}
): UseQcSessionResult {
  const [qcWords, setQcWords] = useState<QcToken[]>([])
  const [currentToken, setCurrentToken] = useState<QcToken | null>(null)
  const [seq, setSeq] = useState(0)
  const [exhausted, setExhausted] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const socketConnectedRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef(session_id)
  sessionIdRef.current = session_id
  const metaRef = useRef(options.initialMeta)
  metaRef.current = options.initialMeta
  /**
   * The participant token, when this client is a student.
   *
   * The three session reads now require a credential — they serve decrypted
   * writing — so a student passes their participant token and a teacher falls
   * back to the injected Identity token inside `sessionReadHeaders`. A teacher's
   * socket auth carries `role: 'teacher'` and no participant token, which is
   * exactly the discriminator.
   */
  const readTokenRef = useRef<string | null>(null)
  readTokenRef.current =
    options.auth && !('role' in options.auth) ? (options.auth as { token: string }).token : null
  /**
   * The last sequence actually applied. A ref, not state: the ordering decision
   * happens inside an event handler that must see the newest value immediately,
   * and a state read there would see the value from its own render.
   */
  const appliedSeqRef = useRef(0)

  const refreshStatus = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const status = await api.session.status(sid)
      setSession((prev) => mergeSessionStatus(sid, status, metaRef.current, prev))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh QC status')
    }
  }, [])

  const refreshQcWords = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      setQcWords(await api.session.qcWords(sid, readTokenRef.current))
    } catch {
      // Best-effort: this list is context, so keeping a slightly stale copy is
      // better than blanking the screen.
    }
  }, [])

  /**
   * Read the authoritative position from the server.
   *
   * Guarded by the same sequence rule the socket path uses: if a `qc:token`
   * event arrived while this request was in flight and is newer, the fetched
   * (older) state must not clobber it. Without that guard, a slow hydration
   * response would drag a client backward — which is the very drift this hook
   * exists to prevent, reintroduced through the back door.
   */
  const hydrate = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const state = await api.session.qcState(sid, readTokenRef.current)
      setExhausted(state.exhausted)
      if (state.seq >= appliedSeqRef.current) {
        appliedSeqRef.current = state.seq
        setSeq(state.seq)
        setCurrentToken(state.token)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the current QC position')
    }
  }, [])

  // Initial load: the ordered list for context, and the authoritative position.
  useEffect(() => {
    let active = true
    if (!session_id) return
    setLoading(true)
    // A new session means a new cursor space; do not carry a sequence across.
    appliedSeqRef.current = 0
    setSeq(0)
    setCurrentToken(null)
    void (async () => {
      try {
        const [words] = await Promise.all([api.session.qcWords(session_id, readTokenRef.current), hydrate()])
        if (!active) return
        setQcWords(words)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load QC words')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [session_id, hydrate])

  useEffect(() => {
    if (!session_id) return

    const startPoll = () => {
      if (pollRef.current || socketConnectedRef.current) return
      void refreshStatus()
      pollRef.current = setInterval(() => {
        void refreshStatus()
        // While the socket is down, the position is polled too — otherwise a
        // student who dropped mid-QC would sit on a stale token until the socket
        // came back. Still a read: it follows the server, never leads it.
        void hydrate()
      }, FALLBACK_POLL_MS)
    }

    const stopPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    if (!options.auth) {
      startPoll()
      return () => stopPoll()
    }

    const socket = createSocket(options.auth)

    const { unbind } = bindServerEvents(socket, {
      /**
       * The authoritative position. The whole class receives this one payload.
       */
      'qc:token': (ev: QcTokenEvent) => {
        if (!shouldApplyQcSeq(ev.seq, appliedSeqRef.current)) return
        appliedSeqRef.current = ev.seq
        setSeq(ev.seq)
        setCurrentToken({
          token_id: ev.token_id,
          text: ev.text,
          translation: '',
          yahura_transcription: ev.yahura_transcription,
          yahura_confidence: ev.yahura_confidence,
          grammar_domain: ev.grammar_domain,
          spelling_signal: null,
          completeness_signal: 'partial',
          vote_orthography: ev.vote_orthography,
          vote_semantics: ev.vote_semantics,
          vote_audio: ev.vote_audio,
          qc_translations: []
        } as QcToken)
        // The event carries the token but not its translation history; pick that
        // up from the list, which is a read and cannot move the position.
        void refreshQcWords()
      },

      'qc:vote': (ev: QcVoteEvent) => {
        const apply = (t: QcToken): QcToken =>
          t.token_id === ev.token_id
            ? {
                ...t,
                vote_orthography: ev.vote_counts.orthography,
                vote_semantics: ev.vote_counts.semantics,
                vote_audio: ev.vote_counts.audio
              }
            : t
        setQcWords((words) => words.map(apply))
        setCurrentToken((t) => (t ? apply(t) : t))
      },

      'qc:correction': () => void refreshQcWords(),
      'qc:translation': () => void refreshQcWords(),
      'qc:audio-ready': () => void refreshQcWords(),
      'session:status': () => void refreshStatus()
    })

    socket.on('connect', () => {
      socketConnectedRef.current = true
      stopPoll()
      setError(null)
      // A reconnect is exactly when a client is most likely to be behind: the
      // teacher may have advanced while it was away, and socket.io does not
      // replay what it missed. Re-read the position on every connect, including
      // the first.
      void hydrate()
      void refreshQcWords()
    })

    socket.on('disconnect', () => {
      socketConnectedRef.current = false
      startPoll()
    })

    socket.on('connect_error', (err: Error) => {
      setError(err.message)
      startPoll()
    })

    startPoll()

    return () => {
      unbind()
      socket.disconnect()
      stopPoll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id, JSON.stringify(options.auth), refreshStatus, refreshQcWords, hydrate])

  /** Position within the ordered list, for display only ("n of m"). */
  const position = useMemo(() => {
    if (!currentToken) return 0
    const index = qcWords.findIndex((w) => w.token_id === currentToken.token_id)
    // Fall back to the sequence when the token has dropped out of selection —
    // better a slightly optimistic counter than a jarring 0 of 10.
    return index >= 0 ? index + 1 : seq
  }, [qcWords, currentToken, seq])

  return {
    qcWords,
    currentToken,
    seq,
    exhausted,
    awaitingTeacher: currentToken === null && !exhausted,
    session,
    loading,
    error,
    position,
    hydrate,
    refreshStatus
  }
}
