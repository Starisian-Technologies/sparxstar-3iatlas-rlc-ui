/**
 * Offline-first submission hook (spec §12.5).
 *
 * Every submission — online or offline — goes through the IndexedDB queue first.
 * The hook immediately attempts to flush. If the device is offline, the submission
 * stays queued and is retried when the device reconnects.
 *
 * The `syncState` returned reflects QUEUE state, not network state:
 *   'synced'  — queue is empty and not currently flushing
 *   'syncing' — flushing pending queued items
 *   'offline' — queued items remain but sync cannot currently proceed, either because
 *               the device is offline or because the latest batch flush failed
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import type { EventsBatchFlushResponse } from '@/api/client'
import {
  queueSubmission,
  markSubmissionSynced,
  markSubmissionFailed,
  getPendingSubmissions,
  getPendingEvents,
  markEventsSynced,
  markEventsFailed,
  queueEvent,
  cleanupSyncedRecords,
  RlcEventType,
} from '@/runtime/offlineQueue'
import { useNetworkStatus } from './useNetworkStatus'
import { buildSyncPayload, derivePendingCount } from './useSubmissionQueue.utils'
import type { SaveTokenPayload, SaveTokenResponse } from '@/types'
import type { QueuedSubmission } from '@/runtime/offlineQueue'

export type SyncState = 'offline' | 'syncing' | 'synced'

/**
 * Determine which queued event IDs the server confirmed as accepted.
 *
 * Preferred path: server returns `accepted_event_ids` (authoritative IDs).
 * Fallback path: if IDs are absent but accepted===queued and failed===0, treat whole batch as accepted.
 * Partial acceptance always filters against the queued set to avoid syncing unknown IDs.
 */
function getAcceptedEventIds(
  result: EventsBatchFlushResponse,
  queuedEventIds: string[],
): string[] {
  if (queuedEventIds.length === 0) return []
  const acceptedEventIdsRaw = result.accepted_event_ids
  if (Array.isArray(acceptedEventIdsRaw)) {
    if (acceptedEventIdsRaw.length === 0) return []
    if (!acceptedEventIdsRaw.every((id) => typeof id === 'string')) {
      console.warn('Ignoring malformed accepted_event_ids from /events/batch response')
      return []
    }
    const queuedSet = new Set(queuedEventIds)
    return acceptedEventIdsRaw.filter((id) => queuedSet.has(id))
  }

  if (result.accepted === queuedEventIds.length && result.failed === 0) {
    return queuedEventIds
  }

  return []
}

export interface SubmitResult {
  /** Local queue ID — stable across queued → synced transition */
  localId: string
  /** Server response, or null if the submission is still queued */
  result: SaveTokenResponse | null
  status: QueuedSubmission['status']
}

export interface SyncedSubmissionReceipt {
  localId: string
  /** participant_id this receipt belongs to — screens must filter to their own participant */
  participantId: string
  result: SaveTokenResponse
}

export interface UseSubmissionQueueOptions {
  /**
   * Disable the hook's background flusher when a caller only needs queue helpers
   * like cleanupSession() and already has another auto-flushing instance mounted.
   */
  autoFlush?: boolean
}

