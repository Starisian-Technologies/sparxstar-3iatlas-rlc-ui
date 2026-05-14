import { queueEvent } from './offlineQueue'
import { RlcEventType } from './rlcEventTypes'

export { RlcEventType }
export type { RlcEvent } from './rlcEventTypes'

export const SPX_RUNTIME_EVENT = 'spx:runtime-event'
const MAX_RUNTIME_EVENTS = 50

export type RuntimeEventType =
  | 'SESSION_JOINED'
  | 'ROUND_STARTED'
  | 'WORD_SUBMITTED'
  | 'AUDIO_CAPTURED'
  | 'QC_REVIEWED'
  | 'CEREMONY_ENTERED'
  | 'AWARD_REVEALED'
  | 'ABILITY_INVOKED'

export interface RuntimeEventDetail {
  type: RuntimeEventType
  occurredAt: number
  sessionId?: string | null
  participantId?: string | null
  screen?: string | null
  mode?: string | null
  metadata?: Record<string, unknown>
}

declare global {
  interface Window {
    __SPX_RUNTIME_EVENTS__?: RuntimeEventDetail[]
  }
}

export function emitRuntimeEvent(
  type: RuntimeEventType,
  detail: Omit<RuntimeEventDetail, 'type' | 'occurredAt'> = {},
): RuntimeEventDetail {
  const payload: RuntimeEventDetail = {
    type,
    occurredAt: Date.now(),
    ...detail,
  }

  if (typeof window !== 'undefined') {
    const previousEvents = window.__SPX_RUNTIME_EVENTS__ ?? []
    previousEvents.push(payload)
    if (previousEvents.length > MAX_RUNTIME_EVENTS) {
      previousEvents.splice(0, previousEvents.length - MAX_RUNTIME_EVENTS)
    }
    window.__SPX_RUNTIME_EVENTS__ = previousEvents
    window.dispatchEvent(new CustomEvent<RuntimeEventDetail>(SPX_RUNTIME_EVENT, { detail: payload }))
  }

  return payload
}

/**
 * Emit a canonical RLC runtime event (spec §13) and queue it in IndexedDB
 * for eventual flush to the server via POST /events/batch (spec §7.4).
 *
 * This is separate from `emitRuntimeEvent` which is an internal UI bus.
 * Use this for all domain events that must reach the server event log.
 */
export function emitRlcEvent(
  eventType:     RlcEventType,
  sessionId:     string,
  participantId: string,
  payload:       Record<string, unknown> = {},
): void {
  // Fire-and-forget — failures are silent; the queue retries on reconnect.
  void queueEvent(eventType, sessionId, participantId, payload)
}
