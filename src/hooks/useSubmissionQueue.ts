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

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import {
  queueSubmission,
  markSubmissionSynced,
  markSubmissionFailed,
  getPendingSubmissions,
  getPendingEvents,
  markEventsSynced,
  markEventsFailed,
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

export interface SyncedSubmissionReceipt {
  localId: string
  result: SaveTokenResponse
}

export function useSubmissionQueue(sessionId: string, participantId: string) {
  const { isOnline } = useNetworkStatus()
  const [syncState, setSyncState] = useState<SyncState>('online')
  const [pendingCount, setPendingCount] = useState(0)
  const [syncedSubmissions, setSyncedSubmissions] = useState<SyncedSubmissionReceipt[]>([])
  const isFlushingRef = useRef(false)
  const isFlushingEventsRef = useRef(false)

  const refreshPendingCount = useCallback(async (): Promise<number> => {
    const remaining = await getPendingSubmissions(sessionId)
    setPendingCount(remaining.length)
    return remaining.length
  }, [sessionId])

  const flushPendingEvents = useCallback(async () => {
    if (!isOnline) return
    if (isFlushingEventsRef.current) return
    isFlushingEventsRef.current = true
    try {
      const pendingEvents = await getPendingEvents(sessionId)
      if (pendingEvents.length === 0) return

      const eventIds = pendingEvents.map((event) => event.event_id)
      const eventsPayload = pendingEvents.map((event) => {
        const { status, ...payload } = event
        void status
        return payload
      })

      try {
        const result = await api.events.batchFlush(eventsPayload)
        if (result.failed === 0) {
          await markEventsSynced(eventIds)
        } else {
          await markEventsFailed(eventIds)
        }
      } catch {
        await markEventsFailed(eventIds)
      }
    } finally {
      isFlushingEventsRef.current = false
    }
  }, [isOnline, sessionId])

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
      if (pending.length === 0) {
        setPendingCount(0)
        setSyncState('online')
        await flushPendingEvents()
        return
      }

      setSyncState('syncing')
      const receipts: SyncedSubmissionReceipt[] = []

      for (const item of pending) {
        try {
          const result = await api.token.save(item.payload)
          await markSubmissionSynced(item.id, result)
          receipts.push({ localId: item.id, result })
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

      if (receipts.length > 0) {
        setSyncedSubmissions(receipts)
      }

      const remaining = await refreshPendingCount()
      setSyncState(remaining === 0 ? 'online' : 'syncing')
      await flushPendingEvents()
    } finally {
      isFlushingRef.current = false
    }
  }, [sessionId, participantId, isOnline, refreshPendingCount, flushPendingEvents])

  // ── Re-flush when the device comes back online ────────────────────────────

  useEffect(() => {
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
  }, [isOnline, flushPending, refreshPendingCount])

  // ── Primary submit function ───────────────────────────────────────────────

  const submit = useCallback(async (
    payload: SaveTokenPayload,
  ): Promise<SubmitResult> => {
    // 1. Append to IndexedDB — always, regardless of connectivity.
    const queued = await queueSubmission(payload)

    const pending = await getPendingSubmissions(sessionId)
    const queuedEventIds = pending.map((item) => item.id)
    await queueEvent(RlcEventType.RLC_SYNC_QUEUED, sessionId, participantId, {
      queued_event_ids: queuedEventIds,
      queue_depth:      pending.length,
    })

    setPendingCount(pending.length)
    setSyncState(isOnline ? 'syncing' : 'offline')

    // 2. If offline, skip immediate flush and rely on reconnect flusher.
    if (!isOnline) {
      await markSubmissionFailed(queued.id)
      return { localId: queued.id, result: null, status: 'failed' }
    }

    // 3. Trigger background flush instead of direct POST to avoid race with interval flusher.
    void flushPending()
    
    // Return immediately with queued status — the flusher will handle sync.
    return { localId: queued.id, result: null, status: 'queued' }
  }, [sessionId, participantId, isOnline, flushPending])

  return { submit, syncState, pendingCount, syncedSubmissions, flushPending }
}