export function useSubmissionQueue(
  sessionId: string,
  participantId: string,
  options: UseSubmissionQueueOptions = {},
) {
  const { autoFlush = true } = options
  const { isOnline } = useNetworkStatus()
  const [syncState, setSyncState] = useState<SyncState>(() => (isOnline ? 'syncing' : 'offline'))
  const [pendingCount, setPendingCount] = useState(0)
  const [syncedSubmissions, setSyncedSubmissions] = useState<SyncedSubmissionReceipt[]>([])
  const isFlushingRef = useRef(false)
  const isFlushingEventsRef = useRef(false)

  const refreshPendingCount = useCallback(async (): Promise<number> => {
    const count = await derivePendingCount(sessionId)
    setPendingCount(count)
    return count
  }, [sessionId])

  /**
   * Flush queued runtime events.
   * Returns true when the event batch failed (offline, network error, or server reject); false otherwise.
   */
  const flushPendingEvents = useCallback(async (): Promise<boolean> => {
    if (!isOnline) return true
    if (isFlushingEventsRef.current) return false
    isFlushingEventsRef.current = true
    try {
      const pendingEvents = await getPendingEvents(sessionId)
      if (pendingEvents.length === 0) return false

      const eventIds = pendingEvents.map((event) => event.event_id)
      const eventsPayload = pendingEvents.map((event) => {
        const { status, ...payload } = event
        void status
        return payload
      })

      try {
        const result = await api.events.batchFlush(eventsPayload)
        const acceptedEventIds = getAcceptedEventIds(result, eventIds)

        if (acceptedEventIds.length > 0) {
          await markEventsSynced(acceptedEventIds)
          await refreshPendingCount()
        }

        const acceptedSet = new Set(acceptedEventIds)
        const rejectedEventIds = eventIds.filter((id) => !acceptedSet.has(id))
        if (rejectedEventIds.length > 0) {
          await markEventsFailed(rejectedEventIds)
        }

        return result.failed > 0
      } catch {
        return true
      }
    } finally {
      isFlushingEventsRef.current = false
    }
  }, [isOnline, sessionId, refreshPendingCount])

  // ── Flush all pending items for this session ──────────────────────────────

  const flushPending = useCallback(async () => {
    if (isFlushingRef.current) return
    isFlushingRef.current = true
    try {
      if (!isOnline) {
        await refreshPendingCount()
        setSyncState('offline')
        return
      }

      const pending = await getPendingSubmissions(sessionId)
      setPendingCount(pending.length)
      setSyncState('syncing')

      if (pending.length > 0) {
        const receipts: SyncedSubmissionReceipt[] = []

        for (const item of pending) {
          try {
            const result = await api.token.save(buildSyncPayload(item.payload))
            await markSubmissionSynced(item.id, result)
            receipts.push({ localId: item.id, participantId: item.participant_id, result })
            // Emit RLC_SUBMISSION_SAVED at server confirmation (spec §13.4).
            // Use item.participant_id to correctly scope events per participant.
            await queueEvent(RlcEventType.RLC_SUBMISSION_SAVED, sessionId, item.participant_id, {
              token_id:        result.token_id,
              spelling_signal: result.spelling_signal,
            })
            await queueEvent(RlcEventType.RLC_SYNC_COMPLETE, sessionId, item.participant_id, {
              local_id:  item.id,
              token_id:  result.token_id,
            })
          } catch {
            await markSubmissionFailed(item.id)
            await queueEvent(RlcEventType.RLC_SYNC_FAILED, sessionId, item.participant_id, {
              local_id: item.id,
              reason:   'network_error',
            })
          }
        }

        if (receipts.length > 0) {
          setSyncedSubmissions(receipts)
        }
      }

      // Keep 'syncing' while events are being flushed; only set 'synced' when both queues are empty.
      // participantId is intentionally omitted from deps — it is stable for the lifetime of a session.
      const remainingSubs = await refreshPendingCount()
      const hadEventSyncError = await flushPendingEvents()
      const remainingEvents = await getPendingEvents(sessionId)
      if (hadEventSyncError) {
        setSyncState('offline')
      } else {
        setSyncState(remainingSubs === 0 && remainingEvents.length === 0 ? 'synced' : 'syncing')
      }
    } finally {
      isFlushingRef.current = false
    }
  }, [sessionId, isOnline, refreshPendingCount, flushPendingEvents])

  // ── Re-flush when the device comes back online ────────────────────────────

  useEffect(() => {
    if (!autoFlush) {
      let cancelled = false
      const syncFromQueueState = async () => {
        const remainingSubs = await refreshPendingCount()
        const remainingEvents = await getPendingEvents(sessionId)
        if (cancelled) return

        if (remainingSubs === 0 && remainingEvents.length === 0) {
          setSyncState('synced')
          return
        }

        setSyncState(isOnline ? 'syncing' : 'offline')
      }
      void syncFromQueueState()
      return () => {
        cancelled = true
      }
    }

    if (!isOnline) {
      setSyncState('offline')
      void refreshPendingCount()
      return
    }

    void flushPending()
    const interval = setInterval(() => {
      void flushPending()
    }, 2000)
    return () => clearInterval(interval)
  }, [autoFlush, isOnline, flushPending, refreshPendingCount, sessionId])

  // ── Primary submit function ───────────────────────────────────────────────

  const submit = useCallback(async (
    payload: SaveTokenPayload,
    /** Caller-provided ID — use the same UUID as the optimistic UI row to avoid
     *  a placeholder→localId swap and the associated receipt-miss race. */
    callerProvidedId?: string,
  ): Promise<SubmitResult> => {
    // 1. Append to IndexedDB — always, regardless of connectivity.
    const queued = await queueSubmission(payload, callerProvidedId)

    const pending = await getPendingSubmissions(sessionId)
    // Derive queued_event_ids from pending RLC events (spec §13.3) — event IDs, not submission IDs.
    // Scope to this participant to avoid cross-participant event attribution.
    const pendingEvents = await getPendingEvents(sessionId)
    const participantPendingEventIds = pendingEvents
      .filter((e) => e.participant_id === participantId)
      .map((e) => e.event_id)
    await queueEvent(RlcEventType.RLC_SYNC_QUEUED, sessionId, participantId, {
      queued_event_ids: participantPendingEventIds,
      queue_depth:      pending.length,
    })

    setPendingCount(pending.length)
    setSyncState(isOnline ? 'syncing' : 'offline')

    // 2. If offline, skip immediate flush and rely on reconnect flusher.
    if (!isOnline) {
      return { localId: queued.id, result: null, status: 'queued' }
    }

    // 3. Trigger background flush instead of direct POST to avoid race with interval flusher.
    void flushPending()
    
    // Return immediately with queued status — the flusher will handle sync.
    return { localId: queued.id, result: null, status: 'queued' }
  }, [sessionId, participantId, isOnline, flushPending])

  const cleanupSession = useCallback(() => cleanupSyncedRecords(sessionId), [sessionId])

  return { submit, syncState, pendingCount, syncedSubmissions, flushPending, cleanupSession }
}
