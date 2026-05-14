/**
 * IndexedDB-backed offline queue for submissions and runtime events.
 *
 * Architecture doctrine (spec §12.5):
 *   The offline queue is the PRIMARY submission path — not a backup.
 *   Every submission goes through the queue whether the device is online or not.
 *   The UI reflects queue state, not network state.
 *
 * Schema:
 *   DB: spx-rlc-queue  v1
 *   Store: submissions  — token save payloads waiting to flush
 *   Store: rlc_events   — RlcEvent objects waiting to flush via POST /events/batch
 */

import type { SaveTokenPayload, SaveTokenResponse, SpellingSignal, SaturationSignal } from '@/types'
import { RlcEventType } from './rlcEventTypes'
import type { RlcEvent } from './rlcEventTypes'

// ── Types ──────────────────────────────────────────────────────────────────────

export type QueuedStatus = 'queued' | 'syncing' | 'synced' | 'failed'

export interface QueuedSubmission {
  id:               string          // local UUID — stable key before token_id is known
  session_id:       string
  participant_id:   string
  payload:          SaveTokenPayload
  status:           QueuedStatus
  queued_at:        number          // Unix ms
  synced_at?:       number
  token_id?:        string          // set on successful flush
  spelling_signal?: SpellingSignal
  saturation_signal?: SaturationSignal
  xp_awarded?:      number
}

export type QueuedEvent = RlcEvent & { status: QueuedStatus }

// ── IDB constants ─────────────────────────────────────────────────────────────

const DB_NAME             = 'spx-rlc-queue'
const DB_VERSION          = 1
const STORE_SUBMISSIONS   = 'submissions'
const STORE_EVENTS        = 'rlc_events'

// ── Singleton DB handle ───────────────────────────────────────────────────────

let _db: IDBDatabase | null = null

function getDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_SUBMISSIONS)) {
        const s = db.createObjectStore(STORE_SUBMISSIONS, { keyPath: 'id' })
        s.createIndex('status',     'status',     { unique: false })
        s.createIndex('session_id', 'session_id', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const s = db.createObjectStore(STORE_EVENTS, { keyPath: 'event_id' })
        s.createIndex('status',     'status',     { unique: false })
        s.createIndex('session_id', 'session_id', { unique: false })
      }
    }

    req.onsuccess = () => {
      _db = req.result
      resolve(_db)
    }
    req.onerror = () => reject(req.error)
  })
}

// ── Event sequence counter ────────────────────────────────────────────────────
// Scoped per participant + session, monotonically increasing (spec §13.4).

const _seq = new Map<string, number>()

function nextSequence(participantId: string, sessionId: string): number {
  const key = `${sessionId}::${participantId}`
  const next = (_seq.get(key) ?? 0) + 1
  _seq.set(key, next)
  return next
}

export function resetSequence(participantId: string, sessionId: string): void {
  _seq.delete(`${sessionId}::${participantId}`)
}

// ── Submission queue ──────────────────────────────────────────────────────────

export async function queueSubmission(
  payload: SaveTokenPayload,
): Promise<QueuedSubmission> {
  const db = await getDb()
  const item: QueuedSubmission = {
    id:             crypto.randomUUID(),
    session_id:     payload.session_id,
    participant_id: payload.participant_id,
    payload,
    status:         'queued',
    queued_at:      Date.now(),
  }
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_SUBMISSIONS, 'readwrite')
    const req = tx.objectStore(STORE_SUBMISSIONS).add(item)
    req.onsuccess = () => resolve(item)
    req.onerror   = () => reject(req.error)
  })
}

export async function markSubmissionSynced(
  id:     string,
  result: SaveTokenResponse,
): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_SUBMISSIONS, 'readwrite')
    const store = tx.objectStore(STORE_SUBMISSIONS)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const item = getReq.result as QueuedSubmission | undefined
      if (!item) { resolve(); return }
      const updated: QueuedSubmission = {
        ...item,
        status:            'synced',
        synced_at:         Date.now(),
        token_id:          result.token_id,
        spelling_signal:   result.spelling_signal,
        saturation_signal: result.saturation_signal,
        xp_awarded:        result.xp_awarded,
      }
      const putReq = store.put(updated)
      putReq.onsuccess = () => resolve()
      putReq.onerror   = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function markSubmissionFailed(id: string): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_SUBMISSIONS, 'readwrite')
    const store = tx.objectStore(STORE_SUBMISSIONS)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const item = getReq.result as QueuedSubmission | undefined
      if (!item) { resolve(); return }
      const putReq = store.put({ ...item, status: 'failed' } as QueuedSubmission)
      putReq.onsuccess = () => resolve()
      putReq.onerror   = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function getPendingSubmissions(sessionId: string): Promise<QueuedSubmission[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_SUBMISSIONS, 'readonly')
    const req = tx.objectStore(STORE_SUBMISSIONS).index('session_id').getAll(sessionId)
    req.onsuccess = () => {
      const all = req.result as QueuedSubmission[]
      resolve(all.filter((item) => item.status === 'queued' || item.status === 'failed'))
    }
    req.onerror = () => reject(req.error)
  })
}

// ── Event queue ───────────────────────────────────────────────────────────────

export async function queueEvent(
  eventType:     RlcEventType,
  sessionId:     string,
  participantId: string,
  payload:       Record<string, unknown>,
): Promise<void> {
  const db = await getDb()
  const event: QueuedEvent = {
    event_id:       crypto.randomUUID(),
    event_type:     eventType,
    session_id:     sessionId,
    participant_id: participantId,
    emitted_at:     Date.now(),
    sequence:       nextSequence(participantId, sessionId),
    payload,
    status:         'queued',
  }
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_EVENTS, 'readwrite')
    const req = tx.objectStore(STORE_EVENTS).add(event)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

export async function getPendingEvents(sessionId: string): Promise<QueuedEvent[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_EVENTS, 'readonly')
    const req = tx.objectStore(STORE_EVENTS).index('session_id').getAll(sessionId)
    req.onsuccess = () => {
      const all = req.result as QueuedEvent[]
      resolve(all.filter((item) => item.status === 'queued' || item.status === 'failed'))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function markEventsSynced(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_EVENTS, 'readwrite')
    const store = tx.objectStore(STORE_EVENTS)
    let pending = eventIds.length
    let rejected = false

    const done = () => { if (--pending === 0 && !rejected) resolve() }
    const fail = (err: unknown) => {
      if (!rejected) { rejected = true; reject(err) }
    }

    for (const id of eventIds) {
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        const item = getReq.result as QueuedEvent | undefined
        if (item) store.put({ ...item, status: 'synced' } as QueuedEvent)
        done()
      }
      getReq.onerror = () => fail(getReq.error)
    }
  })
}

// Re-export RlcEventType so callers only need one import
export { RlcEventType }
