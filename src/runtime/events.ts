export const SPX_RUNTIME_EVENT = 'spx:runtime-event'

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
    window.__SPX_RUNTIME_EVENTS__ = [...previousEvents, payload].slice(-50)
    window.dispatchEvent(new CustomEvent<RuntimeEventDetail>(SPX_RUNTIME_EVENT, { detail: payload }))
  }

  return payload
}
