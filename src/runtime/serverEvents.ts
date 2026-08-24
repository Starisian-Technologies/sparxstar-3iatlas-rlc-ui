import type { Socket } from 'socket.io-client'
import type { ServerToClientEvents } from '@/contract'

/**
 * THE SERVER EVENT INVENTORY — all 13 events the engine emits, and what this
 * client does about each one.
 *
 * This file exists because the previous failure was silent: the engine emitted
 * `qc:token` and `ceremony:star` and nothing listened, so the teacher's Advance
 * moved nobody and every browser animated its own ceremony. Nothing in the code
 * said which events mattered, so nothing showed that seven of thirteen were on
 * the floor.
 *
 * Every event now has one of three dispositions, stated below and enforced by
 * `EVENT_DISPOSITION` — which is exercised by a test that fails if the engine's
 * contract grows an event this file has not classified.
 *
 * | Event                      | Disposition | What this client does                                    |
 * | :------------------------- | :---------- | :------------------------------------------------------- |
 * | `qc:token`                 | handled     | AUTHORITATIVE current QC token. Applied only when `seq`  |
 * |                            |             | exceeds the last applied, so duplicate/stale/out-of-order|
 * |                            |             | delivery can never move a client backward.               |
 * | `qc:vote`                  | handled     | Merge live vote tallies into the displayed token.        |
 * | `qc:correction`            | handled     | Re-read the token list when a correction landed.         |
 * | `qc:translation`           | handled     | Re-read to pick up the new translation.                  |
 * | `qc:audio-ready`           | handled     | Re-read to pick up the transcription + audio tallies.    |
 * | `session:status`           | handled     | Re-fetch full status; drives phase transitions.          |
 * | `token:submitted`          | handled     | Update the submitter's XP counter and the live feed.     |
 * | `saturation:signal`        | handled     | Tell the student this word is saturated; prompt another. |
 * | `ceremony:star`            | handled     | Render the server's star, in the server's order.        |
 * | `ceremony:end`             | handled     | AUTHORITATIVE end of ceremony. Transitions out.         |
 * | `session:joined`           | handled     | Teacher monitor: participant appeared.                   |
 * | `session:left`             | handled     | Teacher monitor: participant dropped.                    |
 * | `screentime:limit-reached` | handled     | Stop collection for that student; notify the teacher.    |
 *
 * Nothing is currently in the "intentionally ignored" or "reserved" categories:
 * all 13 are handled. The categories exist because a future event will land
 * before its feature does, and the honest thing then is to say so here rather
 * than let it fall on the floor unnoticed.
 *
 * SAFETY. `bindServerEvents` wraps every handler so a malformed payload logs and
 * is dropped rather than taking down the screen, and an UNKNOWN event is counted
 * and ignored. A client must never crash because the server learned a new word.
 */

/** How this client treats an event the engine can emit. */
export type Disposition =
  /** A handler exists and the event drives real UI state. */
  | 'handled'
  /** Deliberately not acted on. The reason is recorded alongside. */
  | 'ignored'
  /** A feature not built yet. Received, tolerated, and dropped. */
  | 'reserved'

export interface EventEntry {
  disposition: Disposition
  /** Why — required for `ignored`/`reserved`, so a gap can never be silent. */
  note: string
}

/**
 * Every event in `ServerToClientEvents`, classified. Keyed by the contract type,
 * so adding an event to the contract without classifying it fails typecheck.
 */
export const EVENT_DISPOSITION: Record<keyof ServerToClientEvents, EventEntry> = {
  'qc:token': {
    disposition: 'handled',
    note: 'Authoritative current QC token; applied by ascending seq only.'
  },
  'qc:vote': { disposition: 'handled', note: 'Live vote tallies for the displayed token.' },
  'qc:correction': { disposition: 'handled', note: 'Re-read tokens so the correction shows.' },
  'qc:translation': { disposition: 'handled', note: 'Re-read tokens for the new translation.' },
  'qc:audio-ready': { disposition: 'handled', note: 'Re-read for transcription and audio tallies.' },
  'session:status': { disposition: 'handled', note: 'Re-fetch status; drives phase transitions.' },
  'token:submitted': { disposition: 'handled', note: 'XP counter and the teacher submission feed.' },
  'saturation:signal': { disposition: 'handled', note: 'Prompt the student for a different word.' },
  'ceremony:star': { disposition: 'handled', note: 'Render in server order; idempotent by star kind.' },
  'ceremony:end': { disposition: 'handled', note: 'Authoritative end of the ceremony.' },
  'session:joined': { disposition: 'handled', note: 'Teacher monitor presence.' },
  'session:left': { disposition: 'handled', note: 'Teacher monitor presence.' },
  'screentime:limit-reached': {
    disposition: 'handled',
    note: 'Stop collection for that student and notify the teacher.'
  }
}

