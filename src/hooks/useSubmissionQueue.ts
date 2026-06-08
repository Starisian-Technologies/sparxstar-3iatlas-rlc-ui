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
import {
  queueSubmission,
  markSubmissionSynced,
  markSubmissionFailed,
  getPendingSubmissions,
  queueEvent,
  cleanupSyncedRecords,
  RlcEventType,
} from '@/runtime/offlineQueue'
import { useNetworkStatus } from './useNetworkStatus'
import { buildSyncPayload, derivePendingCount } from './useSubmissionQueue.utils'
import type { SaveTokenPayload, SaveTokenResponse } from '@/types'
import type { QueuedSubmission } from '@/runtime/offlineQueue'

export type SyncState = 'offline' | 'syncing' | 'synced'

// Analytics events (RLC_*) stay local in IndexedDB — there is no wire
// endpoint for them in contract v1.0. /events/batch is for token-operation
// replay (token.save/vote/translate/correct), which the UI does inline via
// api.token.save in the loop below.

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

  const refreshPendingCount = useCallback(async (): Promise<number> => {
    const count = await derivePendingCount(sessionId)
    setPendingCount(count)
    return count
  }, [sessionId])

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

      const remainingSubs = await refreshPendingCount()
      setSyncState(remainingSubs === 0 ? 'synced' : 'syncing')
    } finally {
      isFlushingRef.current = false
    }
  }, [sessionId, isOnline, refreshPendingCount])

  // ── Re-flush when the device comes back online ────────────────────────────

  useEffect(() => {
    if (!autoFlush) {
      if (!sessionId.trim()) {
        setPendingCount(0)
        setSyncState('synced')
        return
      }

      let cancelled = false
      const syncFromQueueState = async () => {
        try {
          const remainingSubs = await refreshPendingCount()
          if (cancelled) return

          if (remainingSubs === 0) {
            setSyncState('synced')
            return
          }

          setSyncState('offline')
        } catch (error) {
          if (cancelled) return
          console.error('Failed to sync queue state from IndexedDB', error)
          setSyncState('offline')
        }
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
    await queueEvent(RlcEventType.RLC_SYNC_QUEUED, sessionId, participantId, {
      queue_depth: pending.length,
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

  const cleanupSession = useCallback(() => {
    if (!sessionId.trim()) {
      return Promise.resolve()
    }
    return cleanupSyncedRecords(sessionId)
  }, [sessionId])

  return { submit, syncState, pendingCount, syncedSubmissions, flushPending, cleanupSession }
}
