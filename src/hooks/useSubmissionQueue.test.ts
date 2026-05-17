import { describe, expect, it } from 'vitest'
import { derivePendingCount } from './useSubmissionQueue.utils'
import type { QueuedSubmission } from '@/runtime/offlineQueue'

describe('useSubmissionQueue pending count derivation', () => {
  it('derives pending count from queue size each time', async () => {
    const bySession: Record<string, QueuedSubmission[]> = {
      'session-1': [1, 2, 3].map((n) => ({ id: String(n) } as QueuedSubmission)),
    }

    const reader = async (sessionId: string) => bySession[sessionId] ?? []

    expect(await derivePendingCount('session-1', reader)).toBe(3)

    bySession['session-1'] = [{ id: '4' } as QueuedSubmission]
    expect(await derivePendingCount('session-1', reader)).toBe(1)

    bySession['session-1'] = []
    expect(await derivePendingCount('session-1', reader)).toBe(0)
  })
})
