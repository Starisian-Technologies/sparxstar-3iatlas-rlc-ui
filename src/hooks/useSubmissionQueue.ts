/**
 * Offline-first submission hook (spec §12.5).
 *
 * Every submission — online or offline — goes through the IndexedDB queue first.
 * The hook immediately attempts to flush. If the device is offline, the submission
 * stays queued and is retried when the device reconnects.
 *
 * The `syncState` returned reflects QUEUE state, not network state:
 *   'online'  — connected and queue is empty
 *   'syncing' — connected and flushing pending items
 *   'offline' — device is disconnected (navigator.onLine = false)
 */

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import {
  queueSubmission,
  markSubmissionSynced,
  markSubmissionFailed,
  getPendingSubmissions,
  queueEvent,
  RlcEventType,
} from '@/runtime/offlineQueue'
import { useNetworkStatus } from './useNetworkStatus'
import type { SaveTokenPayload, SaveTokenResponse } from '@/types'
import type { QueuedSubmission } from '@/runtime/offlineQueue'

export type SyncState = 'online' | 'offline' | 'syncing'

export interface SubmitResult {
  /** Local queue ID — stable across queued → synced transition */
  localId: string
  /** Server response, or null if the submission is still queued */
  result: SaveTokenResponse | null
  status: QueuedSubmission['status']
}

export function useSubmissionQueue(sessionId: string, participantId: string) {
  const { isOnline } = useNetworkStatus()
  const [syncState, setSyncState] = useState<SyncState>('online')
  const [pendingCount, setPendingCount] = useState(0)

  // ── Flush all pending items for this session ──────────────────────────────

  const flushPending = useCallback(async () => {
    const pending = await getPendingSubmissions(sessionId)
    if (pending.length === 0) {
      setSyncState(isOnline ? 'online' : 'offline')
      return
    }

    setSyncState('syncing')

    for (const item of pending) {
      try {
        const result = await api.token.save(item.payload)
        await markSubmissionSynced(item.id, result)
        await queueEvent(RlcEventType.RLC_SYNC_COMPLETE, sessionId, participantId, {
          local_id:  item.id,
          token_id:  result.token_id,
        })
      } catch {
        await markSubmissionFailed(item.id)
        await queueEvent(RlcEventType.RLC_SYNC_FAILED, sessionId, participantId, {
          local_id: item.id,
          reason:   'network_error',
        })
      }
    }

    const remaining = await getPendingSubmissions(sessionId)
    setPendingCount(remaining.length)
    setSyncState(isOnline && remaining.length === 0 ? 'online' : 'offline')
  }, [sessionId, participantId, isOnline])

  // ── Re-flush when the device comes back online ────────────────────────────

  useEffect(() => {
    if (isOnline) {
      void flushPending()
    } else {
      setSyncState('offline')
    }
  }, [isOnline, flushPending])

  // ── Primary submit function ───────────────────────────────────────────────

  const submit = useCallback(async (
    payload: SaveTokenPayload,
  ): Promise<SubmitResult> => {
    // 1. Append to IndexedDB — always, regardless of connectivity.
    const queued = await queueSubmission(payload)

    const pending = await getPendingSubmissions(sessionId)
    await queueEvent(RlcEventType.RLC_SYNC_QUEUED, sessionId, participantId, {
      local_id:    queued.id,
      queue_depth: pending.length,
    })

    setSyncState('syncing')
    setPendingCount((n) => n + 1)

    // 2. Attempt immediate flush.
    try {
      const result = await api.token.save(payload)
      await markSubmissionSynced(queued.id, result)
      await queueEvent(RlcEventType.RLC_SYNC_COMPLETE, sessionId, participantId, {
        local_id: queued.id,
        token_id: result.token_id,
      })
      setPendingCount((n) => Math.max(0, n - 1))
      setSyncState(isOnline ? 'online' : 'offline')
      return { localId: queued.id, result, status: 'synced' }
    } catch {
      // 3. Leave in queue. Student's submission is NOT lost.
      await markSubmissionFailed(queued.id)
      await queueEvent(RlcEventType.RLC_SYNC_FAILED, sessionId, participantId, {
        local_id: queued.id,
        reason:   'network_error',
      })
      setSyncState('offline')
      return { localId: queued.id, result: null, status: 'failed' }
    }
  }, [sessionId, participantId, isOnline])

  return { submit, syncState, pendingCount, flushPending }
}