/** The event names this client knows about. */
export const KNOWN_EVENTS = Object.keys(EVENT_DISPOSITION) as Array<keyof ServerToClientEvents>

/**
 * Socket.io's own lifecycle events. Not game events, and not this module's
 * business — but they must not be reported as "unknown", or every connection
 * would look like a protocol violation.
 */
const TRANSPORT_EVENTS = new Set([
  'connect',
  'connecting',
  'disconnect',
  'connect_error',
  'error',
  'reconnect',
  'reconnect_attempt',
  'reconnect_error',
  'reconnect_failed',
  'ping',
  'pong'
])

/** Diagnostics for unknown traffic — read by tests and dev tooling. */
export interface UnknownEventRecord {
  event: string
  count: number
}

type HandlerMap = {
  [K in keyof ServerToClientEvents]?: (
    ...args: Parameters<ServerToClientEvents[K]>
  ) => void
}

export interface BindOptions {
  /** Called once per distinct unknown event name. Defaults to a console warning. */
  onUnknown?: (event: string) => void
}

/**
 * Attach handlers for known events, safely.
 *
 * Two guarantees, both of which the previous ad-hoc `socket.on(...)` calls
 * lacked:
 *
 *  1. A THROWING HANDLER CANNOT TAKE DOWN THE SCREEN. Each handler runs inside
 *     a try/catch. A malformed payload — a field the server renamed, a null
 *     where an object was expected — logs and is dropped. Losing one update is
 *     recoverable; an unmounted React tree mid-session is not.
 *
 *  2. AN UNKNOWN EVENT IS TOLERATED. A newer server emitting an event this build
 *     has never heard of is normal during a rollout. It is counted and ignored,
 *     never thrown.
 *
 * Returns an unbind function; call it on cleanup so a reconnect does not stack
 * duplicate listeners (which would double-apply every event).
 */
export function bindServerEvents(
  socket: Socket,
  handlers: HandlerMap,
  options: BindOptions = {}
): { unbind: () => void; unknown: () => UnknownEventRecord[] } {
  const unknownCounts = new Map<string, number>()
  const attached: Array<[string, (...args: unknown[]) => void]> = []

  for (const [event, handler] of Object.entries(handlers)) {
    if (!handler) continue
    const safe = (...args: unknown[]): void => {
      try {
        ;(handler as (...a: unknown[]) => void)(...args)
      } catch (err) {
        // Deliberately swallowed. See guarantee 1 above.
        console.warn(`[serverEvents] handler for "${event}" threw; dropping this event.`, err)
      }
    }
    socket.on(event, safe)
    attached.push([event, safe])
  }

  const anyListener = (event: string): void => {
    if (TRANSPORT_EVENTS.has(event)) return
    if ((KNOWN_EVENTS as string[]).includes(event)) return
    const next = (unknownCounts.get(event) ?? 0) + 1
    unknownCounts.set(event, next)
    // Report each name once: a chatty unknown event should not flood the console.
    if (next === 1) {
      if (options.onUnknown) options.onUnknown(event)
      else console.info(`[serverEvents] ignoring unknown server event "${event}".`)
    }
  }
  socket.onAny(anyListener)

  return {
    unbind: () => {
      for (const [event, safe] of attached) socket.off(event, safe)
      socket.offAny(anyListener)
    },
    unknown: () => [...unknownCounts.entries()].map(([event, count]) => ({ event, count }))
  }
}

/**
 * Should a `qc:token` event be applied?
 *
 * The ordering rule in one place, because it is the rule that stops drift: apply
 * only a STRICTLY higher sequence. A repeat of the current position is a
 * duplicate delivery; a lower one is a late delivery of a position the class has
 * already left. Both must be dropped, and neither is an error.
 */
export function shouldApplyQcSeq(incoming: number, lastApplied: number): boolean {
  return Number.isFinite(incoming) && incoming > lastApplied
}
