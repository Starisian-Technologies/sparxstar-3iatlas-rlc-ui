/**
 * Canonical RLC runtime event types — spec §13.1.
 *
 * These are the formal contract events that are queued locally (IndexedDB)
 * and flushed to the server via POST /events/batch (spec §7.4).
 *
 * In the full monorepo this enum lives in packages/shared/src/events.ts.
 * Here it is the client-side definition and is the single source of truth
 * for this repo.
 */
export enum RlcEventType {
  // Session lifecycle
  RLC_SESSION_STARTED         = 'RLC_SESSION_STARTED',
  RLC_SESSION_CLOSED          = 'RLC_SESSION_CLOSED',
  RLC_PARTICIPANT_JOINED      = 'RLC_PARTICIPANT_JOINED',
  RLC_PARTICIPANT_RECONNECTED = 'RLC_PARTICIPANT_RECONNECTED',

  // Collection phase
  RLC_WORD_CAPTURED           = 'RLC_WORD_CAPTURED',
  RLC_SENTENCE_CAPTURED       = 'RLC_SENTENCE_CAPTURED',
  RLC_AUDIO_ATTACHED          = 'RLC_AUDIO_ATTACHED',
  RLC_TRANSLATION_ADDED       = 'RLC_TRANSLATION_ADDED',
  RLC_SUBMISSION_SAVED        = 'RLC_SUBMISSION_SAVED',

  // QC phase
  RLC_QC_STARTED              = 'RLC_QC_STARTED',
  RLC_VOTE_CAST               = 'RLC_VOTE_CAST',
  RLC_CORRECTION_SUBMITTED    = 'RLC_CORRECTION_SUBMITTED',
  RLC_SPEAKER_AFFIRMED        = 'RLC_SPEAKER_AFFIRMED',
  RLC_QC_TRANSLATION_ADDED    = 'RLC_QC_TRANSLATION_ADDED',

  // Sync
  RLC_SYNC_QUEUED             = 'RLC_SYNC_QUEUED',
  RLC_SYNC_COMPLETE           = 'RLC_SYNC_COMPLETE',
  RLC_SYNC_FAILED             = 'RLC_SYNC_FAILED',
}

/**
 * Base event shape shared by all RLC events — spec §13.2.
 *
 * The `payload` field carries event-specific data (spec §13.3).
 * Events are append-only and are never modified after creation (spec §13.4).
 */
export interface RlcEvent {
  event_id:       string          // UUID v4 — generated client-side
  event_type:     RlcEventType
  session_id:     string
  participant_id: string
  emitted_at:     number          // Unix ms — client clock
  sequence:       number          // monotonically increasing within participant session
  payload:        Record<string, unknown>
}
