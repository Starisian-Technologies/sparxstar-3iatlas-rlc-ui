/**
 * IndexedDB-backed offline queue for submissions and runtime events.
 *
 * Architecture doctrine (spec §12.5):
 *   The offline queue is the PRIMARY submission path — not a backup.
 *   Every submission goes through the queue whether the device is online or not.
 *   The UI reflects queue state, not network state.
 *
 * Schema:
 *   DB: spx-rlc-queue  v2
 *   Store: submissions  — QueuedSubmission objects (SaveTokenPayload + queue metadata)
 *   Store: rlc_events   — QueuedEvent objects (RlcEvent + status field for flush tracking)
 *
 * v1 → v2 migration: adds composite index 'session_participant' on [session_id, participant_id]
 * to rlc_events. No data migration needed — existing rows are re-indexed automatically.
 *
 * Note: Both stores persist queue metadata alongside the payload/event.
 *       The `status` field is mutated via markSubmissionSynced/markEventsSynced.
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
const DB_VERSION          = 2
const STORE_SUBMISSIONS   = 'submissions'
const STORE_EVENTS        = 'rlc_events'

// ── Singleton DB handle ───────────────────────────────────────────────────────

let _db: IDBDatabase | null = null

function getDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db         = (e.target as IDBOpenDBRequest).result
      const tx         = (e.target as IDBOpenDBRequest).transaction!
      const oldVersion = e.oldVersion

      if (oldVersion < 1) {
        // Fresh install — create both stores with all indexes.
        const subStore = db.createObjectStore(STORE_SUBMISSIONS, { keyPath: 'id' })
        subStore.createIndex('status',     'status',     { unique: false })
        subStore.createIndex('session_id', 'session_id', { unique: false })

        const evtStore = db.createObjectStore(STORE_EVENTS, { keyPath: 'event_id' })
        evtStore.createIndex('status',              'status',                        { unique: false })
        evtStore.createIndex('session_id',          'session_id',                    { unique: false })
        evtStore.createIndex('session_participant', ['session_id', 'participant_id'], { unique: false })
      }

      if (oldVersion === 1) {
        // v1 → v2: add composite index to rlc_events. No data migration needed —
        // IDB re-indexes existing records automatically during the version-change tx.
        const evtStore = tx.objectStore(STORE_EVENTS)
        evtStore.createIndex('session_participant', ['session_id', 'participant_id'], { unique: false })
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

async function deriveMaxSequenceFromDb(
  db: IDBDatabase,
  participantId: string,
  sessionId: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_EVENTS, 'readonly')
    // Use the composite index so only this participant's events are loaded — not the full session.
    const range = IDBKeyRange.only([sessionId, participantId])
    const req   = tx.objectStore(STORE_EVENTS)
                    .index('session_participant')
                    .getAll(range)
    req.onsuccess = () => {
      const all = req.result as QueuedEvent[]
      const max = all.reduce((highest, event) => Math.max(highest, event.sequence), 0)
      resolve(max)
    }
    req.onerror = () => reject(req.error)
  })
}

async function nextSequence(
  db: IDBDatabase,
  participantId: string,
  sessionId: string,
): Promise<number> {
  const key = `${sessionId}::${participantId}`
  if (!_seq.has(key)) {
    const maxStored = await deriveMaxSequenceFromDb(db, participantId, sessionId)
    _seq.set(key, maxStored)
  }
  const next = (_seq.get(key) ?? 0) + 1
  _seq.set(key, next)
  return next
}

// ── Submission queue ──────────────────────────────────────────────────────────

export async function queueSubmission(
  payload: SaveTokenPayload,
  /** Caller-provided ID — if omitted a new UUID is generated. Pass the same UUID
   *  used for the optimistic UI row to avoid a placeholder→localId swap. */
  id?: string,
): Promise<QueuedSubmission> {
  const db = await getDb()
  const item: QueuedSubmission = {
    id:             id ?? crypto.randomUUID(),
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
  const sequence = await nextSequence(db, participantId, sessionId)
  const event: QueuedEvent = {
    event_id:       crypto.randomUUID(),
    event_type:     eventType,
    session_id:     sessionId,
    participant_id: participantId,
    emitted_at:     Date.now(),
    sequence,
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
  return updateEventStatus(eventIds, 'synced')
}

export async function markEventsFailed(eventIds: string[]): Promise<void> {
  return updateEventStatus(eventIds, 'failed')
}

async function updateEventStatus(eventIds: string[], status: QueuedStatus): Promise<void> {
  if (eventIds.length === 0) return
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_EVENTS, 'readwrite')
    const store = tx.objectStore(STORE_EVENTS)

    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('Failed to update queued event status'))
    tx.onerror = () => reject(tx.error ?? new Error('Failed to update queued event status'))

    for (const id of eventIds) {
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        const item = getReq.result as QueuedEvent | undefined
        if (!item) {
          // Skip missing IDs — already cleaned up or duplicate flush
          return
        }
        store.put({ ...item, status } as QueuedEvent)
      }
      getReq.onerror = () => tx.abort()
    }
  })
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

/**
 * Delete all `status: 'synced'` records for the given session from both stores.
 * Call on session end to keep IDB storage bounded (spec §12.5 guidance on GC).
 *
 * Reads are done in separate readonly transactions first; deletions are batched
 * into a single readwrite transaction to avoid IDB auto-commit edge cases.
 */
export async function cleanupSyncedRecords(sessionId: string): Promise<void> {
  const db = await getDb()

  // Phase 1 — collect IDs to delete (readonly, parallel).
  const [syncedSubIds, syncedEventIds] = await Promise.all([
    new Promise<string[]>((resolve, reject) => {
      const tx  = db.transaction(STORE_SUBMISSIONS, 'readonly')
      const req = tx.objectStore(STORE_SUBMISSIONS).index('session_id').getAll(sessionId)
      req.onsuccess = () => {
        const ids: string[] = []
        for (const i of req.result as QueuedSubmission[]) {
          if (i.status === 'synced') ids.push(i.id)
        }
        resolve(ids)
      }
      req.onerror = () => reject(req.error)
    }),
    new Promise<string[]>((resolve, reject) => {
      const tx  = db.transaction(STORE_EVENTS, 'readonly')
      const req = tx.objectStore(STORE_EVENTS).index('session_id').getAll(sessionId)
      req.onsuccess = () => {
        const ids: string[] = []
        for (const i of req.result as QueuedEvent[]) {
          if (i.status === 'synced') ids.push(i.event_id)
        }
        resolve(ids)
      }
      req.onerror = () => reject(req.error)
    }),
  ])

  if (syncedSubIds.length === 0 && syncedEventIds.length === 0) return

  // Phase 2 — batch delete (readwrite, single transaction).
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SUBMISSIONS, STORE_EVENTS], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('cleanupSyncedRecords aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('cleanupSyncedRecords failed'))
    const subStore = tx.objectStore(STORE_SUBMISSIONS)
    for (const id of syncedSubIds) subStore.delete(id)
    const evtStore = tx.objectStore(STORE_EVENTS)
    for (const id of syncedEventIds) evtStore.delete(id)
  })
}

// Re-export RlcEventType so callers only need one import
export { RlcEventType }
