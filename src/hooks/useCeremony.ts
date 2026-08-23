/**
 * useCeremony — the ceremony, driven by the server.
 *
 * WHAT THIS REPLACED, AND WHY. The ceremony screen used to fetch the award list
 * over REST, sort it against a hardcoded order, and reveal one star every 1.5s
 * on a local `setInterval`. `ceremony:star` and `ceremony:end` were emitted by
 * the engine and listened to by nobody. So thirty students in one room watched
 * thirty independently timed ceremonies, each starting whenever its own fetch
 * happened to return — for the one phase of the game whose entire purpose is a
 * room reacting together.
 *
 * THE MODEL NOW:
 *
 *   order      comes from `seq` on each `ceremony:star`. The server emits in the
 *              game manifest's declared ceremony order; the client renders that
 *              order and computes none of its own.
 *   end        comes from `ceremony:end`. A timer may still drive ANIMATION, but
 *              it no longer decides that the ceremony is over.
 *   idempotent stars are keyed by kind, so a duplicate delivery (a reconnect
 *              replaying, a retried run) re-renders the same award instead of
 *              announcing it twice.
 *   fallback   REST hydration still runs, because a client that connects AFTER
 *              the run finished never receives the events at all. It fills in
 *              what was missed and is marked as such.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import { createSocket, type SocketAuth } from '@/runtime/socket'
import { bindServerEvents } from '@/runtime/serverEvents'
import type { AwardsResponse, CeremonyStarEvent, ServerToClientEvents, Star, StarKind } from '@/contract'

type CeremonyEndEvent = Parameters<ServerToClientEvents['ceremony:end']>[0]

/** A star as the client holds it: the award plus where the server put it. */
export interface RevealedStar extends Star {
  /** Server-defined position in the run. Null for an out-of-sequence announcement. */
  seq: number | null
}

export interface UseCeremonyResult {
  /** Stars to display, in the server's order. */
  stars: RevealedStar[]
  /** Awards payload for the leaderboard. Null until hydration completes. */
  awards: AwardsResponse | null
  /** How many stars the server says the run contains, once known. */
  total: number | null
  /** True once `ceremony:end` has arrived, or the session is already finished. */
  finished: boolean
  /** True when stars came from REST because the events were missed. */
  hydratedFromRest: boolean
  loading: boolean
  error: string | null
}

interface UseCeremonyOptions {
  auth?: SocketAuth | null
  /** Session status at mount. A ceremony already over needs REST, not events. */
  alreadyComplete?: boolean
}

export function useCeremony(session_id: string | null, options: UseCeremonyOptions = {}): UseCeremonyResult {
  const [awards, setAwards] = useState<AwardsResponse | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const [hydratedFromRest, setHydratedFromRest] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Stars keyed by kind — this map IS the idempotency.
   *
   * A duplicate `ceremony:star` for a kind already present overwrites its own
   * entry rather than appending, so an award can never be announced twice. Keyed
   * by kind and not by `seq` because the out-of-sequence teacher-star
   * announcement carries `seq: null`, and the numbered run re-emits that same
   * star later; both must resolve to one entry.
   */
  const [starsByKind, setStarsByKind] = useState<Record<string, RevealedStar>>({})

  const sessionIdRef = useRef(session_id)
  sessionIdRef.current = session_id

  const hydrate = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const result = await api.session.awards(sid)
      setAwards(result)
      setError(null)
      return result
    } catch {
      setError('Could not load awards.')
      return null
    }
  }, [])

  // Leaderboard and (when needed) the star list come from REST.
  useEffect(() => {
    let active = true
    if (!session_id) return
    setLoading(true)
    setStarsByKind({})
    setFinished(false)
    setHydratedFromRest(false)
    setTotal(null)
    void (async () => {
      const result = await hydrate()
      if (!active || !result) {
        if (active) setLoading(false)
        return
      }
      /**
       * If the ceremony has already finished, the events are gone — socket.io
       * does not replay them — so the REST list is the only way to show the
       * awards at all. Seed from it, and mark that we did: the reveal animation
       * is meaningless for a ceremony that happened before this client arrived.
       */
      if (options.alreadyComplete) {
        const seeded: Record<string, RevealedStar> = {}
        result.stars.forEach((star, index) => {
          seeded[star.star] = { ...star, seq: index }
        })
        setStarsByKind(seeded)
        setTotal(result.stars.length)
        setFinished(true)
        setHydratedFromRest(true)
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [session_id, hydrate, options.alreadyComplete])

  useEffect(() => {
    if (!session_id || !options.auth) return
    const socket = createSocket(options.auth)

    const { unbind } = bindServerEvents(socket, {
      'ceremony:star': (ev: CeremonyStarEvent) => {
        // Idempotent by construction: same kind, same slot.
        setStarsByKind((prev) => ({
          ...prev,
          [ev.star]: {
            star: ev.star as StarKind,
            participant_ids: ev.participant_ids,
            screen_names: ev.screen_names,
            xp_awarded: ev.xp_awarded,
            seq: ev.seq
          }
        }))
        // Only a numbered event says anything about the run's length. The
        // teacher-star announcement (seq null) must not set it.
        if (typeof ev.total === 'number') setTotal(ev.total)
      },

      'ceremony:end': (ev: CeremonyEndEvent) => {
        // The authoritative end. Not a timer, not a count of what we happened to
        // receive — this event, and nothing else, finishes the ceremony.
        setFinished(true)
        if (typeof ev.stars_total === 'number') setTotal(ev.stars_total)
        // Refresh the leaderboard, which the events do not carry.
        void hydrate()
      }
    })

    // A late joiner or reconnect may have missed stars. Re-read the awards so
    // the display is complete; ordering still comes from the server's list.
    socket.on('connect', () => {
      void hydrate()
    })

    return () => {
      unbind()
      socket.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id, JSON.stringify(options.auth), hydrate])

  /**
   * Ordered for display: numbered stars first, by `seq`; then any
   * out-of-sequence announcement, which is a live acknowledgement rather than a
   * step in the run.
   */
  const stars = useMemo(() => {
    const all = Object.values(starsByKind)
    const numbered = all.filter((s) => typeof s.seq === 'number').sort((a, b) => (a.seq as number) - (b.seq as number))
    const unnumbered = all.filter((s) => s.seq === null)
    return [...numbered, ...unnumbered]
  }, [starsByKind])

  return { stars, awards, total, finished, hydratedFromRest, loading, error }
}
